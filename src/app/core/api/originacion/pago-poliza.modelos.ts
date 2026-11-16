/**
 * Modelos de la prima mensual de una póliza y su cancelación por no pago (HU-W1.6-02), tipados según
 * `services/origination/api/openapi.yaml` 0.17.0 y su contrato para el front (`HU-W1.6-02-api.md`). Las fechas son
 * RFC 3339 en UTC.
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
export interface CancelacionPoliza {
  motivo: 'non_payment';
  canceladaEn: string;
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

export interface CancelacionPolizaDto {
  reason: 'non_payment';
  cancelled_at: string;
  refund: 'not_applicable';
  month: number;
  due_at: string;
  grace_ends_at: string;
  amount: number;
  currency: string;
  attempts: number;
  email_sent_at: string | null;
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
  return {
    motivo: dto.reason,
    canceladaEn: dto.cancelled_at,
    mes: dto.month,
    venceEn: dto.due_at,
    graciaHasta: dto.grace_ends_at,
    monto: dto.amount,
    moneda: dto.currency,
    intentos: dto.attempts,
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
