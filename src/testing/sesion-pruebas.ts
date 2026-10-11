import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Rol } from '@core/auth/modelos/rol';
import { ProveedorIdentidad, TokensIdentidad } from '@core/auth/proveedor-identidad';
import { SesionService } from '@core/auth/sesion.service';

/** Grupo de Cognito de cada rol (inverso de `GRUPO_A_ROL`). */
export const GRUPO_POR_ROL: Readonly<Record<Rol, string>> = {
  asegurado: 'insured',
  asesor: 'advisor',
  operaciones: 'operations',
  socio: 'partner',
};

/** Nombre de prueba de cada rol (los de los frames A0, S0 y O0 del prototipo). */
export const NOMBRE_POR_ROL: Readonly<Record<Rol, string>> = {
  asegurado: 'Carolina Pérez',
  asesor: 'Laura Gómez',
  operaciones: 'Andrés Ruiz',
  socio: 'Banco Aliado',
};

function base64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  const binario = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT de prueba **sin firma real**: el cliente solo lee las claims (la firma la verifica el gateway). */
export function crearJwtPrueba(claims: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'RS256', kid: 'llave-de-prueba', typ: 'JWT' })),
    base64Url(JSON.stringify(claims)),
    'firma-de-prueba',
  ].join('.');
}

export interface OpcionesTokensPrueba {
  /** Segundos hasta el vencimiento del ID token (por defecto 300, la vigencia de 5 minutos de HA-S01). */
  readonly vigenciaSegundos?: number;
  readonly grupos?: readonly string[];
  readonly sinRenovacion?: boolean;
  readonly claims?: Record<string, unknown>;
}

/** Tokens de prueba de un usuario con el rol dado. */
export function crearTokensPrueba(rol: Rol, opciones: OpcionesTokensPrueba = {}): TokensIdentidad {
  const ahora = Math.floor(Date.now() / 1000);
  const idToken = crearJwtPrueba({
    sub: `sub-${rol}`,
    email: `${rol}@solventa.co`,
    name: NOMBRE_POR_ROL[rol],
    'cognito:groups': opciones.grupos ?? [GRUPO_POR_ROL[rol]],
    ...(rol === 'socio' ? { 'custom:partner_id': 'socio-001' } : {}),
    token_use: 'id',
    iat: ahora,
    exp: ahora + (opciones.vigenciaSegundos ?? 300),
    ...opciones.claims,
  });
  return {
    idToken,
    accessToken: crearJwtPrueba({ sub: `sub-${rol}`, token_use: 'access' }),
    ...(opciones.sinRenovacion ? {} : { refreshToken: `renovacion-${rol}` }),
  };
}

/** Doble de `ProveedorIdentidad` con funciones espía de Vitest. */
export function crearProveedorIdentidadFalso() {
  return {
    iniciarSesion: vi.fn<(correo: string, contrasena: string) => Promise<TokensIdentidad>>(),
    refrescar: vi.fn<(refreshToken: string) => Promise<TokensIdentidad>>(),
    revocar: vi.fn<(refreshToken: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

export type ProveedorIdentidadFalso = ReturnType<typeof crearProveedorIdentidadFalso>;

/** Proveedores de prueba: `SesionService` real sobre un proveedor de identidad falso. */
export function proveerSesionPrueba(
  proveedor: ProveedorIdentidadFalso = crearProveedorIdentidadFalso(),
): Provider[] {
  return [{ provide: ProveedorIdentidad, useValue: proveedor }];
}

/** Inicia una sesión con el rol dado en el `SesionService` del TestBed (requiere `proveerSesionPrueba`). */
export async function iniciarSesionComo(rol: Rol, opciones: OpcionesTokensPrueba = {}): Promise<void> {
  const proveedor = TestBed.inject(ProveedorIdentidad) as unknown as ProveedorIdentidadFalso;
  proveedor.iniciarSesion.mockResolvedValueOnce(crearTokensPrueba(rol, opciones));
  await TestBed.inject(SesionService).iniciarSesion(`${rol}@solventa.co`, 'contrasena-de-prueba');
}
