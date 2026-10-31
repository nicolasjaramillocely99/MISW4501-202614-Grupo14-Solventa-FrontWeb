/**
 * Datos de las E2E de la evaluación, aprobación y pago del siniestro (HU-W2.2-03) con la forma de
 * `services/claims/api/openapi.yaml` v0.8.0 del backend. El ejemplo es el de O6: costo $ 4.350.000, deducible 5 % y
 * monto aprobado $ 4.132.500.
 */

export const ID_CASO = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90';

const POLIZA = { policy_id: 'HG-2025-880231', line: 'home', product: 'Hogar', insured_object: 'Carrera 15 # 93-40' };
const CUENTA = { bank_code: '1007', bank_name: 'Banco Aliado', account_type: 'savings', masked_number: '•••• 4512' };
const COBERTURA = { incident: 'water_damage', insured_value_minor: 32_000_000_000, currency: 'COP', deductible_basis_points: 500 };

const RESUMEN = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01655',
  status: 'active',
  channel: 'web',
  policy: POLIZA,
  incident_type: 'water_damage',
  occurred_at: '2026-09-03T03:15:00Z',
  filed_at: '2026-09-04T00:20:00Z',
};

export const COLA = [
  { ...RESUMEN, estimated_amount_minor: 480_000_000, triage: { state: 'assessed', level: 2, severity: 'medium', amount_band: 'low' } },
  {
    ...RESUMEN,
    claim_id: '1c9a3e57-2b4d-4f6a-8e0b-7d5c3a1f9e24',
    filing_number: 'SIN-2026-01690',
    policy: { policy_id: 'AU-2025-118204', line: 'auto', product: 'Autos', insured_object: 'KJT-482' },
    incident_type: 'theft',
    estimated_amount_minor: 4_800_000_000,
    triage: { state: 'assessed', level: 1, severity: 'high', amount_band: 'high' },
  },
];

export const DETALLE = {
  claim: {
    ...RESUMEN,
    place: 'Carrera 15 # 93-40, apto 402, Bogotá',
    description: 'Filtración desde el apartamento superior que afectó techo y muro de la cocina.',
    supports: {
      required_total: 2,
      required_attached: 2,
      files: 2,
      items: [
        { requirement_code: 'damage_photos', label: 'Fotos del daño', files: [{ support_id: 'sup-1', file_name: 'techo.jpg', content_type: 'image/jpeg', byte_size: 2048 }] },
        { requirement_code: 'repair_quote', label: 'Cotización', files: [{ support_id: 'sup-2', file_name: 'cotizacion.pdf', content_type: 'application/pdf', byte_size: 4096 }] },
      ],
    },
    evidence: [],
    estimated_amount_minor: 435_000_000,
  },
  support_files: [
    { support_id: 'sup-1', requirement_code: 'damage_photos', file_name: 'techo.jpg', content_type: 'image/jpeg', download_url: 'https://firmada.example/sup-1' },
    { support_id: 'sup-2', requirement_code: 'repair_quote', file_name: 'cotizacion.pdf', content_type: 'application/pdf', download_url: 'https://firmada.example/sup-2' },
  ],
  triage: {
    view: 'operations',
    claim_id: ID_CASO,
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
      assessed_at: '2026-09-04T13:31:00Z',
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
        assessed_at: '2026-09-04T13:31:00Z',
      },
    ],
  },
  policy: { ...POLIZA, status: 'active', coverages: [COBERTURA] },
  coverage: COBERTURA,
  holder: {
    full_name: 'Carolina Pérez Ruiz',
    document_type: 'CC',
    document_id: '1020345678',
    email: 'carolina.perez@correo.example',
    phone: '+57 301 234 5678',
    payout_account: CUENTA,
  },
  policy_unavailable: false,
  decision: null,
};

const PAGO = {
  payment_reference: `indemnizacion-${ID_CASO}`,
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
};

const APROBACION = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01655',
  status: 'paid',
  outcome: 'approved',
  decided_by: 'andres.ruiz@solventa.co',
  decided_at: '2026-09-16T21:40:00Z',
  approval: {
    gross_amount_minor: 435_000_000,
    insured_value_minor: 32_000_000_000,
    deductible_basis_points: 500,
    deductible_minor: 21_750_000,
    payout_amount_minor: 413_250_000,
    currency: 'COP',
  },
  rejection: null,
};

/** La pasarela confirmó el pago. */
export const APROBACION_PAGADA = {
  ...APROBACION,
  payout: { ...PAGO, status: 'paid', gateway_reference: 'po-1', paid_at: '2026-09-16T21:40:02Z' },
};

/** O6b: la pasarela rechazó la cuenta destino. */
export const APROBACION_EN_EXCEPCION = {
  ...APROBACION,
  status: 'payment_exception',
  payout: {
    ...PAGO,
    status: 'failed',
    destination: { ...CUENTA, masked_number: '•••• 6789' },
    automatic_attempts: 1,
    failure: 'rejected',
    gateway_code: 'invalid_destination_account',
    last_failure_at: '2026-09-16T21:41:00Z',
  },
};

/** Tras el reintento con la cuenta corregida, pagado. */
export const REINTENTO_PAGADO = {
  ...APROBACION_PAGADA,
  payout: { ...APROBACION_PAGADA.payout, manual_retries: 1, last_retried_by: 'andres.ruiz@solventa.co', last_retried_at: '2026-09-16T21:45:00Z' },
};

export const RECHAZO = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01655',
  status: 'rejected',
  outcome: 'rejected',
  decided_by: 'andres.ruiz@solventa.co',
  decided_at: '2026-09-16T21:40:00Z',
  approval: null,
  payout: null,
  rejection: { reason: 'La póliza excluye los daños por falta de mantenimiento.', notified_at: '2026-09-16T21:40:05Z' },
};
