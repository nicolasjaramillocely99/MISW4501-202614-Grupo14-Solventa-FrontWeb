import { OfertaDto } from '@core/api/originacion/oferta.modelos';

/** Oferta normal con la forma de `GET /v1/offers/{offer_id}` documentada en `docs/contratos/HU-W1.2-03-api.md` (§2.2). */
export const OFERTA_NORMAL_DTO: OfertaDto = {
  offer_id: 'off-b948aa0f4d51e923a67c7cee087e94ed',
  kind: 'personalized',
  status: 'active',
  premium: 132000,
  currency: 'COP',
  mode: 'normal',
  expires_at: '2026-10-19T15:53:01.627931Z',
  can_accept: true,
  can_renew: false,
  channel: 'embedded',
  created_at: '2026-10-18T15:53:01.627931Z',
  provisional_reason: null,
  profile_date: null,
  unavailable_source: null,
  profile: { category: 'standard', source: 'external_sources' },
  terms: {
    insured_amount: 250000000,
    term_months: 240,
    coverages: [
      { code: 'death', insured_amount: 250000000 },
      { code: 'total_permanent_disability', insured_amount: 250000000 },
    ],
  },
  conditions: ['validity_24h', 'onerous_beneficiary_lender', 'monthly_premium', 'max_insured_age_70'],
  rater_version: 'v1',
  applicant: { full_name: 'Ana María Pérez' },
  credit: { partner_id: 'aliado-banco-1', application_id: '48213' },
  superseded_by: null,
  renewed_by: null,
};

/** Provisional con el último perfil en caché (E3b). */
export const OFERTA_CON_CACHE_DTO: OfertaDto = {
  ...OFERTA_NORMAL_DTO,
  offer_id: 'off-cache0000000000000000000000000001',
  premium: 147400,
  mode: 'provisional',
  provisional_reason: 'cached_profile',
  profile_date: '2026-10-04T14:00:00Z',
  unavailable_source: 'open_finance',
  profile: { category: 'standard', source: 'cache' },
  conditions: [...(OFERTA_NORMAL_DTO.conditions ?? []), 'provisional_requote_when_source_restored'],
};

/** Provisional con el perfil actuarial base (E3c). */
export const OFERTA_PERFIL_BASE_DTO: OfertaDto = {
  ...OFERTA_CON_CACHE_DTO,
  offer_id: 'off-base00000000000000000000000000001',
  provisional_reason: 'base_actuarial_profile',
  profile_date: null,
  profile: { category: 'base_actuarial', source: 'base_actuarial' },
};

/** Vencida y renovable (E7). */
export const OFERTA_VENCIDA_DTO: OfertaDto = {
  ...OFERTA_NORMAL_DTO,
  offer_id: 'off-seedr1792338656',
  status: 'expired',
  expires_at: '2026-10-17T15:53:06.182906Z',
  can_accept: false,
  can_renew: true,
};

/** Reemplazada por una recotización (aviso de oferta actualizada). */
export const OFERTA_REEMPLAZADA_DTO: OfertaDto = {
  ...OFERTA_CON_CACHE_DTO,
  offer_id: 'off-a25586ff7b84d2bf27e1e34e7dc0aab4',
  status: 'superseded',
  can_accept: false,
  superseded_by: 'off-7618b94e3329fa1b05c7d6b5f4ab2297',
};

/** Vista reducida de una oferta de demostración o ajustada por el asesor (§2.2, «Ofertas de otras historias»). */
export const OFERTA_REDUCIDA_DTO: OfertaDto = {
  offer_id: 'demo-active-guia',
  kind: 'demo',
  status: 'active',
  premium: 89500,
  currency: 'COP',
  mode: 'normal',
  expires_at: '2026-10-19T15:53:06.279821462Z',
  can_accept: true,
  can_renew: false,
  channel: null,
  created_at: null,
  provisional_reason: null,
  profile_date: null,
  unavailable_source: null,
  profile: null,
  terms: null,
  conditions: null,
  rater_version: null,
  applicant: null,
  credit: null,
  superseded_by: null,
  renewed_by: null,
};
