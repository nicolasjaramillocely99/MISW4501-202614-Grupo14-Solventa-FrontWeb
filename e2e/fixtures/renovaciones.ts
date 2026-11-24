/**
 * Datos de las E2E de la renovación asistida del asesor (HU-W1.5-03), con la forma de `GET/POST
 * /v1/policies/{policy_id}/assisted-renewal…` (contrato `HU-W1.5-03-api.md`, `openapi.yaml` 0.15.0). La póliza es la
 * misma fila `pol-acc-118204` del listado de pólizas próximas a vencer (`polizas-por-vencer.ts`, HU-W1.5-01). Las fechas
 * son las del 16/09/2026; la pantalla solo compara con el reloj real la apertura de la ventana («todavía no se puede
 * renovar»), que por eso se calcula desde hoy.
 */

export const POLIZA = 'pol-acc-118204';
export const POLIZA_NUEVA = 'pol-ren-118204';

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

/** Recotización vigente con las fuentes consultadas y el motor `v1` aplicado. */
export function recotizacion(cambios: Record<string, unknown> = {}) {
  return {
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
      { source: 'kyc', status: 'ok', latency_ms: 71 },
    ],
    consent_basis: 'audit_verified',
    consent_affirmed_at: null,
    consent_affirmed_by_email: null,
    consent_affirmed_by_name: null,
    ...cambios,
  };
}

/** Open Finance no respondió: el último perfil en caché, con su fecha (D-7). */
export const RECOTIZACION_CACHE = recotizacion({
  requote_id: 'rq-cache',
  mode: 'provisional',
  source: 'cache',
  profile_date: '2026-08-27T21:02:00Z',
  unavailable_source: 'open_finance',
  notice: 'last_profile_in_use',
  sources: [
    { source: 'open_finance', status: 'timeout', latency_ms: 120 },
    { source: 'open_data', status: 'ok', latency_ms: 88 },
    { source: 'kyc', status: 'ok', latency_ms: 71 },
  ],
});

/** Sin un perfil reciente en caché: el perfil actuarial base (D-7). */
export const RECOTIZACION_BASE = recotizacion({
  requote_id: 'rq-base',
  mode: 'provisional',
  source: 'base_actuarial',
  unavailable_source: 'open_finance',
  notice: 'personalization_unavailable',
  sources: [
    { source: 'open_finance', status: 'timeout', latency_ms: 120 },
    { source: 'open_data', status: 'ok', latency_ms: 88 },
    { source: 'kyc', status: 'ok', latency_ms: 71 },
  ],
});

/** `GET …/assisted-renewal` de una póliza en su ventana, sin recotizar, nacida en el canal embebido. */
export function vista(cambios: Record<string, unknown> = {}) {
  return {
    policy: {
      policy_id: POLIZA,
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
    ...cambios,
  };
}

/** S7 recotizada, lista para registrar la aceptación. */
export const recotizada = (rq: Record<string, unknown> = recotizacion()) => vista({ requote: rq, can_formalize: true });

const RESUMEN = {
  renewal_id: `ren-${POLIZA}-20261002`,
  status: 'accepted',
  reason: null,
  new_policy_id: null,
  charge_id: `ren-${POLIZA}-20261002`,
  accepted_at: '2026-09-16T21:06:00Z',
  retry_until: '2026-09-19T21:06:00Z',
  closed_at: null,
  // Las condiciones aceptadas, en cualquiera de los dos canales.
  terms: recotizacion().renewal,
  premium_change_rate: 0.0527,
  discount_rate: 0.08,
  requoted: true,
};

/** Registro del asesor; sin `name` en la cuenta la pantalla muestra el correo. */
export function formalizacion(cambios: Record<string, unknown> = {}) {
  return {
    advisor_id: 'sub-laura',
    advisor_email: 'asesor@example.com',
    advisor_name: 'Laura Gómez',
    formalized_at: '2026-09-16T21:06:00Z',
    requote_id: recotizacion().requote_id,
    acceptance: { method: 'recorded_call', accepted_at: '2026-09-16T21:05:00Z', reference: 'GRAB-2026-88931' },
    ...cambios,
  };
}

const COBRO_EN_CURSO = { status: 'pending', failure_reason: null, decline_code: null, last_failure_at: null, attempts: 0, policy_id: null };

/** S7b: formalizada por el asesor, con el cobro en curso. */
export const formalizada = (cambios: Record<string, unknown> = {}) =>
  vista({
    requote: recotizacion(),
    renewal: { ...RESUMEN, channel: 'advisor' },
    formalization: formalizacion(),
    charge: COBRO_EN_CURSO,
    can_requote: false,
    can_formalize: false,
    blocked_reason: 'renewal_closed',
    ...cambios,
  });

/** S7b: el cobro se confirmó y la póliza nueva está activa. */
export const renovada = () =>
  formalizada({
    renewal: { ...RESUMEN, status: 'renewed', new_policy_id: POLIZA_NUEVA, closed_at: '2026-09-16T21:07:00Z', channel: 'advisor' },
    charge: { ...COBRO_EN_CURSO, status: 'confirmed', policy_id: POLIZA_NUEVA },
  });

/** «Ver»: el pago falló y el cliente puede reintentar hasta `retry_until` (01·D-3 a+). */
export const pagoFallido = () =>
  formalizada({
    charge: {
      status: 'failed',
      failure_reason: 'payment_rejected',
      decline_code: '51',
      last_failure_at: '2026-09-16T21:08:00Z',
      attempts: 1,
      policy_id: null,
    },
  });

/** Renovó el asegurado en línea (HU-W1.5-02): solo lectura con el estado de su cobro. */
export const delAsegurado = () =>
  vista({
    renewal: { ...RESUMEN, channel: 'insured' },
    charge: { ...COBRO_EN_CURSO, status: 'in_progress' },
    can_requote: false,
    blocked_reason: 'renewal_closed',
  });

/** Póliza que todavía no entra en su ventana de renovación: la abre dentro de `dias` días, contados desde hoy. */
export function fueraDeVentana(dias = 20) {
  const abre = new Date(Date.now() + dias * 86_400_000);
  const vence = new Date(abre.getTime() + 30 * 86_400_000);
  return vista({
    policy: { ...vista().policy, policy_id: 'pol-acc-004512', coverage_end: vence.toISOString() },
    renewal_window: { opens_at: abre.toISOString(), closes_at: vence.toISOString(), open: false },
    can_requote: false,
    blocked_reason: 'renewal_not_available',
  });
}

/**
 * La misma vista para otra fila del listado de pólizas por vencer: «Ver» de `pol-acc-771003` (Marta Ruiz Ospina), la
 * que tiene la renovación en curso.
 */
export function deLaPolizaEnCurso<T extends ReturnType<typeof vista>>(dto: T): T {
  return {
    ...dto,
    policy: {
      ...dto.policy,
      policy_id: 'pol-acc-771003',
      holder: { full_name: 'Marta Ruiz Ospina', document_type: null, document_id: '41556902' },
      coverage_end: '2026-10-05T23:59:00Z',
    },
  };
}

/** Respuesta de `POST …/assisted-renewal/consent`. */
export const CODIGO_ENVIADO = { requote_id: recotizacion().requote_id, sent_to: 'ca***@example.com', expires_at: '2026-09-16T21:15:00Z' };

/** `GET /v1/policies/{id}/issuance-status` de la póliza nueva: certificado listo y correo enviado. */
export const EMISION_NUEVA = {
  policy_id: POLIZA_NUEVA,
  status: 'completed',
  activated_at: '2026-09-16T21:07:00Z',
  available_at: '2026-09-16T21:07:04Z',
  within_slo: true,
  document: { document_id: 'doc-ren-118204', version: 1, size_bytes: 2310, generated_at: '2026-09-16T21:07:04Z' },
  notification: { channel: 'email', status: 'sent', attempts: 0, sent_at: '2026-09-16T21:07:05Z' },
};

/** Cuerpo de un error del contrato. */
export const error = (codigo: string, cambios: Record<string, unknown> = {}) => ({ error: codigo, message: codigo, ...cambios });
