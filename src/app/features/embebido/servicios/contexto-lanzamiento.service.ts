import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';

import { FlujoEmbebidoService, SolicitudCredito } from './flujo-embebido.service';

/** Nombre del *query param* con el contexto que el aliado entrega al lanzar el flujo. */
export const PARAMETRO_CONTEXTO = 'contexto';

/** Límites del contexto. El monto y el plazo son los que acepta la oferta del backend (10 a 2000 millones, 12 a 360 meses). */
export const LIMITES_CONTEXTO = {
  tamanoMaximo: 4096,
  montoMinimo: 10_000_000,
  montoMaximo: 2_000_000_000,
  plazoMinimoAnios: 1,
  plazoMaximoAnios: 30,
  monedas: ['COP', 'MXN', 'CLP', 'PEN'],
} as const;

/** Titular de la solicitud, tal como lo entrega el aliado. */
export interface ClienteLanzamiento {
  id: string;
  nombreCompleto: string;
  documento: string;
  correo: string;
  /** `YYYY-MM-DD`. */
  fechaNacimiento: string;
}

/** Comprobante del consentimiento que el paso 1 registró. */
export interface ConsentimientoOtorgado {
  id: string;
  /** Fecha y hora en que el servidor lo registró (RFC 3339). */
  fecha: string;
}

/** Motivo por el que el contexto no sirve; el nombre del campo ayuda a depurar el enlace del aliado. */
export type MotivoContextoInvalido = 'demasiado-grande' | 'codificacion' | 'estructura' | 'campo';

export type ResultadoContexto =
  | { estado: 'valido' }
  | { estado: 'ausente' }
  | { estado: 'invalido'; motivo: MotivoContextoInvalido; campo?: string };

const PATRON_IDENTIFICADOR = /^[A-Za-z0-9_-]{1,128}$/;
const PATRON_DOCUMENTO = /^[A-Za-z0-9]{5,20}$/;
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const PATRON_BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

class ContextoInvalido extends Error {
  constructor(
    readonly motivo: MotivoContextoInvalido,
    readonly campo?: string,
  ) {
    super(`Contexto de lanzamiento inválido: ${motivo}${campo ? ` (${campo})` : ''}`);
  }
}

/**
 * Contexto de lanzamiento del canal embebido (HU-W1.2-01, decisión D3): el aliado entrega los datos del
 * cliente y del crédito al iniciar el flujo, en el *query param* `contexto` (JSON en base64url). Valida el
 * contenido, publica la solicitud y el aliado en los servicios que ya consumen las demás pantallas, guarda al
 * cliente y el consentimiento en señales propias y quita el parámetro de la URL. Todo vive en memoria: no
 * persiste nada en el navegador.
 *
 * Limitación: es una demostración del canal. En producción el aliado entregaría estos datos de servidor a
 * servidor, no en la URL del navegador.
 */
@Injectable({ providedIn: 'root' })
export class ContextoLanzamientoService {
  private readonly router = inject(Router);
  private readonly flujo = inject(FlujoEmbebidoService);
  private readonly aliado = inject(ContextoAliadoService);

  private readonly _cliente = signal<ClienteLanzamiento | null>(null);
  private readonly _aliadoId = signal<string | null>(null);
  private readonly _consentimiento = signal<ConsentimientoOtorgado | null>(null);

  /** Titular de la solicitud; `null` mientras el aliado no haya entregado el contexto. */
  readonly cliente = this._cliente.asReadonly();
  /** Identificador del aliado (`partner_id` del consentimiento). */
  readonly aliadoId = this._aliadoId.asReadonly();
  /** Consentimiento registrado en el paso 1; `null` mientras no se haya otorgado. */
  readonly consentimiento = this._consentimiento.asReadonly();

  /**
   * Lee `?contexto=` de la ruta. Con un contexto válido lo publica y quita el parámetro de la URL; si no
   * llega pero ya se había cargado en esta sesión de la página (p. ej. al volver desde el paso 2) lo da por
   * bueno. Un contexto inválido no publica nada.
   */
  cargarDesde(ruta: ActivatedRoute): ResultadoContexto {
    const valor = ruta.snapshot.queryParamMap.get(PARAMETRO_CONTEXTO);
    if (valor === null) {
      return this._cliente() && this.flujo.solicitud() ? { estado: 'valido' } : { estado: 'ausente' };
    }
    const resultado = this.cargar(valor);
    void this.router.navigate([], {
      relativeTo: ruta,
      queryParams: { [PARAMETRO_CONTEXTO]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    return resultado;
  }

  /** Decodifica, valida y publica el contexto. No toca la URL. */
  cargar(valor: string): ResultadoContexto {
    try {
      const contexto = leerContexto(valor);
      this._cliente.set(contexto.cliente);
      this._aliadoId.set(contexto.aliadoId);
      this._consentimiento.set(null);
      this.flujo.solicitud.set(contexto.solicitud);
      this.aliado.establecer(contexto.aliado);
      return { estado: 'valido' };
    } catch (error) {
      if (error instanceof ContextoInvalido) {
        return { estado: 'invalido', motivo: error.motivo, campo: error.campo };
      }
      throw error;
    }
  }

  /** Deja el comprobante del consentimiento para los pasos siguientes. */
  registrarConsentimiento(consentimiento: ConsentimientoOtorgado): void {
    this._consentimiento.set(consentimiento);
  }
}

interface ContextoLeido {
  aliado: string;
  aliadoId: string;
  solicitud: SolicitudCredito;
  cliente: ClienteLanzamiento;
}

function leerContexto(valor: string): ContextoLeido {
  const raiz = decodificar(valor);
  const aliado = texto(raiz, 'aliado', 1, 80);
  const aliadoId = identificador(raiz, 'aliadoId');
  const banco = texto(raiz, 'banco', 1, 80);

  const datosSolicitud = objeto(raiz, 'solicitud');
  const moneda = texto(datosSolicitud, 'moneda', 3, 3, 'solicitud.moneda');
  if (!(LIMITES_CONTEXTO.monedas as readonly string[]).includes(moneda)) {
    throw new ContextoInvalido('campo', 'solicitud.moneda');
  }
  const solicitud: SolicitudCredito = {
    numero: identificador(datosSolicitud, 'numero', 'solicitud.numero'),
    aliado,
    banco,
    montoAprobado: numero(
      datosSolicitud,
      'montoAprobado',
      LIMITES_CONTEXTO.montoMinimo,
      LIMITES_CONTEXTO.montoMaximo,
      'solicitud.montoAprobado',
    ),
    plazoAnios: numero(
      datosSolicitud,
      'plazoAnios',
      LIMITES_CONTEXTO.plazoMinimoAnios,
      LIMITES_CONTEXTO.plazoMaximoAnios,
      'solicitud.plazoAnios',
      true,
    ),
    cuotaEstimada: numero(datosSolicitud, 'cuotaEstimada', 1, LIMITES_CONTEXTO.montoMaximo, 'solicitud.cuotaEstimada'),
    moneda,
  };

  const datosCliente = objeto(raiz, 'cliente');
  const documento = texto(datosCliente, 'documento', 5, 20, 'cliente.documento');
  const correo = texto(datosCliente, 'correo', 3, 254, 'cliente.correo');
  const nombreCompleto = texto(datosCliente, 'nombreCompleto', 3, 120, 'cliente.nombreCompleto');
  if (!PATRON_DOCUMENTO.test(documento)) {
    throw new ContextoInvalido('campo', 'cliente.documento');
  }
  if (!PATRON_CORREO.test(correo)) {
    throw new ContextoInvalido('campo', 'cliente.correo');
  }
  if (!/\p{L}/u.test(nombreCompleto)) {
    throw new ContextoInvalido('campo', 'cliente.nombreCompleto');
  }
  const cliente: ClienteLanzamiento = {
    id: identificador(datosCliente, 'id', 'cliente.id'),
    nombreCompleto,
    documento,
    correo,
    fechaNacimiento: fechaDeNacimiento(datosCliente),
  };

  return { aliado, aliadoId, solicitud, cliente };
}

/** base64url → JSON. Rechaza lo que no sea un objeto. */
function decodificar(valor: string): Record<string, unknown> {
  if (valor.length > LIMITES_CONTEXTO.tamanoMaximo) {
    throw new ContextoInvalido('demasiado-grande');
  }
  if (!PATRON_BASE64URL.test(valor)) {
    throw new ContextoInvalido('codificacion');
  }
  let json: string;
  try {
    const base64 = valor.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
  } catch {
    throw new ContextoInvalido('codificacion');
  }
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    throw new ContextoInvalido('codificacion');
  }
  if (!esObjeto(datos)) {
    throw new ContextoInvalido('estructura');
  }
  return datos;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function objeto(padre: Record<string, unknown>, clave: string): Record<string, unknown> {
  const valor = padre[clave];
  if (!esObjeto(valor)) {
    throw new ContextoInvalido('campo', clave);
  }
  return valor;
}

function texto(padre: Record<string, unknown>, clave: string, minimo: number, maximo: number, ruta = clave): string {
  const valor = padre[clave];
  if (typeof valor !== 'string') {
    throw new ContextoInvalido('campo', ruta);
  }
  const limpio = valor.trim();
  if (limpio.length < minimo || limpio.length > maximo) {
    throw new ContextoInvalido('campo', ruta);
  }
  return limpio;
}

function identificador(padre: Record<string, unknown>, clave: string, ruta = clave): string {
  const valor = texto(padre, clave, 1, 128, ruta);
  if (!PATRON_IDENTIFICADOR.test(valor)) {
    throw new ContextoInvalido('campo', ruta);
  }
  return valor;
}

function numero(
  padre: Record<string, unknown>,
  clave: string,
  minimo: number,
  maximo: number,
  ruta: string,
  entero = false,
): number {
  const valor = padre[clave];
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new ContextoInvalido('campo', ruta);
  }
  if (entero && !Number.isInteger(valor)) {
    throw new ContextoInvalido('campo', ruta);
  }
  return valor;
}

/** `YYYY-MM-DD` real (el 30 de febrero no existe) y anterior a hoy. */
function fechaDeNacimiento(cliente: Record<string, unknown>): string {
  const ruta = 'cliente.fechaNacimiento';
  const valor = texto(cliente, 'fechaNacimiento', 10, 10, ruta);
  const partes = PATRON_FECHA.exec(valor);
  if (!partes) {
    throw new ContextoInvalido('campo', ruta);
  }
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const real = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!real || anio < 1900 || fecha.getTime() >= Date.now()) {
    throw new ContextoInvalido('campo', ruta);
  }
  return valor;
}
