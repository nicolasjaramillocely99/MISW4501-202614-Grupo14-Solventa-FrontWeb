import { CotizacionAsistidaDto } from '@core/api/originacion/cotizacion-asistida.modelos';

/** Forma de la respuesta de `POST /v1/assisted-quotes` documentada en `docs/contratos/HU-W1.1-01-api.md`. */
export const COTIZACION_DTO: CotizacionAsistidaDto = {
  quote_id: '3f1c8a52-7d0e-4c1b-9d3a-0e6b1f7a2c44',
  customer_id: '9a7e5c10-2b3d-4e8f-a1c2-5d6e7f8a9b0c',
  customer: { document_id: '1032456789', full_name: 'Ana María Pérez', email: 'ana@example.com' },
  insured_amount: 250000000,
  term_months: 180,
  premium: 132800,
  currency: 'COP',
  coverages: [
    { code: 'death', insured_amount: 250000000 },
    { code: 'total_permanent_disability', insured_amount: 250000000 },
  ],
  rating_version: 'v1',
  mode: 'normal',
  source: 'external_sources',
  profile: { score: 0.44, category: 'standard' },
  profile_date: '2026-10-16T14:55:00Z',
  unavailable_source: null,
  notice: null,
  created_at: '2026-10-16T15:00:00Z',
  expires_at: '2026-10-17T15:00:00Z',
  status: 'valid',
  can_formalize: true,
  blocked_reason: null,
};
