/**
 * Datos de las E2E del listado de consentimientos del portal de cumplimiento (HU-W4.2-01), con la forma de
 * `GET /v1/audit/consents` (contrato `HU-W4.2-01-api.md`, `openapi.yaml` 0.6.0). La primera fila es el consentimiento de
 * las E2E de la revocación (`CONSENTIMIENTO_ID`), así «Ver» lleva a su detalle simulado.
 */
import { CONSENTIMIENTO_ID, RespuestaConsentimiento } from './consentimientos';

const ALCANCE = [
  { code: 'open_finance', data_categories: ['credit_products', 'balances', 'payment_behavior'], validity: '12_months' },
  { code: 'open_data', data_categories: ['public_records'], validity: '12_months' },
  { code: 'kyc', data_categories: ['identity_verification'], validity: 'single_use' },
];

type Fila = ReturnType<typeof fila>;

export function fila(id: string, nombre: string, cambios: Record<string, unknown> = {}) {
  return {
    consent_id: id,
    holder: { full_name: nombre, document_masked: '******4050' },
    granted_at: '2026-10-20T15:00:00Z',
    expires_at: '2027-10-20T15:00:00Z',
    ended_at: null as string | null,
    status: 'active',
    revocation: null as { effective_at: string; channel: string; notice_status: string } | null,
    grant_channel: 'embedded',
    scope: ALCANCE,
    entities: [{ code: 'aliado-banco-1', name: 'Banco Aliado' }],
    ...cambios,
  };
}

/** Revocada desde la app el 10/09 a las 10:00 de Colombia. */
export const revocadaDesdeApp = (id: string, nombre: string): Fila =>
  fila(id, nombre, {
    status: 'revoked',
    ended_at: '2026-09-10T15:00:00Z',
    revocation: { effective_at: '2026-09-10T15:00:00Z', channel: 'mobile_app', notice_status: 'completed' },
  });

export const FILAS: Fila[] = [
  fila(CONSENTIMIENTO_ID, 'Ana María Pérez'),
  fila('cns-55a9f0', 'Jorge Andrés Molina'),
  fila('cns-55a7c2', 'Luis Fernando Castro'),
  revocadaDesdeApp('cns-51b002', 'Marta Ruiz Ospina'),
  fila('cns-4f1a88', 'Pedro Gómez Lara', { status: 'expired', ended_at: '2026-09-05T14:00:00Z', expires_at: '2026-09-05T14:00:00Z' }),
  fila('cns-55a331', 'Ana María Torres', {
    status: 'partially_revoked',
    ended_at: '2026-09-14T15:00:00Z',
    revocation: { effective_at: '2026-09-14T15:00:00Z', channel: 'compliance_portal', notice_status: 'partial' },
  }),
];

const INDICADORES = {
  active: 1284,
  expired: 112,
  revoked_last_30_days: { total: 37, mobile_app: 12, compliance_portal: 25 },
  revocations_out_of_deadline: 0,
  as_of: '2026-10-30T15:00:00Z',
};

const ENTIDADES = [
  { code: 'aliado-banco-1', name: 'Banco Aliado' },
  { code: 'cooperativa-andina', name: 'Cooperativa Andina' },
];

/** Una página del listado: por defecto la primera del frame, 6 de 1.433 en 239 páginas. */
export function pagina(
  opciones: { items?: Fila[]; page?: number; total?: number; totalPaginas?: number; indicadores?: Partial<typeof INDICADORES> } = {},
) {
  return {
    items: opciones.items ?? FILAS,
    page: opciones.page ?? 1,
    page_size: 6,
    total_items: opciones.total ?? 1433,
    total_pages: opciones.totalPaginas ?? 239,
    indicators: { ...INDICADORES, ...opciones.indicadores },
    entities: ENTIDADES,
  };
}

/** Sin resultados para el filtro (frame `877:9304`): los indicadores no cambian. */
export const sinResultados = () => pagina({ items: [], total: 0, totalPaginas: 1 });

export const respuesta = (cuerpo: unknown, estado = 200): RespuestaConsentimiento => ({ estado, cuerpo });
