import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import { decodificarJwt } from './decodificar-jwt';
import { rolDesdeGrupos } from './modelos/rol';
import { Sesion, UsuarioSesion } from './modelos/sesion';
import { ErrorIdentidad, ProveedorIdentidad, TokensIdentidad } from './proveedor-identidad';

/** Clave de `sessionStorage` del token de renovación: sobrevive a recargar y muere al cerrar la pestaña. */
export const CLAVE_RENOVACION = 'solventa.sesion.renovacion';

/** Se renueva el ID token un minuto antes de que venza. */
export const MARGEN_RENOVACION_MS = 60_000;

/** Espera mínima entre renovaciones, para no entrar en bucle si el proveedor entrega un token casi vencido. */
export const ESPERA_MINIMA_RENOVACION_MS = 5_000;

/**
 * Sesión del usuario del portal (HA-S01). Mantiene los tokens en memoria y el token de renovación en
 * `sessionStorage`, renueva el ID token antes de que venza y lo revoca al cerrar sesión. Si la renovación
 * falla (token vencido o revocado), la sesión queda **expirada**: no se conserva acceso con las claims
 * anteriores y el usuario debe autenticarse de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly proveedor = inject(ProveedorIdentidad);
  private readonly sesionActual = signal<Sesion | null>(null);
  private readonly expiradaActual = signal(false);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private restauracion: Promise<boolean> | null = null;

  readonly sesion = this.sesionActual.asReadonly();
  readonly autenticado = computed(() => this.sesionActual() !== null);
  readonly usuario = computed(() => this.sesionActual()?.usuario ?? null);
  readonly rol = computed(() => this.sesionActual()?.usuario.rol ?? null);
  /** `true` cuando la sesión terminó por vencimiento, revocación o un 401 del API Gateway. */
  readonly expirada = this.expiradaActual.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelarRenovacion());
  }

  /** ID token vigente para el API Gateway, o `null` sin sesión. */
  idToken(): string | null {
    return this.sesionActual()?.idToken ?? null;
  }

  /** Inicia sesión. Lanza `ErrorIdentidad` si el proveedor la rechaza o si el usuario no tiene rol del portal. */
  async iniciarSesion(correo: string, contrasena: string): Promise<UsuarioSesion> {
    const tokens = await this.proveedor.iniciarSesion(correo, contrasena);
    let sesion: Sesion;
    try {
      sesion = construirSesion(tokens);
    } catch (error) {
      if (tokens.refreshToken) {
        await this.revocarSinFallar(tokens.refreshToken);
      }
      throw error;
    }
    this.guardarRenovacion(tokens.refreshToken ?? null);
    this.activar(sesion);
    return sesion.usuario;
  }

  /**
   * Recupera la sesión tras recargar la página usando el token de renovación. Devuelve `false` si no hay
   * nada que recuperar o si la renovación falla (en ese caso la sesión queda expirada).
   */
  restaurar(): Promise<boolean> {
    if (this.sesionActual()) {
      return Promise.resolve(true);
    }
    this.restauracion ??= this.renovar().finally(() => (this.restauracion = null));
    return this.restauracion;
  }

  /** Cierra la sesión: borra los tokens y revoca el token de renovación en el proveedor. */
  async cerrarSesion(): Promise<void> {
    const renovacion = this.leerRenovacion();
    this.limpiar();
    this.expiradaActual.set(false);
    if (renovacion) {
      await this.revocarSinFallar(renovacion);
    }
  }

  /** Termina la sesión por vencimiento (p. ej. un 401 del API Gateway). */
  marcarExpirada(): void {
    this.limpiar();
    this.expiradaActual.set(true);
  }

  private async renovar(): Promise<boolean> {
    const renovacion = this.leerRenovacion();
    if (!renovacion) {
      return false;
    }
    try {
      const tokens = await this.proveedor.refrescar(renovacion);
      const sesion = construirSesion(tokens);
      if (tokens.refreshToken) {
        this.guardarRenovacion(tokens.refreshToken);
      }
      this.activar(sesion);
      return true;
    } catch {
      this.marcarExpirada();
      return false;
    }
  }

  private activar(sesion: Sesion): void {
    this.sesionActual.set(sesion);
    this.expiradaActual.set(false);
    this.programarRenovacion(sesion.expiraEn);
  }

  private programarRenovacion(expiraEn: number): void {
    this.cancelarRenovacion();
    const espera = Math.max(
      expiraEn - Date.now() - MARGEN_RENOVACION_MS,
      ESPERA_MINIMA_RENOVACION_MS,
    );
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.renovar();
    }, espera);
  }

  private cancelarRenovacion(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  private limpiar(): void {
    this.cancelarRenovacion();
    this.sesionActual.set(null);
    this.guardarRenovacion(null);
  }

  private async revocarSinFallar(refreshToken: string): Promise<void> {
    try {
      await this.proveedor.revocar(refreshToken);
    } catch {
      // La sesión local ya se borró; si la revocación falla, el token vence solo (ventana documentada en HA-S01).
    }
  }

  private leerRenovacion(): string | null {
    try {
      return sessionStorage.getItem(CLAVE_RENOVACION);
    } catch {
      return null;
    }
  }

  private guardarRenovacion(refreshToken: string | null): void {
    try {
      if (refreshToken) {
        sessionStorage.setItem(CLAVE_RENOVACION, refreshToken);
      } else {
        sessionStorage.removeItem(CLAVE_RENOVACION);
      }
    } catch {
      // Sin sessionStorage (modo privado estricto) la sesión dura lo que dure la página.
    }
  }
}

/** Arma la sesión desde las claims del ID token: `sub`, `email`, `name`, `cognito:groups`, `custom:partner_id`, `exp`. */
function construirSesion(tokens: TokensIdentidad): Sesion {
  let claims: Readonly<Record<string, unknown>>;
  try {
    claims = decodificarJwt(tokens.idToken);
  } catch {
    throw new ErrorIdentidad('sesion-invalida');
  }

  const grupos = Array.isArray(claims['cognito:groups'])
    ? claims['cognito:groups'].filter((grupo): grupo is string => typeof grupo === 'string')
    : [];
  const rol = rolDesdeGrupos(grupos);
  if (!rol) {
    throw new ErrorIdentidad('sin-rol');
  }

  const id = texto(claims['sub']);
  const exp = claims['exp'];
  if (!id || typeof exp !== 'number') {
    throw new ErrorIdentidad('sesion-invalida');
  }

  const correo = texto(claims['email']) ?? '';
  return {
    usuario: {
      id,
      correo,
      nombre: texto(claims['name']) ?? correo,
      rol,
      socioId: texto(claims['custom:partner_id']),
    },
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    expiraEn: exp * 1000,
  };
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}
