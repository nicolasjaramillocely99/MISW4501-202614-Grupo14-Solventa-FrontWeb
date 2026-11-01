import { ConsentimientoDto, TerminosConsentimientoDto } from '@core/api/auditoria/consentimiento.modelos';

/** Términos vigentes con la forma de `GET /v1/audit/consent-terms/current` documentada en `docs/contratos/HU-W1.2-01-api.md`. */
export const TERMINOS_DTO: TerminosConsentimientoDto = {
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

/** Recibo de `POST /v1/audit/consents` (201) del mismo contrato. */
export const RECIBO_CONSENTIMIENTO_DTO: ConsentimientoDto = {
  consent_id: 'cns-7c3e85c71dddd603c8e90def9f4ce9cd',
  customer_id: 'cliente-0001',
  terms_version: 'v1',
  purpose: 'risk_profiling_mortgage_life_offer',
  channel: 'embedded',
  scope: TERMINOS_DTO.sources,
  granted_at: '2026-10-18T02:48:14.062927Z',
  expires_at: '2027-10-18T02:48:14.062927Z',
};
