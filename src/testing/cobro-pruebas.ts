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
  updated_at: '2026-10-16T19:05:13.2Z',
};
