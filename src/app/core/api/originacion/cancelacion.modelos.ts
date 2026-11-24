import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la cancelación de una póliza a solicitud del asegurado con reembolso prorrateado (HU-W1.6-01, pantallas A5 y
 * A5b), tipados según `services/origination/api/openapi.yaml` 0.20.0 y su contrato para el front (`HU-W1.6-01-api.md`).
 * Las fechas son RFC 3339 en UTC; los montos, en pesos.
 */

/** Motivos de la lista fija (decisión D-9 a), en el orden de la pantalla. */
export const MOTIVOS_CANCELACION = [
  'property_sold',
  'mortgage_paid',
  'better_offer',
  'no_longer_needed',
  'financial_reasons',
  'other',
] as const;

export type MotivoCancelacion = (typeof MOTIVOS_CANCELACION)[number];

/** Tope de los comentarios opcionales, en caracteres. */
export const MAX_COMENTARIOS_CANCELACION = 500;

/**
 * Dónde está el reembolso: `not_applicable` si no había nada pagado que devolver; `in_process` registrado y enviándose a
 * la pasarela; `completed` confirmado por la pasarela; `failed` rechazado o sin respuesta dentro de la ventana.
 */
export type EstadoReembolso = 'not_applicable' | 'in_process' | 'completed' | 'failed';

/** El mes de la prima sobre el que se calcula el reembolso, [inicio, fin). */
export interface PeriodoPagado {
  mes: number;
  /** El mes 1 lo paga la emisión; los demás, una cuota. */
  tipo: 'issuance' | 'installment';
  inicio: string;
  fin: string;
  /** Lo efectivamente pagado por el mes; 0 si no se pagó. */
  montoPagado: number;
  moneda: string;
}

/** A dónde vuelve el dinero: el medio de pago de la emisión, sin su token. */
export interface MedioReembolso {
  tipo: 'card' | 'pse';
  marca: string | null;
  ultimosCuatro: string | null;
  codigoBanco: string | null;
}

/** El cálculo que A5 muestra antes de confirmar (CA-1). */
export interface CotizacionCancelacion {
  polizaId: string;
  /** El final del día en hora de Colombia: cuando termina la cobertura. */
  efectivaEn: string;
  periodoPagado: PeriodoPagado;
  diasNoUtilizados: number;
  diasPeriodo: number;
  /** Días no utilizados sobre los del periodo, en porcentaje con un decimal. */
  porcentajeProrrateo: number;
  montoReembolso: number;
  moneda: string;
  medioReembolso: MedioReembolso | null;
  /** `payment_pending` mientras una cuota está en gracia: no hay nada pagado que devolver. */
  estadoPago: 'up_to_date' | 'payment_pending';
}

/** Lo que el asegurado confirma (CA-2). */
export interface SolicitudCancelacion {
  motivo: MotivoCancelacion;
  comentarios: string | null;
  /** El monto que vio: es el que se registra. */
  montoReembolso: number;
}

/** El reembolso registrado con la cancelación (CA-2): monto, fecha y medio de pago, y el cálculo que lo respalda. */
export interface DetalleReembolso {
  /** `REF-AAAA-NNNNN`; `null` si no hay nada que reembolsar. */
  referencia: string | null;
  monto: number;
  moneda: string;
  medio: MedioReembolso | null;
  registradoEn: string;
  /** Cuando la pasarela lo confirmó; `null` mientras tanto. */
  completadoEn: string | null;
  periodoPagado: PeriodoPagado;
  diasNoUtilizados: number;
  diasPeriodo: number;
  porcentajeProrrateo: number;
}

/** Respuestas crudas del contrato (snake_case). */
export interface PeriodoPagadoDto {
  month: number;
  kind: 'issuance' | 'installment';
  start: string;
  end: string;
  paid_amount: number;
  currency: string;
}

export interface MedioReembolsoDto {
  method: 'card' | 'pse';
  brand: string | null;
  last4: string | null;
  bank_code: string | null;
}

export interface CotizacionCancelacionDto {
  policy_id: string;
  effective_at: string;
  paid_period: PeriodoPagadoDto;
  unused_days: number;
  period_days: number;
  prorate_percent: number;
  refund_amount: number;
  currency: string;
  refund_method: MedioReembolsoDto | null;
  payment_status: 'up_to_date' | 'payment_pending';
}

export interface DetalleReembolsoDto {
  reference: string | null;
  amount: number;
  currency: string;
  method: MedioReembolsoDto | null;
  registered_at: string;
  completed_at: string | null;
  paid_period: PeriodoPagadoDto;
  unused_days: number;
  period_days: number;
  prorate_percent: number;
}

export interface SolicitudCancelacionDto {
  reason: MotivoCancelacion;
  comments: string | null;
  refund_amount: number;
  accept_terms: true;
}

function mapearPeriodo(dto: PeriodoPagadoDto): PeriodoPagado {
  return {
    mes: dto.month,
    tipo: dto.kind,
    inicio: dto.start,
    fin: dto.end,
    montoPagado: dto.paid_amount,
    moneda: dto.currency,
  };
}

function mapearMedio(dto: MedioReembolsoDto | null): MedioReembolso | null {
  return dto
    ? { tipo: dto.method, marca: dto.brand, ultimosCuatro: dto.last4, codigoBanco: dto.bank_code }
    : null;
}

export function mapearCotizacionCancelacion(dto: CotizacionCancelacionDto): CotizacionCancelacion {
  return {
    polizaId: dto.policy_id,
    efectivaEn: dto.effective_at,
    periodoPagado: mapearPeriodo(dto.paid_period),
    diasNoUtilizados: dto.unused_days,
    diasPeriodo: dto.period_days,
    porcentajeProrrateo: dto.prorate_percent,
    montoReembolso: dto.refund_amount,
    moneda: dto.currency,
    medioReembolso: mapearMedio(dto.refund_method),
    estadoPago: dto.payment_status,
  };
}

export function mapearDetalleReembolso(dto: DetalleReembolsoDto | null | undefined): DetalleReembolso | null {
  if (!dto) {
    return null;
  }
  return {
    referencia: dto.reference,
    monto: dto.amount,
    moneda: dto.currency,
    medio: mapearMedio(dto.method),
    registradoEn: dto.registered_at,
    completadoEn: dto.completed_at,
    periodoPagado: mapearPeriodo(dto.paid_period),
    diasNoUtilizados: dto.unused_days,
    diasPeriodo: dto.period_days,
    porcentajeProrrateo: dto.prorate_percent,
  };
}

/** La confirmación: la casilla de «cancelación definitiva» ya está marcada cuando se envía. */
export function aSolicitudCancelacionDto(s: SolicitudCancelacion): SolicitudCancelacionDto {
  const comentarios = s.comentarios?.trim() ?? '';
  return {
    reason: s.motivo,
    comments: comentarios === '' ? null : comentarios,
    refund_amount: s.montoReembolso,
    accept_terms: true,
  };
}

/** Códigos estables de la cancelación. */
export type CodigoErrorCancelacion =
  | 'policy_not_found'
  | 'policy_not_in_force'
  | 'policy_already_cancelled'
  | 'renewal_in_progress'
  | 'payment_in_progress'
  | 'refund_changed'
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'cancellation_unavailable';

const CONFLICTOS: readonly CodigoErrorCancelacion[] = [
  'policy_not_in_force',
  'policy_already_cancelled',
  'renewal_in_progress',
  'payment_in_progress',
];

/** Error de la cancelación, con el código del contrato y, si cambió el monto, la cotización nueva. */
export class ErrorCancelacion extends Error {
  constructor(
    readonly codigo: CodigoErrorCancelacion,
    readonly cotizacion: CotizacionCancelacion | null = null,
  ) {
    super(`Error de la cancelación: ${codigo}`);
    this.name = 'ErrorCancelacion';
  }
}

/** Traduce un error HTTP de la cotización o de la confirmación. */
export function traducirErrorCancelacion(error: unknown): ErrorCancelacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorCancelacion('cancellation_unavailable');
  }
  const cuerpo = (error.error ?? {}) as { error?: string; quote?: CotizacionCancelacionDto };
  switch (error.status) {
    case 400:
    case 422:
      return new ErrorCancelacion('invalid_request');
    case 401:
      return new ErrorCancelacion('unauthorized');
    case 403:
      return new ErrorCancelacion('forbidden');
    case 404:
      return new ErrorCancelacion('policy_not_found');
    case 409:
      if (cuerpo.error === 'refund_changed' && cuerpo.quote) {
        return new ErrorCancelacion('refund_changed', mapearCotizacionCancelacion(cuerpo.quote));
      }
      return new ErrorCancelacion(
        CONFLICTOS.find((c) => c === cuerpo.error) ?? 'cancellation_unavailable',
      );
    default:
      return new ErrorCancelacion('cancellation_unavailable');
  }
}
