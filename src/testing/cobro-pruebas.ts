import { CobroDto } from '@core/api/originacion/cobro.modelos';

/** Cobro pendiente con la forma de `GET /v1/acceptances/{id}/charge` documentada en `docs/contratos/HA-D02-api.md`. */
export const COBRO_PENDIENTE_DTO: CobroDto = {
  acceptance_id: '6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
  offer_id: 'demo-active-001',
  customer_id: 'cust-1',
  accepted_at: '2026-10-16T19:04:58Z',
  status: 'pending',
  idempotency_key: 'cobro-6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
  amount: 89500,
  currency: 'COP',
  attempts: 3,
  last_attempt_at: '2026-10-16T19:05:12.5Z',
  last_failure_at: '2026-10-16T19:05:13.2Z',
  next_attempt_at: '2026-10-16T19:05:15.2Z',
  retry_window: { started_at: '2026-10-16T19:05:00Z', ends_at: '2026-10-17T19:05:00Z' },
  failure_reason: null,
  confirmed_at: null,
  policy_id: null,
  coverage_activated_at: null,
  activation_published_at: null,
  resume_count: 0,
  // Pendiente con tarjeta entregada y la pasarela sin responder: es E4b, no E4.
  payment_method: {
    method: 'card',
    brand: 'visa',
    last4: '1111',
    installments: 1,
    bank_code: null,
    captured_at: '2026-10-16T19:05:05Z',
  },
  payment_attempt: 1,
  updated_at: '2026-10-16T19:05:13.2Z',
};

/** Cobro recién creado: existe desde la aceptación, pero espera el medio de pago de E4 (HU-W1.3-02). */
export const COBRO_ESPERANDO_MEDIO_DE_PAGO_DTO: CobroDto = {
  ...COBRO_PENDIENTE_DTO,
  attempts: 0,
  last_attempt_at: null,
  last_failure_at: null,
  next_attempt_at: null,
  payment_method: null,
  payment_attempt: 0,
};

/** Cobro que la pasarela rechazó: es E4c, y el cliente puede intentar con otra tarjeta. */
export const COBRO_RECHAZADO_DTO: CobroDto = {
  ...COBRO_PENDIENTE_DTO,
  status: 'failed',
  failure_reason: 'payment_rejected',
  next_attempt_at: null,
};
