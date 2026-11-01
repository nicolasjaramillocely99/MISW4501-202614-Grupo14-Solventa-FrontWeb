/**
 * Contexto de lanzamiento que el aliado entrega en `?contexto=` (HU-W1.2-01): datos del crédito y del cliente en
 * JSON base64url. Los datos de ejemplo son los del prototipo E1 y viven solo aquí y en la documentación.
 */
export const CONTEXTO_ALIADO = {
  aliado: 'Banco Aliado',
  aliadoId: 'aliado-banco-1',
  banco: 'Banco Aliado',
  solicitud: { numero: '48213', montoAprobado: 250000000, plazoAnios: 20, cuotaEstimada: 2180000, moneda: 'COP' },
  cliente: {
    id: 'cliente-0001',
    nombreCompleto: 'Ana María Pérez',
    documento: '1020304050',
    correo: 'ana.perez@example.com',
    fechaNacimiento: '1988-04-12',
  },
};

export function codificarContexto(contexto: unknown): string {
  return Buffer.from(JSON.stringify(contexto), 'utf-8').toString('base64url');
}

/** Términos vigentes de `GET /v1/audit/consent-terms/current` (contrato `HU-W1.2-01-api.md` §2.1). */
export const TERMINOS_VIGENTES = {
  version: 'v1',
  purpose: 'risk_profiling_mortgage_life_offer',
  controller: 'Solventa S.A.',
  policy_ref: 'personal-data-policy-v1',
  sources: [
    { code: 'open_finance', data_categories: ['credit_products', 'balances', 'payment_behavior'], validity: '12_months' },
    { code: 'open_data', data_categories: ['public_records'], validity: '12_months' },
    { code: 'kyc', data_categories: ['identity_verification'], validity: 'single_use' },
  ],
};

/** Recibo de `POST /v1/audit/consents` (contrato §2.2). */
export const RECIBO_CONSENTIMIENTO = {
  consent_id: 'cns-7c3e85c71dddd603c8e90def9f4ce9cd',
  customer_id: 'cliente-0001',
  terms_version: 'v1',
  purpose: 'risk_profiling_mortgage_life_offer',
  channel: 'embedded',
  scope: TERMINOS_VIGENTES.sources,
  granted_at: '2026-10-18T02:48:14.062927Z',
  expires_at: '2027-10-18T02:48:14.062927Z',
};

/** Perfil de `POST /v1/risk-profiles/resolve` al que llega el paso 2. */
export const PERFIL_RIESGO = {
  customer_id: 'cliente-0001',
  mode: 'normal',
  source: 'external_sources',
  profile: { score: 700, category: 'B' },
  profile_date: '2026-10-18T12:00:00Z',
  unavailable_source: null,
  notice: null,
  partial: false,
  sources: [
    { name: 'open_finance', status: 'ok', latency_ms: 180 },
    { name: 'open_data', status: 'ok', latency_ms: 95 },
    { name: 'kyc', status: 'ok', latency_ms: 60 },
  ],
};
