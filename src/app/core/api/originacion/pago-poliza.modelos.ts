import {
  DetalleReembolso,
  DetalleReembolsoDto,
  EstadoReembolso,
  MotivoCancelacion,
  mapearDetalleReembolso,
} from './cancelacion.modelos';

/**
 * Modelos de la prima mensual de una póliza y su cancelación por no pago (HU-W1.6-02), tipados según
 * `services/origination/api/openapi.yaml` 0.17.0 y su contrato para el front (`HU-W1.6-02-api.md`). Las fechas son
 * RFC 3339 en UTC. HU-W1.6-01 (0.20.0): la cancelación también puede ser a solicitud del asegurado, con su reembolso.
 */

/**
 * Cómo está la prima: `up_to_date` sin cuotas pendientes; `payment_pending` una cuota venció sin pago y la póliza está en
 * su periodo de gracia, con cobertura; `cancelled` cancelada por no pago.
 */
export type EstadoPago = 'up_to_date' | 'payment_pending' | 'cancelled';

/** La cuota que venció sin pago, mientras la póliza está en gracia. */
export interface CuotaPendiente {
  /** Mes de la prima (el 1 es la emisión). */
  mes: number;
  venceEn: string;
  graciaHasta: string;
  /** Si sigue sin pago, la póliza se cancela en este momento. */
  cancelaEn: string;
  monto: number;
  moneda: string;
  /** Intentos rechazados. */
  intentos: number;
  /** Próximo cobro; `null` cuando ya no quedan intentos. */
  proximoIntentoEn: string | null;
}

export interface PagoPoliza {
  estado: EstadoPago;
  /** Próximo vencimiento, mientras está al día. */
  proximoVencimiento: string | null;
  pendiente: CuotaPendiente | null;
}

/** Cancelación por no pago: nunca hay reembolso. */
export interface CancelacionPorNoPago {
  motivo: 'non_payment';
  canceladaEn: string;
  /** Cuando terminó la cobertura: la misma cancelación. */
  efectivaEn: string;
  /** La cuota que no se pagó. */
  mes: number;
  venceEn: string;
  graciaHasta: string;
  monto: number;
  moneda: string;
  intentos: number;
  /** Cuándo salió el correo al asegurado; `null` mientras no ha salido. */
  correoEnviadoEn: string | null;
}

/** Cancelación a solicitud del asegurado (HU-W1.6-01), con el reembolso de lo pagado del mes en curso sin usar. */
export interface CancelacionAPedido {
  motivo: 'insured_request';
  canceladaEn: string;
  /** El final del día de la cancelación: cuando terminó la cobertura. */
  efectivaEn: string;
  moneda: string;
  reembolso: EstadoReembolso;
  detalleReembolso: DetalleReembolso | null;
  motivoAsegurado: { codigo: MotivoCancelacion; comentarios: string | null };
}

export type CancelacionPoliza = CancelacionPorNoPago | CancelacionAPedido;

/** Un intento de cobro de una cuota. */
export interface IntentoCobro {
  intento: number;
  resultado: 'approved' | 'declined';
  /** Motivo del emisor (51: fondos insuficientes) o `no_payment_method` si no hay tarjeta. */
  codigoRechazo: string | null;
  intentadoEn: string;
}

/** Un mes de la prima: la emisión (mes 1) o una cuota. */
export interface MesPrima {
  mes: number;
  tipo: 'issuance' | 'installment';
  estado: 'paid' | 'pending' | 'unpaid';
  venceEn: string;
  monto: number;
  moneda: string;
  pagadoEn: string | null;
  intentos: IntentoCobro[];
}

/** Respuestas crudas del contrato (snake_case). */
export interface PagoPolizaDto {
  status: EstadoPago;
  next_due_at: string | null;
  pending: {
    month: number;
    due_at: string;
    grace_ends_at: string;
    cancels_at: string;
    amount: number;
    currency: string;
    attempts: number;
    next_attempt_at: string | null;
  } | null;
}

/** Los campos de la cuota impaga son nulos para una cancelación a solicitud del asegurado, y al revés. */
export interface CancelacionPolizaDto {
  reason: 'non_payment' | 'insured_request';
  cancelled_at: string;
  /** Desde 0.20.0; una respuesta anterior no lo trae. */
  effective_at?: string;
  refund: EstadoReembolso;
  month: number | null;
  due_at: string | null;
  grace_ends_at: string | null;
  amount: number | null;
  currency: string;
  attempts: number | null;
  email_sent_at: string | null;
  refund_detail?: DetalleReembolsoDto | null;
  insured_reason?: { code: MotivoCancelacion; comments: string | null } | null;
}

export interface MesPrimaDto {
  month: number;
  kind: 'issuance' | 'installment';
  status: 'paid' | 'pending' | 'unpaid';
  due_at: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  attempts: {
    attempt: number;
    outcome: 'approved' | 'declined';
    decline_code: string | null;
    attempted_at: string;
  }[];
}

export function mapearPago(dto: PagoPolizaDto | null | undefined): PagoPoliza | null {
  if (!dto) {
    return null;
  }
  const p = dto.pending;
  return {
    estado: dto.status,
    proximoVencimiento: dto.next_due_at,
    pendiente: p
      ? {
          mes: p.month,
          venceEn: p.due_at,
          graciaHasta: p.grace_ends_at,
          cancelaEn: p.cancels_at,
          monto: p.amount,
          moneda: p.currency,
          intentos: p.attempts,
          proximoIntentoEn: p.next_attempt_at,
        }
      : null,
  };
}

export function mapearCancelacion(
  dto: CancelacionPolizaDto | null | undefined,
): CancelacionPoliza | null {
  if (!dto) {
    return null;
  }
  const efectivaEn = dto.effective_at ?? dto.cancelled_at;
  if (dto.reason === 'insured_request') {
    return {
      motivo: 'insured_request',
      canceladaEn: dto.cancelled_at,
      efectivaEn,
      moneda: dto.currency,
      reembolso: dto.refund,
      detalleReembolso: mapearDetalleReembolso(dto.refund_detail),
      motivoAsegurado: {
        codigo: dto.insured_reason?.code ?? 'other',
        comentarios: dto.insured_reason?.comments ?? null,
      },
    };
  }
  return {
    motivo: 'non_payment',
    canceladaEn: dto.cancelled_at,
    efectivaEn,
    mes: dto.month ?? 0,
    venceEn: dto.due_at ?? dto.cancelled_at,
    graciaHasta: dto.grace_ends_at ?? dto.cancelled_at,
    monto: dto.amount ?? 0,
    moneda: dto.currency,
    intentos: dto.attempts ?? 0,
    correoEnviadoEn: dto.email_sent_at,
  };
}

export function mapearMes(dto: MesPrimaDto): MesPrima {
  return {
    mes: dto.month,
    tipo: dto.kind,
    estado: dto.status,
    venceEn: dto.due_at,
    monto: dto.amount,
    moneda: dto.currency,
    pagadoEn: dto.paid_at,
    intentos: dto.attempts.map((a) => ({
      intento: a.attempt,
      resultado: a.outcome,
      codigoRechazo: a.decline_code,
      intentadoEn: a.attempted_at,
    })),
  };
}
