import { DecisionDto, EvaluacionDto, PaginaColaDto } from '@core/api/siniestros/evaluacion.modelos';

import { SINIESTRO_RADICADO_DTO } from './siniestros-pruebas';

/**
 * Datos de la evaluación, aprobación y pago del siniestro (HU-W2.2-03) con la forma de `openapi.yaml` v0.8.0 del
 * backend: la cola, el detalle de un caso en evaluación y las decisiones (pago en curso, pagado, en excepción y
 * rechazo). El ejemplo es el de O6: costo $ 4.350.000, deducible 5 % y monto aprobado $ 4.132.500.
 */

export const ID_EVALUADO = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90';

export const PAGINA_COLA_DTO: PaginaColaDto = {
  items: [
    {
      claim_id: ID_EVALUADO,
      filing_number: 'SIN-2026-01655',
      status: 'active',
      channel: 'web',
      policy: { policy_id: 'HG-2025-880231', line: 'home', product: 'Hogar', insured_object: 'Carrera 15 # 93-40' },
      incident_type: 'water_damage',
      occurred_at: '2026-09-02T22:15:00Z',
      filed_at: '2026-09-03T19:20:00Z',
      estimated_amount_minor: 480_000_000,
      triage: { state: 'assessed', level: 2, severity: 'medium', amount_band: 'low' },
    },
    {
      claim_id: '1c9a3e57-2b4d-4f6a-8e0b-7d5c3a1f9e24',
      filing_number: 'SIN-2026-01720',
      status: 'active',
      channel: 'mobile',
      policy: { policy_id: 'AU-2025-118204', line: null, product: null, insured_object: null },
      incident_type: 'theft',
      occurred_at: '2026-09-10T15:20:00Z',
      filed_at: '2026-09-10T16:00:00Z',
      estimated_amount_minor: null,
      triage: { state: 'pending', level: null, severity: null, amount_band: null },
    },
  ],
  next_page_token: null,
};

const CUENTA = { bank_code: '1007', bank_name: 'Banco Aliado', account_type: 'savings', masked_number: '•••• 4512' };

export const EVALUACION_DTO: EvaluacionDto = {
  claim: {
    ...SINIESTRO_RADICADO_DTO,
    filing_number: 'SIN-2026-01655',
    policy: { policy_id: 'HG-2025-880231', line: 'home', product: 'Hogar', insured_object: 'Carrera 15 # 93-40' },
    incident_type: 'water_damage',
    place: 'Carrera 15 # 93-40, apto 402, Bogotá',
    description: 'Filtración desde el apartamento superior que afectó techo y muro de la cocina.',
    estimated_amount_minor: 435_000_000,
    evidence: [
      { kind: 'photo', captured_at: '2026-09-02T22:20:00Z', location_trusted: false, download_url: 'https://firmada/foto-1' },
    ],
  },
  support_files: [
    {
      support_id: 'sup-1',
      requirement_code: 'damage_photos',
      file_name: 'techo.jpg',
      content_type: 'image/jpeg',
      download_url: 'https://firmada/sup-1',
    },
  ],
  triage: {
    view: 'operations',
    claim_id: ID_EVALUADO,
    state: 'assessed',
    current: {
      level: 2,
      severity: 'medium',
      amount_band: 'low',
      estimated_amount_minor: 435_000_000,
      currency: 'COP',
      incident_type: 'water_damage',
      coverage: 'water_damage',
      policy_version: 'triage-policy-v1',
      target: { kind: 'business_days', business_days: 5, resolution_business_days: 10 },
      assessed_at: '2026-09-04T08:31:00Z',
    },
    history: [
      {
        level: 2,
        previous_level: null,
        severity: 'medium',
        amount_band: 'low',
        estimated_amount_minor: 435_000_000,
        incident_type: 'water_damage',
        causes: ['entered_evaluation'],
        actor: 'system',
        policy_version: 'triage-policy-v1',
        assessed_at: '2026-09-04T08:31:00Z',
      },
    ],
  },
  policy: {
    policy_id: 'HG-2025-880231',
    line: 'home',
    product: 'Hogar',
    insured_object: 'Carrera 15 # 93-40',
    status: 'active',
    coverages: [{ incident: 'water_damage', insured_value_minor: 32_000_000_000, currency: 'COP', deductible_basis_points: 500 }],
  },
  coverage: { incident: 'water_damage', insured_value_minor: 32_000_000_000, currency: 'COP', deductible_basis_points: 500 },
  holder: {
    full_name: 'Carolina Pérez Ruiz',
    document_type: 'CC',
    document_id: '1020345678',
    email: 'carolina@correo.example',
    phone: '+57 301 234 5678',
    payout_account: CUENTA,
  },
  policy_unavailable: false,
  decision: null,
};

const APROBACION: DecisionDto = {
  claim_id: ID_EVALUADO,
  filing_number: 'SIN-2026-01655',
  status: 'approved',
  outcome: 'approved',
  decided_by: 'analista@solventa.example',
  decided_at: '2026-09-16T21:40:00Z',
  approval: {
    gross_amount_minor: 435_000_000,
    insured_value_minor: 32_000_000_000,
    deductible_basis_points: 500,
    deductible_minor: 21_750_000,
    payout_amount_minor: 413_250_000,
    currency: 'COP',
  },
  payout: {
    payment_reference: `indemnizacion-${ID_EVALUADO}`,
    status: 'pending',
    destination: CUENTA,
    automatic_attempts: 0,
    max_automatic_attempts: 3,
    failure: null,
    gateway_code: null,
    last_failure_at: null,
    gateway_reference: null,
    paid_at: null,
    manual_retries: 0,
    last_retried_by: null,
    last_retried_at: null,
  },
  rejection: null,
};

/** Aprobado, con el pago pendiente. */
export const APROBACION_EN_CURSO_DTO: DecisionDto = APROBACION;

export const APROBACION_PAGADA_DTO: DecisionDto = {
  ...APROBACION,
  status: 'paid',
  payout: { ...APROBACION.payout!, status: 'paid', gateway_reference: 'po-1', paid_at: '2026-09-16T21:40:02Z' },
};

/** O6b: la pasarela rechazó la cuenta destino. */
export const APROBACION_EN_EXCEPCION_DTO: DecisionDto = {
  ...APROBACION,
  status: 'payment_exception',
  payout: {
    ...APROBACION.payout!,
    status: 'failed',
    destination: { ...CUENTA, masked_number: '•••• 6789' },
    automatic_attempts: 1,
    failure: 'rejected',
    gateway_code: 'invalid_destination_account',
    last_failure_at: '2026-09-16T21:41:00Z',
  },
};

export const RECHAZO_DTO: DecisionDto = {
  claim_id: ID_EVALUADO,
  filing_number: 'SIN-2026-01655',
  status: 'rejected',
  outcome: 'rejected',
  decided_by: 'analista@solventa.example',
  decided_at: '2026-09-16T21:40:00Z',
  approval: null,
  payout: null,
  rejection: { reason: 'La póliza excluye los daños por falta de mantenimiento.', notified_at: '2026-09-16T21:40:05Z' },
};

/** El detalle con una decisión y el estado del caso que esa decisión deja. */
export function evaluacionCon(decision: DecisionDto): EvaluacionDto {
  return { ...EVALUACION_DTO, claim: { ...EVALUACION_DTO.claim, status: decision.status }, decision };
}
