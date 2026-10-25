import { RegistroDecisionDto } from '@core/api/auditoria/decision.modelos';

/** Registro de auditoría de una oferta aplazada porque una fuente no respondió (HU-W4.1-01). */
export const REGISTRO_DECISION_DTO: RegistroDecisionDto = {
  offer_id: 'off-4f2a9c',
  customer_id: 'cliente-0001',
  partner_id: 'aliado-banco-1',
  application_id: '48213',
  consent_id: 'cns-7d1e',
  channel: 'embedded',
  requested_at: '2026-10-20T15:04:05Z',
  rater_version: 'v1',
  sources: [
    { source: 'open_finance', status: 'ok', latency_ms: 85, consulted_at: '2026-10-20T15:04:05.120Z', score: 0.82, category: 'preferred' },
    { source: 'kyc', status: 'timeout', latency_ms: 700, consulted_at: '2026-10-20T15:04:05.120Z', score: null, category: '' },
  ],
  profile: { score: 0.4, category: 'standard', partial: true },
  rules: [
    { order: 2, code: 'age_factor', value: 1.2 },
    { order: 1, code: 'base_monthly_rate', value: 0.0011 },
  ],
  premium: 120000,
  currency: 'COP',
  decision: 'deferred',
  decision_reason: 'base_actuarial_profile',
  recorded_at: '2026-10-20T15:04:06Z',
};
