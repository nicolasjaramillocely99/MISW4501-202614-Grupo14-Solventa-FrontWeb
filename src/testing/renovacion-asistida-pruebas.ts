import {
  CodigoRenovacionEnviadoDto,
  RecotizacionRenovacionDto,
  RenovacionAsistidaDto,
} from '@core/api/originacion/renovacion-asistida.modelos';

/**
 * Respuestas de la renovación asistida (HU-W1.5-03) con la forma del contrato de `docs/contratos/HU-W1.5-03-api.md`
 * (origination 0.15.0): la póliza de vida hipotecario de Carolina, la recotización normal, en modo degradado con
 * caché y con el perfil actuarial base, y las vistas de cada estado de la página.
 */

const COBERTURAS = [
  { code: 'death', insured_amount: 68000000 },
  { code: 'total_permanent_disability', insured_amount: 68000000 },
];

const VIGENTE = {
  premium: 142300,
  currency: 'COP',
  insured_amount: 68000000,
  coverages: COBERTURAS,
  coverage_start: '2025-10-02T23:59:00Z',
  coverage_end: '2026-10-02T23:59:00Z',
};

/** Recotización con las fuentes arriba: motor `v1`, descuento del 8 %. */
export const RECOTIZACION_DTO: RecotizacionRenovacionDto = {
  requote_id: 'rq-3f9a0c1d2e4b5a6978c0d1e2f3a4b5c6',
  created_at: '2026-09-16T21:02:00Z',
  expires_at: '2026-09-17T21:02:00Z',
  status: 'valid',
  current: VIGENTE,
  renewal: { ...VIGENTE, premium: 149800, coverage_start: '2026-10-02T23:59:00Z', coverage_end: '2027-10-02T23:59:00Z' },
  premium_change_rate: 0.0527,
  discount_rate: 0.08,
  requoted: true,
  rating_version: 'v1',
  applied_rules: [
    { code: 'base_monthly_rate', value: 0.00045 },
    { code: 'age_factor', value: 1.32 },
    { code: 'risk_factor', value: 0.93 },
    { code: 'term_factor', value: 1.02 },
    { code: 'rounding_step', value: 100 },
  ],
  mode: 'normal',
  source: 'external_sources',
  profile_date: null,
  unavailable_source: null,
  notice: null,
  sources: [
    { source: 'open_finance', status: 'ok', latency_ms: 96 },
    { source: 'open_data', status: 'ok', latency_ms: 88 },
    { source: 'kyc', status: 'ok', latency_ms: 64 },
  ],
  consent_basis: 'audit_verified',
  consent_affirmed_at: null,
};

/** Open Finance caído: el último perfil en caché (CA-5). */
export const RECOTIZACION_CACHE_DTO: RecotizacionRenovacionDto = {
  ...RECOTIZACION_DTO,
  requote_id: 'rq-cache',
  mode: 'provisional',
  source: 'cache',
  profile_date: '2026-08-27T21:02:00Z',
  unavailable_source: 'open_finance',
  notice: 'last_profile_in_use',
  sources: [
    { source: 'open_finance', status: 'timeout', latency_ms: 120 },
    { source: 'open_data', status: 'ok', latency_ms: 88 },
    { source: 'kyc', status: 'ok', latency_ms: 64 },
  ],
};

/** Open Finance caído y sin un perfil reciente en caché: el actuarial base. */
export const RECOTIZACION_BASE_DTO: RecotizacionRenovacionDto = {
  ...RECOTIZACION_CACHE_DTO,
  requote_id: 'rq-base',
  source: 'base_actuarial',
  profile_date: null,
  notice: 'personalization_unavailable',
};

/** Póliza de origen asistido: el asesor afirmó el consentimiento. */
export const RECOTIZACION_AFIRMADA_DTO: RecotizacionRenovacionDto = {
  ...RECOTIZACION_DTO,
  requote_id: 'rq-afirmada',
  consent_basis: 'advisor_affirmed',
  consent_affirmed_at: '2026-09-16T21:02:00Z',
};

/** S7 sin recotizar: la póliza en su ventana, con su tarjeta registrada. */
export const RENOVACION_SIN_RECOTIZAR_DTO: RenovacionAsistidaDto = {
  policy: {
    policy_id: 'pol-acc-118204',
    line: 'life',
    holder: { full_name: 'Carolina Pérez Ruiz', document_type: null, document_id: '1020345678' },
    premium: 142300,
    currency: 'COP',
    insured_amount: 68000000,
    coverages: COBERTURAS,
    coverage_start: '2025-10-02T23:59:00Z',
    coverage_end: '2026-10-02T23:59:00Z',
    renewal_of: null,
  },
  renewal_window: { opens_at: '2026-09-02T23:59:00Z', closes_at: '2026-10-02T23:59:00Z', open: true },
  current: VIGENTE,
  payment_method: {
    method: 'card',
    brand: 'visa',
    last4: '1111',
    installments: 1,
    bank_code: null,
    payer_type: null,
    captured_at: '2025-10-01T15:00:00Z',
  },
  requote: null,
  renewal: null,
  formalization: null,
  charge: null,
  consent_mode: 'audit',
  can_requote: true,
  can_formalize: false,
  blocked_reason: null,
};

/** S7 recotizada, lista para registrar la aceptación. */
export const RENOVACION_RECOTIZADA_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_SIN_RECOTIZAR_DTO,
  requote: RECOTIZACION_DTO,
  can_formalize: true,
};

/** Póliza de origen asistido: S7 muestra la casilla de consentimiento del asesor. */
export const RENOVACION_ORIGEN_ASISTIDO_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_SIN_RECOTIZAR_DTO,
  consent_mode: 'advisor_affirmation',
};

/** Sin medio de pago registrado: se recotiza, pero no se formaliza (D-10). */
export const RENOVACION_SIN_MEDIO_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_RECOTIZADA_DTO,
  payment_method: null,
  can_formalize: false,
  blocked_reason: 'payment_method_missing',
};

/** Fuera de la ventana de renovación. */
export const RENOVACION_NO_DISPONIBLE_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_SIN_RECOTIZAR_DTO,
  renewal_window: { opens_at: '2026-11-02T23:59:00Z', closes_at: '2026-12-02T23:59:00Z', open: false },
  can_requote: false,
  blocked_reason: 'renewal_not_available',
};

const RESUMEN = {
  renewal_id: 'ren-pol-acc-118204-20261002',
  status: 'accepted' as const,
  reason: null,
  new_policy_id: null,
  charge_id: 'ren-pol-acc-118204-20261002',
  accepted_at: '2026-09-16T21:06:00Z',
  retry_until: '2026-09-19T21:06:00Z',
  closed_at: null,
};

const FORMALIZACION = {
  advisor_id: 'sub-laura',
  advisor_email: 'asesor@example.com',
  advisor_name: 'Laura Gómez',
  formalized_at: '2026-09-16T21:06:00Z',
  requote_id: RECOTIZACION_DTO.requote_id,
  acceptance: { method: 'recorded_call' as const, accepted_at: '2026-09-16T21:05:00Z', reference: 'GRAB-2026-88931' },
};

/** S7b: formalizada por el asesor, con el cobro en curso. */
export const RENOVACION_FORMALIZADA_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_RECOTIZADA_DTO,
  renewal: { ...RESUMEN, channel: 'advisor' },
  formalization: FORMALIZACION,
  charge: { status: 'pending', failure_reason: null, decline_code: null, last_failure_at: null, attempts: 0, policy_id: null },
  can_requote: false,
  can_formalize: false,
  blocked_reason: 'renewal_closed',
};

/** S7b: el cobro se confirmó y la póliza nueva está activa. */
export const RENOVACION_RENOVADA_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_FORMALIZADA_DTO,
  renewal: { ...RESUMEN, status: 'renewed', new_policy_id: 'pol-ren-118204', closed_at: '2026-09-16T21:07:00Z', channel: 'advisor' },
  charge: { status: 'confirmed', failure_reason: null, decline_code: null, last_failure_at: null, attempts: 0, policy_id: 'pol-ren-118204' },
};

/** «Ver»: el pago falló y el cliente puede reintentar hasta `retry_until` (01·D-3 a+). */
export const RENOVACION_PAGO_FALLIDO_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_FORMALIZADA_DTO,
  charge: {
    status: 'failed',
    failure_reason: 'payment_rejected',
    decline_code: '51',
    last_failure_at: '2026-09-16T21:08:00Z',
    attempts: 1,
    policy_id: null,
  },
};

/** Sin el nombre en la cuenta del asesor: la pantalla muestra su correo. */
export const RENOVACION_SIN_NOMBRE_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_FORMALIZADA_DTO,
  formalization: { ...FORMALIZACION, advisor_name: null },
};

/** Renovó el asegurado en línea (HU-W1.5-02): solo lectura con el estado de su cobro. */
export const RENOVACION_DEL_ASEGURADO_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_SIN_RECOTIZAR_DTO,
  renewal: { ...RESUMEN, channel: 'insured' },
  charge: { status: 'in_progress', failure_reason: null, decline_code: null, last_failure_at: null, attempts: 0, policy_id: null },
  can_requote: false,
  blocked_reason: 'renewal_closed',
};

/** La renovación del periodo terminó como no renovada. */
export const RENOVACION_NO_RENOVADA_DTO: RenovacionAsistidaDto = {
  ...RENOVACION_SIN_RECOTIZAR_DTO,
  renewal: { ...RESUMEN, status: 'not_renewed', reason: 'payment_failed', closed_at: '2026-09-19T21:06:00Z', channel: 'insured' },
  can_requote: false,
  blocked_reason: 'renewal_not_available',
};

/** Respuesta de `POST …/assisted-renewal/consent`. */
export const CODIGO_ENVIADO_DTO: CodigoRenovacionEnviadoDto = {
  requote_id: RECOTIZACION_DTO.requote_id,
  sent_to: 'ca***@example.com',
  expires_at: '2026-09-16T21:12:00Z',
};
