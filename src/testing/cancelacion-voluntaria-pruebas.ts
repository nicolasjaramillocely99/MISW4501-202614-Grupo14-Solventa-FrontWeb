import { CotizacionCancelacionDto, DetalleReembolsoDto } from '@core/api/originacion/cancelacion.modelos';
import { DetallePolizaDto } from '@core/api/originacion/detalle-poliza.modelos';
import { CancelacionPolizaDto } from '@core/api/originacion/pago-poliza.modelos';
import { PolizaListadaDto } from '@core/api/originacion/renovacion.modelos';

import { DETALLE_AL_DIA_DTO, POLIZA_AL_DIA_DTO } from './cancelacion-pruebas';

/**
 * Cancelación a solicitud del asegurado de HU-W1.6-01 según `docs/contratos/HU-W1.6-01-api.md`: la póliza al día de
 * HU-W1.6-02 (pol-acc-4f2a, vida hipotecario, prima mensual de $ 142.300) cancelada el 03/12/2026 con 14 de 30 días sin
 * usar (46,7 %, $ 66.406), y sus variantes.
 */

export const POLIZA_A_CANCELAR = POLIZA_AL_DIA_DTO.policy_id;

const PERIODO = {
  month: 1,
  kind: 'issuance' as const,
  start: '2026-11-18T15:00:00Z',
  end: '2026-12-18T15:00:00Z',
  paid_amount: 142300,
  currency: 'COP',
};

const VISA = { method: 'card' as const, brand: 'visa', last4: '1111', bank_code: null };

export const COTIZACION_CANCELACION_DTO: CotizacionCancelacionDto = {
  policy_id: POLIZA_A_CANCELAR,
  effective_at: '2026-12-04T04:59:59Z',
  paid_period: PERIODO,
  unused_days: 14,
  period_days: 30,
  prorate_percent: 46.7,
  refund_amount: 66406,
  currency: 'COP',
  refund_method: VISA,
  payment_status: 'up_to_date',
};

/** Al día siguiente: un día menos sin usar (el 409 `refund_changed`). */
export const COTIZACION_DIA_SIGUIENTE_DTO: CotizacionCancelacionDto = {
  ...COTIZACION_CANCELACION_DTO,
  effective_at: '2026-12-05T04:59:59Z',
  unused_days: 13,
  prorate_percent: 43.3,
  refund_amount: 61663,
};

/** La cuota del mes en curso está en gracia: nada pagado que devolver. */
export const COTIZACION_EN_GRACIA_DTO: CotizacionCancelacionDto = {
  ...COTIZACION_CANCELACION_DTO,
  paid_period: { ...PERIODO, month: 2, kind: 'installment', paid_amount: 0 },
  prorate_percent: 46.7,
  refund_amount: 0,
  payment_status: 'payment_pending',
};

const REEMBOLSO: DetalleReembolsoDto = {
  reference: 'REF-2026-00001',
  amount: 66406,
  currency: 'COP',
  method: VISA,
  registered_at: '2026-12-03T15:00:00Z',
  completed_at: null,
  paid_period: PERIODO,
  unused_days: 14,
  period_days: 30,
  prorate_percent: 46.7,
};

export const CANCELACION_EN_PROCESO_DTO: CancelacionPolizaDto = {
  reason: 'insured_request',
  cancelled_at: '2026-12-03T15:00:00Z',
  effective_at: '2026-12-04T04:59:59Z',
  refund: 'in_process',
  month: null,
  due_at: null,
  grace_ends_at: null,
  amount: null,
  currency: 'COP',
  attempts: null,
  email_sent_at: null,
  refund_detail: REEMBOLSO,
  insured_reason: { code: 'mortgage_paid', comments: null },
};

export const CANCELACION_REEMBOLSADA_DTO: CancelacionPolizaDto = {
  ...CANCELACION_EN_PROCESO_DTO,
  refund: 'completed',
  refund_detail: { ...REEMBOLSO, completed_at: '2026-12-03T15:01:00Z' },
};

export const CANCELACION_NO_PROCESADA_DTO: CancelacionPolizaDto = {
  ...CANCELACION_EN_PROCESO_DTO,
  refund: 'failed',
};

export const CANCELACION_SIN_REEMBOLSO_DTO: CancelacionPolizaDto = {
  ...CANCELACION_EN_PROCESO_DTO,
  refund: 'not_applicable',
  refund_detail: { ...REEMBOLSO, reference: null, amount: 0, method: VISA },
};

/** La póliza de A1 cancelada a solicitud, con el reembolso en proceso. */
export const POLIZA_CANCELADA_A_PEDIDO_DTO: PolizaListadaDto = {
  ...POLIZA_AL_DIA_DTO,
  can_renew: false,
  payment: { status: 'cancelled', next_due_at: null, pending: null },
  cancellation: CANCELACION_EN_PROCESO_DTO,
};

/** El detalle (A2 → A5b) de la póliza cancelada a solicitud. */
export function detalleCanceladoAPedido(cancelacion: CancelacionPolizaDto = CANCELACION_EN_PROCESO_DTO): DetallePolizaDto {
  return {
    ...DETALLE_AL_DIA_DTO,
    can_renew: false,
    payment: { status: 'cancelled', next_due_at: null, pending: null },
    cancellation: cancelacion,
  };
}
