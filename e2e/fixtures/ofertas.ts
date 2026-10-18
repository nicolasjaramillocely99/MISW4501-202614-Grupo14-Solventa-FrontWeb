/**
 * Ofertas con la forma de `GET /v1/offers/{offer_id}` y `POST /v1/offers` documentada en
 * `docs/contratos/HU-W1.2-03-api.md` del backend (§2). Los datos de ejemplo viven solo aquí y en las pruebas.
 */
export type OfertaSimulada = Record<string, unknown>;

const VENCE_EN = '2099-10-19T15:53:01.627931Z';
const COBERTURAS = [
  { code: 'death', insured_amount: 250000000 },
  { code: 'total_permanent_disability', insured_amount: 250000000 },
];
const CONDICIONES = ['validity_24h', 'onerous_beneficiary_lender', 'monthly_premium', 'max_insured_age_70'];

/** Oferta normal vigente (E3). */
export function ofertaNormal(id: string, cambios: OfertaSimulada = {}): OfertaSimulada {
  return {
    offer_id: id,
    kind: 'personalized',
    status: 'active',
    premium: 132000,
    currency: 'COP',
    mode: 'normal',
    expires_at: VENCE_EN,
    can_accept: true,
    can_renew: false,
    channel: 'embedded',
    created_at: '2026-10-18T15:53:01.627931Z',
    provisional_reason: null,
    profile_date: null,
    unavailable_source: null,
    profile: { category: 'standard', source: 'external_sources' },
    terms: { insured_amount: 250000000, term_months: 240, coverages: COBERTURAS },
    conditions: CONDICIONES,
    rater_version: 'v1',
    applicant: { full_name: 'Ana María Pérez' },
    credit: { partner_id: 'aliado-banco-1', application_id: '48213' },
    superseded_by: null,
    renewed_by: null,
    ...cambios,
  };
}

/** Provisional con el último perfil en caché (E3b). */
export function ofertaConCache(id: string): OfertaSimulada {
  return ofertaNormal(id, {
    premium: 147400,
    mode: 'provisional',
    provisional_reason: 'cached_profile',
    profile_date: '2026-10-04T14:00:00Z',
    unavailable_source: 'open_finance',
    profile: { category: 'standard', source: 'cache' },
    conditions: [...CONDICIONES, 'provisional_requote_when_source_restored'],
  });
}

/** Provisional con el perfil actuarial base (E3c). */
export function ofertaPerfilBase(id: string): OfertaSimulada {
  return ofertaNormal(id, {
    premium: 147400,
    mode: 'provisional',
    provisional_reason: 'base_actuarial_profile',
    unavailable_source: 'open_finance',
    profile: { category: 'base_actuarial', source: 'base_actuarial' },
    conditions: [...CONDICIONES, 'provisional_requote_when_source_restored'],
  });
}

/** Vencida y renovable (E7). */
export function ofertaVencida(id: string, cambios: OfertaSimulada = {}): OfertaSimulada {
  return ofertaNormal(id, {
    status: 'expired',
    expires_at: '2026-10-17T15:53:06.182906Z',
    can_accept: false,
    can_renew: true,
    ...cambios,
  });
}

/** Provisional reemplazada por una recotización con el perfil real. */
export function ofertaReemplazada(id: string, reemplazadaPor: string): OfertaSimulada {
  return { ...ofertaConCache(id), status: 'superseded', can_accept: false, superseded_by: reemplazadaPor };
}
