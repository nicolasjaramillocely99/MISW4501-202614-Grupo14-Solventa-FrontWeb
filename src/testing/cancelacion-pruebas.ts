import { DetallePolizaDto } from '@core/api/originacion/detalle-poliza.modelos';
import { PolizaListadaDto } from '@core/api/originacion/renovacion.modelos';

import { POLIZA_FUERA_DE_VENTANA_DTO } from './renovacion-pruebas';

/**
 * Pólizas de HU-W1.6-02 según `docs/contratos/HU-W1.6-02-api.md`: una al día, una en gracia y una cancelada por no pago
 * (la de A2b: la cuota 2 venció el 12/08/2026, se rechazó tres veces y la póliza se canceló el 12/09/2026).
 */

export const POLIZA_AL_DIA_DTO: PolizaListadaDto = {
  ...POLIZA_FUERA_DE_VENTANA_DTO,
  payment: { status: 'up_to_date', next_due_at: '2026-10-01T12:00:00Z', pending: null },
  cancellation: null,
};

export const POLIZA_EN_GRACIA_DTO: PolizaListadaDto = {
  ...POLIZA_FUERA_DE_VENTANA_DTO,
  policy_id: 'pol-acc-330417',
  payment: {
    status: 'payment_pending',
    next_due_at: null,
    pending: {
      month: 4,
      due_at: '2026-09-01T12:00:00Z',
      grace_ends_at: '2026-10-01T12:00:00Z',
      cancels_at: '2026-10-02T12:00:00Z',
      amount: 142300,
      currency: 'COP',
      attempts: 1,
      next_attempt_at: '2026-09-09T12:00:00Z',
    },
  },
  cancellation: null,
};

export const POLIZA_CANCELADA_DTO: PolizaListadaDto = {
  ...POLIZA_FUERA_DE_VENTANA_DTO,
  policy_id: 'pol-acc-093377',
  coverage_start: '2026-07-12T05:00:00Z',
  coverage_end: '2027-07-12T05:00:00Z',
  can_renew: false,
  payment: { status: 'cancelled', next_due_at: null, pending: null },
  cancellation: {
    reason: 'non_payment',
    cancelled_at: '2026-09-12T05:00:00Z',
    refund: 'not_applicable',
    month: 2,
    due_at: '2026-08-12T05:00:00Z',
    grace_ends_at: '2026-09-11T05:00:00Z',
    amount: 142300,
    currency: 'COP',
    attempts: 3,
    email_sent_at: '2026-09-12T05:01:00Z',
  },
};

const RECHAZO = (attempt: number, attempted_at: string) => ({
  attempt,
  outcome: 'declined' as const,
  decline_code: '51',
  attempted_at,
});

export const DETALLE_CANCELADA_DTO: DetallePolizaDto = {
  ...POLIZA_CANCELADA_DTO,
  payment_method: {
    method: 'card',
    brand: 'visa',
    last4: '0010',
    installments: 1,
    bank_code: null,
    payer_type: null,
    captured_at: '2026-07-12T05:00:00Z',
  },
  payments: [
    {
      month: 2,
      kind: 'installment',
      status: 'unpaid',
      due_at: '2026-08-12T05:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: null,
      attempts: [
        RECHAZO(1, '2026-08-13T05:00:00Z'),
        RECHAZO(2, '2026-08-20T05:00:00Z'),
        RECHAZO(3, '2026-08-27T05:00:00Z'),
      ],
    },
    {
      month: 1,
      kind: 'issuance',
      status: 'paid',
      due_at: '2026-07-12T05:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: '2026-07-12T05:00:00Z',
      attempts: [],
    },
  ],
};

export const DETALLE_EN_GRACIA_DTO: DetallePolizaDto = {
  ...POLIZA_EN_GRACIA_DTO,
  payment_method: DETALLE_CANCELADA_DTO.payment_method,
  payments: [
    {
      month: 4,
      kind: 'installment',
      status: 'pending',
      due_at: '2026-09-01T12:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: null,
      attempts: [RECHAZO(1, '2026-09-02T12:00:00Z')],
    },
  ],
};

export const DETALLE_AL_DIA_DTO: DetallePolizaDto = {
  ...POLIZA_AL_DIA_DTO,
  payment_method: DETALLE_CANCELADA_DTO.payment_method,
  payments: [
    {
      month: 1,
      kind: 'issuance',
      status: 'paid',
      due_at: '2026-06-01T12:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: '2026-06-01T12:00:00Z',
      attempts: [],
    },
  ],
};
