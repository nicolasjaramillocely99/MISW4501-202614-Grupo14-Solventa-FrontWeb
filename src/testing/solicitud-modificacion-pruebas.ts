import {
  CondicionesVigentesDto,
  FilaSolicitudDto,
  PaginaSolicitudesDto,
  SolicitudModificacionDto,
} from '@core/api/originacion/solicitud-modificacion.modelos';

/**
 * Respuestas de la solicitud de modificación del asegurado con la forma del contrato de HU-W1.4-01
 * (`docs/contratos/HU-W1.4-01-api.md`): las condiciones vigentes de una póliza, una solicitud radicada de cada tipo, sus
 * estados posteriores (los que escribe HU-W1.4-02) y una página de «Mis solicitudes».
 */

/** Condiciones de una póliza vigente de Carolina, sin beneficiarios designados ni solicitudes abiertas. */
export const CONDICIONES_VIGENTES_DTO: CondicionesVigentesDto = {
  policy: {
    policy_id: 'pol-acc-4f2a',
    line: 'life',
    holder_name: 'Carolina Pérez',
    coverage_start: '2026-07-16T12:00:00Z',
    coverage_end: '2027-07-16T12:00:00Z',
    in_force: true,
  },
  terms: {
    insured_amount: 68000000,
    currency: 'COP',
    beneficiaries: [],
    onerous_beneficiary: { partner_id: 'aliado-banco-1', name: 'Banco Aliado', basis: 'outstanding_balance' },
    personal_data: { address: null, email: 'carolina@example.com', phone: null },
  },
  open_requests: [],
  limits: {
    insured_amount_min: 10000000,
    insured_amount_max: 2000000000,
    max_beneficiaries: 10,
    relationships: ['spouse_or_partner', 'child', 'parent', 'sibling', 'grandchild', 'other'],
    document_types: ['CC', 'TI', 'RC', 'CE', 'PA'],
  },
};

/** La misma póliza con un beneficiario designado y una solicitud de beneficiarios abierta. */
export const CONDICIONES_CON_ABIERTA_DTO: CondicionesVigentesDto = {
  ...CONDICIONES_VIGENTES_DTO,
  terms: {
    ...CONDICIONES_VIGENTES_DTO.terms,
    beneficiaries: [
      { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 100 },
    ],
  },
  open_requests: [
    { request_id: 'SOL-MOD-2026-0042', change_type: 'beneficiaries', status: 'filed', filed_at: '2026-09-16T20:10:00Z' },
  ],
};

/** Una póliza que ya no está vigente: A3 no deja radicar. */
export const CONDICIONES_NO_VIGENTE_DTO: CondicionesVigentesDto = {
  ...CONDICIONES_VIGENTES_DTO,
  policy: { ...CONDICIONES_VIGENTES_DTO.policy, coverage_end: '2026-06-01T12:00:00Z', in_force: false },
};

/** Venta del asesor: el aliado que otorgó el crédito no se conoce (etiqueta genérica). */
export const CONDICIONES_VENTA_ASESOR_DTO: CondicionesVigentesDto = {
  ...CONDICIONES_VIGENTES_DTO,
  terms: { ...CONDICIONES_VIGENTES_DTO.terms, onerous_beneficiary: { partner_id: null, name: null, basis: 'outstanding_balance' } },
};

/** Cambio de beneficiarios recién radicado (Mateo 60 %, Lucía 40 %). */
export const SOLICITUD_BENEFICIARIOS_DTO: SolicitudModificacionDto = {
  request_id: 'SOL-MOD-2026-0042',
  policy_id: 'pol-acc-4f2a',
  change_type: 'beneficiaries',
  channel: 'web',
  status: 'filed',
  status_changed_at: '2026-09-16T20:10:00Z',
  decision_reason: null,
  filed_at: '2026-09-16T20:10:00Z',
  requested_by: { email: 'carolina@example.com', name: null },
  previous: {
    beneficiaries: [],
    onerous_beneficiary: { partner_id: 'aliado-banco-1', name: 'Banco Aliado', basis: 'outstanding_balance' },
  },
  requested: {
    beneficiaries: [
      { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 60 },
      { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310', share_percent: 40 },
    ],
  },
  changes: [
    {
      field: 'beneficiaries',
      previous: null,
      requested: { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 60 },
    },
    {
      field: 'beneficiaries',
      previous: null,
      requested: { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310', share_percent: 40 },
    },
  ],
};

/** Cambio del valor asegurado, en revisión. */
export const SOLICITUD_SUMA_EN_REVISION_DTO: SolicitudModificacionDto = {
  request_id: 'SOL-MOD-2026-0031',
  policy_id: 'pol-acc-4f2a',
  change_type: 'insured_amount',
  channel: 'web',
  status: 'in_review',
  status_changed_at: '2026-09-17T14:00:00Z',
  decision_reason: null,
  filed_at: '2026-09-15T13:00:00Z',
  requested_by: { email: 'carolina@example.com', name: 'Carolina Pérez' },
  previous: { insured_amount: 68000000, currency: 'COP' },
  requested: { insured_amount: 80000000, currency: 'COP' },
  changes: [{ field: 'insured_amount', previous: 68000000, requested: 80000000 }],
};

/** Datos de contacto aplicados por el analista. */
export const SOLICITUD_CONTACTO_APLICADA_DTO: SolicitudModificacionDto = {
  request_id: 'SOL-MOD-2026-0018',
  policy_id: 'pol-acc-4f2a',
  change_type: 'personal_data',
  channel: 'web',
  status: 'applied',
  status_changed_at: '2026-06-05T16:20:00Z',
  decision_reason: null,
  filed_at: '2026-06-04T15:00:00Z',
  requested_by: { email: 'carolina@example.com', name: 'Carolina Pérez' },
  previous: { personal_data: { address: null, email: 'carolina@example.com', phone: null } },
  requested: { personal_data: { address: 'Calle 45 # 12-30, Bogotá', email: null, phone: '3012345678' } },
  changes: [
    { field: 'personal_data.address', previous: null, requested: 'Calle 45 # 12-30, Bogotá' },
    { field: 'personal_data.phone', previous: null, requested: '3012345678' },
  ],
};

/** Valor asegurado rechazado con el motivo que ve el asegurado. */
export const SOLICITUD_RECHAZADA_DTO: SolicitudModificacionDto = {
  ...SOLICITUD_SUMA_EN_REVISION_DTO,
  request_id: 'SOL-MOD-2026-0007',
  status: 'rejected',
  status_changed_at: '2026-03-13T14:45:00Z',
  decision_reason: 'Falta el avalúo del inmueble',
  filed_at: '2026-03-12T15:00:00Z',
};

/** No aplicada y devuelta al asegurado con motivo: la ve «Rechazada» (ajuste A-1). */
export const SOLICITUD_NO_APLICADA_DEVUELTA_DTO: SolicitudModificacionDto = {
  ...SOLICITUD_BENEFICIARIOS_DTO,
  request_id: 'SOL-MOD-2026-0050',
  status: 'not_applied',
  status_changed_at: '2026-09-18T15:00:00Z',
  decision_reason: 'El documento de un beneficiario no es válido',
};

/** No aplicada sin motivo: el analista sigue trabajándola, el asegurado la ve «En revisión». */
export const SOLICITUD_NO_APLICADA_DTO: SolicitudModificacionDto = {
  ...SOLICITUD_NO_APLICADA_DEVUELTA_DTO,
  request_id: 'SOL-MOD-2026-0051',
  decision_reason: null,
};

export function filaDe(dto: SolicitudModificacionDto): FilaSolicitudDto {
  return {
    request_id: dto.request_id,
    policy_id: dto.policy_id,
    change_type: dto.change_type,
    channel: dto.channel,
    status: dto.status,
    status_changed_at: dto.status_changed_at,
    decision_reason: dto.decision_reason,
    filed_at: dto.filed_at,
  };
}

/** «Mis solicitudes» con los cinco estados guardados. */
export const PAGINA_SOLICITUDES_DTO: PaginaSolicitudesDto = {
  items: [
    filaDe(SOLICITUD_NO_APLICADA_DEVUELTA_DTO),
    filaDe(SOLICITUD_NO_APLICADA_DTO),
    filaDe(SOLICITUD_BENEFICIARIOS_DTO),
    filaDe(SOLICITUD_SUMA_EN_REVISION_DTO),
    filaDe(SOLICITUD_CONTACTO_APLICADA_DTO),
    filaDe(SOLICITUD_RECHAZADA_DTO),
  ],
  page: 1,
  page_size: 20,
  total_items: 6,
  total_pages: 1,
  indicators: {
    open: {
      count: 3,
      latest: { request_id: 'SOL-MOD-2026-0042', change_type: 'beneficiaries', filed_at: '2026-09-16T20:10:00Z', status_changed_at: '2026-09-16T20:10:00Z' },
    },
    applied_this_year: {
      count: 1,
      latest: { request_id: 'SOL-MOD-2026-0018', change_type: 'personal_data', filed_at: '2026-06-04T15:00:00Z', status_changed_at: '2026-06-05T16:20:00Z' },
    },
    rejected: {
      count: 2,
      latest: { request_id: 'SOL-MOD-2026-0050', change_type: 'beneficiaries', filed_at: '2026-09-16T20:10:00Z', status_changed_at: '2026-09-18T15:00:00Z' },
    },
  },
  policies: ['pol-acc-4f2a'],
};

/** Sin solicitudes: el estado vacío de A11. */
export const PAGINA_SOLICITUDES_VACIA_DTO: PaginaSolicitudesDto = {
  items: [],
  page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
  indicators: {
    open: { count: 0, latest: null },
    applied_this_year: { count: 0, latest: null },
    rejected: { count: 0, latest: null },
  },
  policies: [],
};
