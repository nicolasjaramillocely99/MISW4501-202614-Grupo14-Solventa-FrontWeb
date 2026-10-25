import { CobroDto } from '@core/api/originacion/cobro.modelos';
import {
  CondicionesRenovacionDto,
  ListaPolizasDto,
  PolizaDto,
  PolizaListadaDto,
  RenovacionDto,
  ResumenRenovacionDto,
} from '@core/api/originacion/renovacion.modelos';

import { COBRO_PENDIENTE_DTO } from './cobro-pruebas';

/** Póliza de `GET /v1/policies` documentada en `docs/contratos/HU-W1.5-02-api.md` (la del mockup A4). */
export const POLIZA_DTO: PolizaDto = {
  policy_id: 'pol-acc-118204',
  holder_name: 'Carolina Pérez',
  premium: 142300,
  currency: 'COP',
  insured_amount: 68000000,
  coverages: [
    { code: 'death', insured_amount: 68000000 },
    { code: 'total_permanent_disability', insured_amount: 68000000 },
  ],
  coverage_start: '2025-10-02T23:59:00Z',
  coverage_end: '2026-10-02T23:59:00Z',
  renewal_of: null,
};

/** Póliza dentro de su ventana de renovación y sin renovación aún. */
export const POLIZA_LISTADA_DTO: PolizaListadaDto = {
  ...POLIZA_DTO,
  renewal_window: { opens_at: '2026-09-02T23:59:00Z', closes_at: '2026-10-02T23:59:00Z' },
  can_renew: true,
  renewal: null,
};

/** Póliza vigente que todavía no entra a su ventana. */
export const POLIZA_FUERA_DE_VENTANA_DTO: PolizaListadaDto = {
  ...POLIZA_LISTADA_DTO,
  policy_id: 'pol-acc-220331',
  coverage_start: '2026-06-01T12:00:00Z',
  coverage_end: '2027-06-01T12:00:00Z',
  renewal_window: { opens_at: '2027-05-02T12:00:00Z', closes_at: '2027-06-01T12:00:00Z' },
  can_renew: false,
};

export const LISTA_POLIZAS_DTO: ListaPolizasDto = { items: [POLIZA_LISTADA_DTO, POLIZA_FUERA_DE_VENTANA_DTO] };

/** Respuesta de `GET /v1/policies/{id}/renewal`: las condiciones vigentes y las recotizadas (mockup A4). */
export const CONDICIONES_RENOVACION_DTO: CondicionesRenovacionDto = {
  policy: POLIZA_DTO,
  current: {
    premium: 142300,
    currency: 'COP',
    insured_amount: 68000000,
    coverages: POLIZA_DTO.coverages,
    coverage_start: '2025-10-02T23:59:00Z',
    coverage_end: '2026-10-02T23:59:00Z',
  },
  renewal: {
    premium: 149800,
    currency: 'COP',
    insured_amount: 72500000,
    coverages: [
      { code: 'death', insured_amount: 72500000 },
      { code: 'total_permanent_disability', insured_amount: 72500000 },
    ],
    coverage_start: '2026-10-02T23:59:00Z',
    coverage_end: '2027-10-02T23:59:00Z',
  },
  renewal_window: { opens_at: '2026-09-02T23:59:00Z', closes_at: '2026-10-02T23:59:00Z' },
  requoted: true,
  discount_rate: 0.08,
  payment_method: { method: 'card', brand: 'visa', last4: '1111', installments: 1, bank_code: null, captured_at: '2025-10-02T23:58:00Z' },
};

const ID_COBRO = 'ren-pol-acc-118204-20261002';

export const RESUMEN_ACEPTADA_DTO: ResumenRenovacionDto = {
  renewal_id: ID_COBRO,
  status: 'accepted',
  reason: null,
  new_policy_id: null,
  charge_id: ID_COBRO,
  accepted_at: '2026-09-19T15:00:00Z',
  retry_until: '2026-09-22T15:00:00Z',
  closed_at: null,
};

/** Cobro de la renovación con la tarjeta registrada, aún por cobrar. */
export const COBRO_RENOVACION_DTO: CobroDto = {
  ...COBRO_PENDIENTE_DTO,
  acceptance_id: ID_COBRO,
  offer_id: ID_COBRO,
  customer_id: 'sub-1',
  amount: 149800,
  attempts: 0,
  last_attempt_at: null,
  last_failure_at: null,
  next_attempt_at: '2026-09-19T15:00:00Z',
  retry_window: { started_at: '2026-09-19T15:00:00Z', ends_at: '2026-09-22T15:00:00Z' },
};

/** Respuesta de `POST /v1/policies/{id}/renewal` y de `…/renewal/status`: aceptada y cobrándose. */
export const RENOVACION_ACEPTADA_DTO: RenovacionDto = {
  renewal: RESUMEN_ACEPTADA_DTO,
  terms: CONDICIONES_RENOVACION_DTO.renewal,
  discount_rate: 0.08,
  charge: COBRO_RENOVACION_DTO,
};

/** Aceptada con la tarjeta registrada rechazada: se puede probar con otro medio hasta `retry_until`. */
export const RENOVACION_RECHAZADA_DTO: RenovacionDto = {
  ...RENOVACION_ACEPTADA_DTO,
  charge: {
    ...COBRO_RENOVACION_DTO,
    status: 'failed',
    attempts: 1,
    next_attempt_at: null,
    failure_reason: 'payment_rejected',
    last_failure_at: '2026-09-19T15:00:03Z',
  },
};

/** Aceptada y sin medio de pago registrado: espera que el asegurado lo entregue. */
export const RENOVACION_SIN_MEDIO_DTO: RenovacionDto = {
  ...RENOVACION_ACEPTADA_DTO,
  charge: { ...COBRO_RENOVACION_DTO, payment_method: null, payment_attempt: 0, next_attempt_at: null },
};

/** Renovada: cobro confirmado y póliza nueva activa (mockup A4b). */
export const RENOVACION_RENOVADA_DTO: RenovacionDto = {
  renewal: { ...RESUMEN_ACEPTADA_DTO, status: 'renewed', new_policy_id: 'pol-ren-pol-acc-118204-20261002', closed_at: '2026-09-19T15:00:04Z' },
  terms: CONDICIONES_RENOVACION_DTO.renewal,
  discount_rate: 0.08,
  charge: {
    ...COBRO_RENOVACION_DTO,
    status: 'confirmed',
    attempts: 0,
    next_attempt_at: null,
    confirmed_at: '2026-09-19T15:00:04Z',
    policy_id: 'pol-ren-pol-acc-118204-20261002',
    coverage_activated_at: '2026-09-19T15:00:04Z',
  },
};

/** No renovada: el pago no se resolvió dentro del plazo. */
export const RENOVACION_NO_RENOVADA_DTO: RenovacionDto = {
  ...RENOVACION_RECHAZADA_DTO,
  renewal: { ...RESUMEN_ACEPTADA_DTO, status: 'not_renewed', reason: 'payment_failed', closed_at: '2026-09-22T15:00:00Z' },
};
