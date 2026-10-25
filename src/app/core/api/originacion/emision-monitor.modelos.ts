import { HttpErrorResponse } from '@angular/common/http';

import { MotivoFallaCobro } from './cobro.modelos';

/**
 * Modelos del monitoreo de emisiones y excepciones (HU-W1.3-04), tipados según el contrato del backend
 * (`docs/contratos/HU-W1.3-04-api.md`, `services/origination/api/openapi.yaml`). El cliente traduce el JSON
 * (snake_case) a estos tipos (camelCase).
 */

/**
 * Dónde va una emisión, derivado de la aceptación, su cobro y su emisión contractual: `accepted` aceptada sin cobro
 * todavía, `charging` en cobro, `active` póliza activa con el documento o el aviso en camino, `notified` el
 * asegurado ya tiene su documento y su aviso, y `exception` un paso que falló y necesita a un analista.
 */
export type EstadoEmision = 'accepted' | 'charging' | 'active' | 'notified' | 'exception';

export const ESTADOS_EMISION: readonly EstadoEmision[] = ['accepted', 'charging', 'active', 'notified', 'exception'];

/** Dónde aceptó el cliente. El aliado o el asesor no se guardan en la aceptación. */
export type CanalEmision = 'web' | 'mobile';

export const CANALES_EMISION: readonly CanalEmision[] = ['web', 'mobile'];

/** Paso del recorrido en el que está la emisión o, si es una excepción, en el que falló. */
export type PasoEmision =
  | 'underwriting'
  | 'awaiting_payment_method'
  | 'premium_charge'
  | 'contract_document'
  | 'notification'
  | 'completed';

/** Por qué una emisión es una excepción: los del cobro más los de la emisión contractual. */
export type MotivoEmision = MotivoFallaCobro | 'document_generation_failed' | 'notification_failed';

/** Una aceptación en camino a una póliza activa. Las fechas son RFC 3339 en UTC. */
export interface Emision {
  aceptacionId: string;
  ofertaId: string;
  clienteId: string;
  /** Titular, si originación lo conoce. */
  nombreCliente: string | null;
  canal: CanalEmision;
  estado: EstadoEmision;
  paso: PasoEmision;
  aceptadaEn: string;
  actualizadaEn: string;
  /** Prima en unidades de la moneda; `null` mientras la emisión solo está aceptada. */
  monto: number | null;
  moneda: string | null;
  intentos: number;
  /** Póliza activada; solo con el cobro confirmado. */
  polizaId: string | null;
  /** Motivo de la excepción; solo con `estado: exception`. */
  motivo: MotivoEmision | null;
  fallaEn: string | null;
  notificadaEn: string | null;
  /** Excepción que lleva 30 minutos o más sin que un analista la reanude (el servidor lo calcula). */
  sinAtender: boolean;
  reanudaciones: number;
  ultimaReanudacionEn: string | null;
  ultimaReanudacionPor: string | null;
}

/** Lo que se reintentó: `resume` el cobro de la prima, `retry` la emisión contractual (documento o aviso). */
export type TipoAccionEmision = 'resume' | 'retry';

/** Acción de un analista sobre una emisión. */
export interface AccionEmision {
  id: number;
  accion: TipoAccionEmision;
  /** `sub` del token del analista. */
  autor: string;
  nota: string;
  creadaEn: string;
}

/** Filtros de la vista. Las fechas son de calendario (`AAAA-MM-DD`) en la zona horaria del usuario. */
export interface FiltroEmisiones {
  estado: EstadoEmision | null;
  canal: CanalEmision | null;
  desde: string | null;
  hasta: string | null;
}

/** Tarjetas de arriba: cubren todas las emisiones, sin importar los filtros de la lista. */
export interface ConteosEmisiones {
  aceptadas: number;
  enCobro: number;
  enCobroConReintentos: number;
  activasHoy: number;
  notificadasHoy: number;
  enExcepcion: number;
  sinAtender: number;
}

export interface ListaEmisiones {
  emisiones: readonly Emision[];
  conteos: ConteosEmisiones;
}

/** Resultado de reintentar: qué se reintentó. */
export interface ReintentoEmision {
  aceptacionId: string;
  accion: TipoAccionEmision;
}

export interface EmisionDto {
  acceptance_id: string;
  offer_id: string;
  customer_id: string;
  customer_name: string | null;
  channel: CanalEmision;
  status: EstadoEmision;
  step: PasoEmision;
  accepted_at: string;
  updated_at: string;
  amount: number | null;
  currency: string | null;
  attempts: number;
  policy_id: string | null;
  reason: MotivoEmision | null;
  failed_at: string | null;
  notified_at: string | null;
  unattended: boolean;
  resume_count: number;
  last_resumed_at: string | null;
  last_resumed_by: string | null;
}

export interface ConteosEmisionesDto {
  accepted: number;
  charging: number;
  charging_with_retries: number;
  active_today: number;
  notified_today: number;
  exceptions: number;
  unattended: number;
}

export interface ListaEmisionesDto {
  items: EmisionDto[];
  counts: ConteosEmisionesDto;
}

export interface ReintentoEmisionDto {
  acceptance_id: string;
  action: TipoAccionEmision;
}

export interface AccionEmisionDto {
  id: number;
  action: TipoAccionEmision;
  actor: string;
  note: string;
  created_at: string;
}

export interface ListaAccionesDto {
  items: AccionEmisionDto[];
}

export function mapearEmision(dto: EmisionDto): Emision {
  return {
    aceptacionId: dto.acceptance_id,
    ofertaId: dto.offer_id,
    clienteId: dto.customer_id,
    nombreCliente: dto.customer_name,
    canal: dto.channel,
    estado: dto.status,
    paso: dto.step,
    aceptadaEn: dto.accepted_at,
    actualizadaEn: dto.updated_at,
    monto: dto.amount,
    moneda: dto.currency,
    intentos: dto.attempts,
    polizaId: dto.policy_id,
    motivo: dto.reason,
    fallaEn: dto.failed_at,
    notificadaEn: dto.notified_at,
    sinAtender: dto.unattended,
    reanudaciones: dto.resume_count,
    ultimaReanudacionEn: dto.last_resumed_at,
    ultimaReanudacionPor: dto.last_resumed_by,
  };
}

export function mapearListaEmisiones(dto: ListaEmisionesDto): ListaEmisiones {
  return {
    emisiones: dto.items.map(mapearEmision),
    conteos: {
      aceptadas: dto.counts.accepted,
      enCobro: dto.counts.charging,
      enCobroConReintentos: dto.counts.charging_with_retries,
      activasHoy: dto.counts.active_today,
      notificadasHoy: dto.counts.notified_today,
      enExcepcion: dto.counts.exceptions,
      sinAtender: dto.counts.unattended,
    },
  };
}

export function mapearReintento(dto: ReintentoEmisionDto): ReintentoEmision {
  return { aceptacionId: dto.acceptance_id, accion: dto.action };
}

/**
 * Qué decir en «Último paso»: la clave del texto (`originacion.emisiones.pasos.<clave>`) y el número de intentos
 * cuando el texto lo usa. Sale del estado, el paso y el motivo; lo que el backend no sabe, como el código que
 * devolvió el banco, no se inventa.
 */
export function ultimoPaso(e: Emision): { clave: string; intentos: number } {
  const intentos = e.intentos;
  if (e.estado === 'exception' && e.motivo) {
    return { clave: e.motivo, intentos };
  }
  switch (e.paso) {
    case 'underwriting':
      return { clave: 'underwriting', intentos };
    case 'awaiting_payment_method':
      return { clave: 'awaiting_payment_method', intentos };
    case 'premium_charge':
      return { clave: intentos > 0 ? 'premium_charge_retrying' : 'premium_charge', intentos };
    case 'contract_document':
      return { clave: 'contract_document', intentos };
    case 'notification':
      return { clave: 'notification', intentos };
    case 'completed':
      return { clave: 'completed', intentos };
  }
}

export function mapearListaAcciones(dto: ListaAccionesDto): readonly AccionEmision[] {
  return dto.items.map((a) => ({
    id: a.id,
    accion: a.action,
    autor: a.actor,
    nota: a.note,
    creadaEn: a.created_at,
  }));
}

const FECHA_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Inicio (`fin: false`) o fin (`fin: true`) de un día de calendario en la zona horaria local, en RFC 3339 UTC. */
export function limiteDelDia(fecha: string, fin: boolean): string | null {
  const partes = FECHA_CALENDARIO.exec(fecha);
  if (!partes) {
    return null;
  }
  const [, anio, mes, dia] = partes.map(Number);
  const limite = fin
    ? new Date(anio, mes - 1, dia, 23, 59, 59, 999)
    : new Date(anio, mes - 1, dia, 0, 0, 0, 0);
  return Number.isNaN(limite.getTime()) ? null : limite.toISOString();
}

/** Parámetros de consulta del contrato para un filtro; lo vacío no se envía. */
export function aParametrosEmisiones(filtro: FiltroEmisiones, hoy: Date = new Date()): Record<string, string> {
  // El inicio del día del analista, para que «hoy» de las tarjetas sea el suyo y no el del servidor.
  const params: Record<string, string> = {
    day_from: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString(),
  };
  if (filtro.estado) {
    params['status'] = filtro.estado;
  }
  if (filtro.canal) {
    params['channel'] = filtro.canal;
  }
  const desde = filtro.desde ? limiteDelDia(filtro.desde, false) : null;
  if (desde) {
    params['from'] = desde;
  }
  const hasta = filtro.hasta ? limiteDelDia(filtro.hasta, true) : null;
  if (hasta) {
    params['to'] = hasta;
  }
  return params;
}

/** El rango es válido cuando alguno de los extremos falta o la fecha inicial no es posterior a la final. */
export function rangoValido(filtro: FiltroEmisiones): boolean {
  return !filtro.desde || !filtro.hasta || filtro.desde <= filtro.hasta;
}

/** Códigos estables del catálogo de errores. La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorEmision =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  /** La emisión no existe o aún no tiene cobro ni emisión contractual que reintentar. */
  | 'issuance_not_found'
  /** Otro analista, o el proceso automático, ya reintentó lo que falló, o nada está fallido. */
  | 'issuance_not_retryable'
  | 'charge_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'issuance_not_found',
  'issuance_not_retryable',
  'charge_unavailable',
];

function esCodigoError(valor: unknown): valor is CodigoErrorEmision {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Error del monitoreo, con el código estable del contrato. */
export class ErrorEmision extends Error {
  constructor(readonly codigo: CodigoErrorEmision) {
    super(`Error del monitoreo de emisiones: ${codigo}`);
    this.name = 'ErrorEmision';
  }
}

/** Traduce un error HTTP al código del contrato; sin cuerpo JSON (red o 5xx del gateway) es `charge_unavailable`. */
export function traducirErrorEmision(error: unknown): ErrorEmision {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorEmision('charge_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (esCodigoError(codigo)) {
      return new ErrorEmision(codigo);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorEmision('invalid_request');
    case 401:
      return new ErrorEmision('unauthorized');
    case 403:
      return new ErrorEmision('forbidden');
    case 404:
      return new ErrorEmision('issuance_not_found');
    case 409:
      return new ErrorEmision('issuance_not_retryable');
    default:
      return new ErrorEmision('charge_unavailable');
  }
}
