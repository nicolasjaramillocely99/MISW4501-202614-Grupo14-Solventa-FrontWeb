import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos del cobro de la prima del servicio de originación (HA-D02), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.7.0) y su contrato para el front (`HA-D02-api.md`).
 * El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/**
 * Estado del cobro: `pending` esperando su próximo intento (el primero o un reintento porque la pasarela no
 * respondió); `in_progress` un intento en curso; `confirmed` cobrado y cobertura activa; `failed` excepción de
 * emisión hasta que operaciones lo reanude.
 */
export type EstadoCobro = 'pending' | 'in_progress' | 'confirmed' | 'failed';

/** Por qué el cobro terminó en excepción: la ventana de reintentos venció o la pasarela lo rechazó. */
export type MotivoFallaCobro =
  | 'retry_window_expired'
  | 'payment_rejected'
  /** La ventana venció sin que el cliente entregara un medio de pago: nunca se intentó cobrar. */
  | 'payment_method_missing';

/** Cómo paga el cliente la prima (E4). */
export type TipoMedioDePago = 'card' | 'pse';

/**
 * Quién paga, lo que PSE le pregunta al banco antes de poder tomar el débito.
 * Solo aplica a PSE; con tarjeta es `null`.
 */
export type TipoDePersona = 'natural' | 'legal';

/**
 * Medio de pago que el cliente entregó en E4.
 *
 * El número de tarjeta nunca está aquí ni llega a nuestro backend: el navegador
 * lo tokeniza contra la pasarela y solo viajan el token, la marca y los últimos
 * cuatro dígitos.
 */
export interface MedioDePago {
  tipo: TipoMedioDePago;
  marca: string | null;
  ultimosCuatro: string | null;
  cuotas: number;
  codigoBanco: string | null;
  tipoDePersona: TipoDePersona | null;
  capturadoEn: string;
}

/** Ventana de reintentos automáticos (24 h desde que se inició el cobro o se reanudó). */
export interface VentanaReintentos {
  iniciaEn: string;
  terminaEn: string | null;
}

/** Cobro de la prima de una aceptación. Las fechas son RFC 3339 en UTC. */
export interface Cobro {
  aceptacionId: string;
  ofertaId: string;
  clienteId: string;
  aceptadaEn: string;
  estado: EstadoCobro;
  /** Clave determinística que viaja en cada intento (`cobro-<aceptación>`): garantiza un único cobro. */
  claveIdempotencia: string;
  /** Prima en unidades de la moneda. */
  monto: number;
  moneda: string;
  /** Intentos sin respuesta en la ventana actual. */
  intentos: number;
  ultimoIntentoEn: string | null;
  ultimaFallaEn: string | null;
  /** Próximo reintento automático; `null` cuando el cobro terminó. */
  proximoIntentoEn: string | null;
  ventana: VentanaReintentos;
  motivoFalla: MotivoFallaCobro | null;
  /**
   * Código del emisor cuando la pasarela rechazó el cobro (`51` son fondos
   * insuficientes). Viaja el código y no la frase: la redacción es de esta
   * pantalla, no del backend.
   */
  codigoRechazo: string | null;
  /** Identificador de la pasarela para este cobro, aprobado o rechazado. Es el que el cliente cita ante su banco. */
  referenciaPasarela: string | null;
  /** Hasta cuándo vale la oferta detrás de la aceptación; lo que E4c le dice al cliente que le queda. */
  ofertaVigenteHasta: string | null;
  confirmadoEn: string | null;
  /** Póliza de la cobertura activada; `null` hasta confirmar el pago. Con ella se abre la póliza emitida (E5). */
  polizaId: string | null;
  coberturaActivadaEn: string | null;
  activacionPublicadaEn: string | null;
  reanudaciones: number;
  /**
   * Medio de pago, o `null` mientras el cliente no haya entregado uno.
   *
   * **Es el campo que decide qué pantalla se pinta**, y no se deduce de
   * `intentos` ni de `proximoIntentoEn`: esperando la tarjeta (E4) y la
   * pasarela fallando (E4b) son los dos `pending`.
   */
  medioDePago: MedioDePago | null;
  /** Cuántos medios de pago entregó el cliente. No es `intentos`, que son los de la pasarela. */
  intentoDePago: number;
  actualizadoEn: string;
}

/** Respuesta cruda del contrato (snake_case). */
export interface MedioDePagoDto {
  method: TipoMedioDePago;
  brand: string | null;
  last4: string | null;
  installments: number;
  bank_code: string | null;
  payer_type: TipoDePersona | null;
  captured_at: string;
}

export interface CobroDto {
  acceptance_id: string;
  offer_id: string;
  customer_id: string;
  accepted_at: string;
  status: EstadoCobro;
  idempotency_key: string;
  amount: number;
  currency: string;
  attempts: number;
  last_attempt_at: string | null;
  last_failure_at: string | null;
  next_attempt_at: string | null;
  retry_window: { started_at: string; ends_at: string | null };
  failure_reason: MotivoFallaCobro | null;
  decline_code: string | null;
  provider_reference: string | null;
  offer_expires_at: string | null;
  confirmed_at: string | null;
  policy_id: string | null;
  coverage_activated_at: string | null;
  activation_published_at: string | null;
  resume_count: number;
  payment_method: MedioDePagoDto | null;
  payment_attempt: number;
  updated_at: string;
}

/** Traduce la respuesta del contrato al modelo del cliente. */
export function mapearCobro(dto: CobroDto): Cobro {
  return {
    aceptacionId: dto.acceptance_id,
    ofertaId: dto.offer_id,
    clienteId: dto.customer_id,
    aceptadaEn: dto.accepted_at,
    estado: dto.status,
    claveIdempotencia: dto.idempotency_key,
    monto: dto.amount,
    moneda: dto.currency,
    intentos: dto.attempts,
    ultimoIntentoEn: dto.last_attempt_at,
    ultimaFallaEn: dto.last_failure_at,
    proximoIntentoEn: dto.next_attempt_at,
    ventana: { iniciaEn: dto.retry_window.started_at, terminaEn: dto.retry_window.ends_at },
    motivoFalla: dto.failure_reason,
    codigoRechazo: dto.decline_code ?? null,
    referenciaPasarela: dto.provider_reference ?? null,
    ofertaVigenteHasta: dto.offer_expires_at ?? null,
    confirmadoEn: dto.confirmed_at,
    polizaId: dto.policy_id,
    coberturaActivadaEn: dto.coverage_activated_at,
    activacionPublicadaEn: dto.activation_published_at,
    reanudaciones: dto.resume_count,
    medioDePago: dto.payment_method
      ? {
          tipo: dto.payment_method.method,
          marca: dto.payment_method.brand,
          ultimosCuatro: dto.payment_method.last4,
          cuotas: dto.payment_method.installments,
          codigoBanco: dto.payment_method.bank_code,
          tipoDePersona: dto.payment_method.payer_type ?? null,
          capturadoEn: dto.payment_method.captured_at,
        }
      : null,
    intentoDePago: dto.payment_attempt,
    actualizadoEn: dto.updated_at,
  };
}

/** El seguimiento termina cuando el cobro falla o queda confirmado con su póliza. */
export function esCobroFinal(cobro: Cobro): boolean {
  return cobro.estado === 'failed' || (cobro.estado === 'confirmed' && cobro.polizaId !== null);
}

/** Códigos estables del catálogo de errores. La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorCobro =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'charge_not_found'
  /** El cobro ya no admite otro medio de pago: se está cobrando, se confirmó o solo operaciones puede reanudarlo. */
  | 'charge_not_payable'
  | 'charge_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'charge_not_payable',
  'invalid_request',
  'unauthorized',
  'forbidden',
  'charge_not_found',
  'charge_unavailable',
];

function esCodigoError(valor: unknown): valor is CodigoErrorCobro {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Error de la consulta del cobro, con el código estable del contrato. */
export class ErrorCobro extends Error {
  constructor(readonly codigo: CodigoErrorCobro) {
    super(`Error del cobro: ${codigo}`);
    this.name = 'ErrorCobro';
  }
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se
 * trata como `charge_unavailable`: el cobro sigue su curso en el backend y se vuelve a consultar.
 */
export function traducirErrorCobro(error: unknown): ErrorCobro {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorCobro('charge_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (esCodigoError(codigo)) {
      return new ErrorCobro(codigo);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorCobro('invalid_request');
    case 401:
      return new ErrorCobro('unauthorized');
    case 403:
      return new ErrorCobro('forbidden');
    case 404:
      return new ErrorCobro('charge_not_found');
    default:
      return new ErrorCobro('charge_unavailable');
  }
}

/**
 * Medio de pago que E4 entrega a originación.
 *
 * Para una tarjeta lleva el **token** que devolvió la pasarela, nunca el
 * número: el navegador tokeniza antes y a Solventa solo llega el token con la
 * marca y los últimos cuatro.
 */
export type MedioDePagoNuevo =
  | { tipo: 'card'; token: string; marca: string; ultimosCuatro: string; cuotas: number }
  | { tipo: 'pse'; codigoBanco: string; tipoDePersona: TipoDePersona };

/** Cuerpo del contrato (snake_case) para entregar el medio de pago. */
export function aCuerpoMedioDePago(medio: MedioDePagoNuevo): Record<string, unknown> {
  if (medio.tipo === 'pse') {
    return { method: 'pse', bank_code: medio.codigoBanco, payer_type: medio.tipoDePersona };
  }
  return {
    method: 'card',
    payment_token: medio.token,
    brand: medio.marca,
    last4: medio.ultimosCuatro,
    installments: medio.cuotas,
  };
}
