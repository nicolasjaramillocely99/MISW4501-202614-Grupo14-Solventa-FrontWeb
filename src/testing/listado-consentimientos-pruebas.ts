import { PaginaConsentimientosDto } from '@core/api/auditoria/listado-consentimientos.modelos';

/**
 * Datos de prueba del listado de consentimientos del portal de cumplimiento (HU-W4.2-01), con la forma de
 * `GET /v1/audit/consents` del contrato 0.6.0 (`docs/contratos/HU-W4.2-01-api.md` del backend).
 */

type FilaDto = PaginaConsentimientosDto['items'][number];

const ALCANCE: FilaDto['scope'] = [
  { code: 'open_finance', data_categories: ['credit_products', 'balances', 'payment_behavior'], validity: '12_months' },
  { code: 'open_data', data_categories: ['public_records'], validity: '12_months' },
  { code: 'kyc', data_categories: ['identity_verification'], validity: 'single_use' },
];

/** Una fila activa; `cambios` reemplaza los campos que la prueba necesite. */
export function filaDto(cambios: Partial<FilaDto> = {}): FilaDto {
  return {
    consent_id: 'cns-55aa31',
    holder: { full_name: 'Carolina Pérez Ruiz', document_masked: '******5678' },
    granted_at: '2026-09-16T20:52:00Z',
    expires_at: '2027-09-16T20:52:00Z',
    ended_at: null,
    status: 'active',
    revocation: null,
    grant_channel: 'embedded',
    scope: ALCANCE,
    entities: [{ code: 'aliado-banco-1', name: 'Banco Aliado' }],
    ...cambios,
  };
}

/** Las seis filas de la primera página del frame `44:4954`: activos, un revocado y un vencido. */
export const FILAS_DTO: FilaDto[] = [
  filaDto(),
  filaDto({ consent_id: 'cns-55a9f0', holder: { full_name: 'Jorge Andrés Molina', document_masked: '******5112' }, granted_at: '2026-09-16T20:31:00Z' }),
  filaDto({ consent_id: 'cns-55a7c2', holder: { full_name: 'Luis Fernando Castro', document_masked: '******2456' }, granted_at: '2026-09-15T22:40:00Z' }),
  filaDto({
    consent_id: 'cns-51b002',
    holder: { full_name: 'Marta Ruiz Ospina', document_masked: '******6902' },
    granted_at: '2026-03-02T15:15:00Z',
    expires_at: '2027-03-02T15:15:00Z',
    ended_at: '2026-09-10T15:00:00Z',
    status: 'revoked',
    revocation: { effective_at: '2026-09-10T15:00:00Z', channel: 'mobile_app', notice_status: 'completed' },
  }),
  filaDto({
    consent_id: 'cns-4f1a88',
    holder: { full_name: 'Pedro Gómez Lara', document_masked: '******0221' },
    granted_at: '2025-09-05T14:00:00Z',
    expires_at: '2026-09-05T14:00:00Z',
    ended_at: '2026-09-05T14:00:00Z',
    status: 'expired',
  }),
  filaDto({
    consent_id: 'cns-55a331',
    holder: { full_name: 'Ana María Torres', document_masked: '******4981' },
    granted_at: '2026-09-12T15:00:00Z',
    status: 'partially_revoked',
    ended_at: '2026-09-14T15:00:00Z',
    revocation: { effective_at: '2026-09-14T15:00:00Z', channel: 'compliance_portal', notice_status: 'partial' },
  }),
];

/** La primera página del frame: 6 de 1.433 registros, 239 páginas. */
export const PAGINA_DTO: PaginaConsentimientosDto = {
  items: FILAS_DTO,
  page: 1,
  page_size: 6,
  total_items: 1433,
  total_pages: 239,
  indicators: {
    active: 1284,
    expired: 112,
    revoked_last_30_days: { total: 37, mobile_app: 12, compliance_portal: 25 },
    revocations_out_of_deadline: 0,
    as_of: '2026-09-16T21:00:00Z',
  },
  entities: [
    { code: 'aliado-banco-1', name: 'Banco Aliado' },
    { code: 'cooperativa-andina', name: 'Cooperativa Andina' },
  ],
};

/** Sin resultados para el filtro (frame `877:9304`): los indicadores no cambian. */
export const PAGINA_VACIA_DTO: PaginaConsentimientosDto = {
  ...PAGINA_DTO,
  items: [],
  total_items: 0,
  total_pages: 1,
};
