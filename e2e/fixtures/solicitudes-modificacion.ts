/**
 * Datos de las E2E de la solicitud de modificación del asegurado (HU-W1.4-01), con la forma del contrato
 * (`HU-W1.4-01-api.md`, `openapi.yaml` 0.16.0): la billetera de A1 con una póliza en vigor, sus condiciones vigentes, las
 * solicitudes en sus cinco estados y las páginas de «Mis solicitudes». Los estados posteriores a «radicada» los escribe
 * HU-W1.4-02; aquí se simulan.
 */

export const POLIZA = 'pol-acc-4f2a';

/** `GET /v1/policies`: una póliza de originación en vigor (la fecha del sistema es la real, así que vence en 2099). */
export const BILLETERA = {
  partial: false,
  items: [
    {
      policy_id: POLIZA,
      source: 'origination',
      line: 'life',
      product: null,
      insured_object: null,
      status: 'active',
      holder_name: 'Carolina Pérez',
      holder: { full_name: 'Carolina Pérez', document_type: null, document_id: '1032456789' },
      premium: 142300,
      currency: 'COP',
      insured_amount: 68000000,
      coverages: [{ code: 'death', insured_amount: 68000000 }],
      coverage_start: '2026-01-01T12:00:00Z',
      coverage_end: '2099-01-01T12:00:00Z',
      renewal_of: null,
      renewal_window: { opens_at: '2098-12-02T12:00:00Z', closes_at: '2099-01-01T12:00:00Z' },
      can_renew: false,
      renewal: null,
    },
  ],
};

export function condiciones(cambios: Record<string, unknown> = {}) {
  return {
    policy: {
      policy_id: POLIZA,
      line: 'life',
      holder_name: 'Carolina Pérez',
      coverage_start: '2026-01-01T12:00:00Z',
      coverage_end: '2099-01-01T12:00:00Z',
      in_force: true,
    },
    terms: {
      insured_amount: 68000000,
      currency: 'COP',
      beneficiaries: [],
      onerous_beneficiary: { partner_id: 'aliado-banco-1', name: 'Banco Aliado', basis: 'outstanding_balance' },
      personal_data: { address: null, email: 'carolina.perez@solventa.co', phone: null },
    },
    open_requests: [] as Record<string, unknown>[],
    limits: {
      insured_amount_min: 10000000,
      insured_amount_max: 2000000000,
      max_beneficiaries: 10,
      relationships: ['spouse_or_partner', 'child', 'parent', 'sibling', 'grandchild', 'other'],
      document_types: ['CC', 'TI', 'RC', 'CE', 'PA'],
    },
    ...cambios,
  };
}

const MATEO = { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 60 };
const LUCIA = { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310', share_percent: 40 };

export function solicitud(id: string, cambios: Record<string, unknown> = {}) {
  return {
    request_id: id,
    policy_id: POLIZA,
    change_type: 'beneficiaries',
    channel: 'web',
    status: 'filed',
    status_changed_at: '2026-09-16T20:10:00Z',
    decision_reason: null as string | null,
    filed_at: '2026-09-16T20:10:00Z',
    requested_by: { email: 'carolina.perez@solventa.co', name: null as string | null },
    previous: {
      beneficiaries: [],
      onerous_beneficiary: { partner_id: 'aliado-banco-1', name: 'Banco Aliado', basis: 'outstanding_balance' },
    },
    requested: { beneficiaries: [MATEO, LUCIA] },
    changes: [
      { field: 'beneficiaries', previous: null, requested: MATEO },
      { field: 'beneficiaries', previous: null, requested: LUCIA },
    ],
    ...cambios,
  };
}

const SUMA = {
  change_type: 'insured_amount',
  previous: { insured_amount: 68000000, currency: 'COP' },
  requested: { insured_amount: 80000000, currency: 'COP' },
  changes: [{ field: 'insured_amount', previous: 68000000, requested: 80000000 }],
};

/** Las cinco formas de una solicitud que ve el asegurado. */
export const SOLICITUDES = {
  radicada: solicitud('SOL-MOD-2026-0042'),
  enRevision: solicitud('SOL-MOD-2026-0031', { ...SUMA, status: 'in_review', status_changed_at: '2026-09-17T14:00:00Z' }),
  aplicada: solicitud('SOL-MOD-2026-0018', {
    change_type: 'personal_data',
    status: 'applied',
    status_changed_at: '2026-06-05T16:20:00Z',
    filed_at: '2026-06-04T15:00:00Z',
    previous: { personal_data: { address: null, email: 'carolina.perez@solventa.co', phone: null } },
    requested: { personal_data: { address: 'Calle 45 # 12-30, Bogotá', email: null, phone: '3012345678' } },
    changes: [{ field: 'personal_data.address', previous: null, requested: 'Calle 45 # 12-30, Bogotá' }],
  }),
  rechazada: solicitud('SOL-MOD-2026-0007', {
    ...SUMA,
    status: 'rejected',
    status_changed_at: '2026-03-13T14:45:00Z',
    filed_at: '2026-03-12T15:00:00Z',
    decision_reason: 'Falta el avalúo del inmueble',
  }),
  devuelta: solicitud('SOL-MOD-2026-0050', {
    status: 'not_applied',
    status_changed_at: '2026-09-18T15:00:00Z',
    decision_reason: 'El documento de un beneficiario no es válido',
  }),
  noAplicada: solicitud('SOL-MOD-2026-0051', { status: 'not_applied', status_changed_at: '2026-09-18T15:00:00Z' }),
};

type Solicitud = ReturnType<typeof solicitud>;

function fila(s: Solicitud) {
  return {
    request_id: s.request_id,
    policy_id: s.policy_id,
    change_type: s.change_type,
    channel: s.channel,
    status: s.status,
    status_changed_at: s.status_changed_at,
    decision_reason: s.decision_reason,
    filed_at: s.filed_at,
  };
}

const TODAS: Solicitud[] = [
  SOLICITUDES.devuelta,
  SOLICITUDES.noAplicada,
  SOLICITUDES.radicada,
  SOLICITUDES.enRevision,
  SOLICITUDES.aplicada,
  SOLICITUDES.rechazada,
];

/** Lo que ve el asegurado de cada estado guardado, para filtrar como el servicio (ajuste A-1). */
function estadoVisible(s: Solicitud): string {
  if (s.status === 'not_applied') {
    return s.decision_reason ? 'rejected' : 'in_review';
  }
  return s.status;
}

/** `GET /v1/policies/change-requests` como el servicio: filtra por estado visible y póliza, pagina y cuenta. */
export function pagina(params: URLSearchParams, todas: Solicitud[] = TODAS) {
  const estado = params.get('status');
  const poliza = params.get('policy_id');
  const tamano = Number(params.get('page_size') ?? '20');
  const numero = Number(params.get('page') ?? '1');
  const filtradas = todas.filter((s) => (!estado || estadoVisible(s) === estado) && (!poliza || s.policy_id === poliza));
  const items = filtradas.slice((numero - 1) * tamano, numero * tamano).map(fila);
  const ultima = (s: Solicitud | undefined) =>
    s ? { request_id: s.request_id, change_type: s.change_type, filed_at: s.filed_at, status_changed_at: s.status_changed_at } : null;
  return {
    items,
    page: numero,
    page_size: tamano,
    total_items: filtradas.length,
    total_pages: Math.ceil(filtradas.length / tamano),
    indicators: {
      open: { count: todas.filter((s) => ['filed', 'in_review'].includes(estadoVisible(s))).length, latest: ultima(todas.find((s) => estadoVisible(s) === 'filed')) },
      applied_this_year: { count: todas.filter((s) => s.status === 'applied').length, latest: ultima(todas.find((s) => s.status === 'applied')) },
      rejected: { count: todas.filter((s) => estadoVisible(s) === 'rejected').length, latest: ultima(todas.find((s) => estadoVisible(s) === 'rejected')) },
    },
    policies: todas.length ? [POLIZA] : [],
  };
}
