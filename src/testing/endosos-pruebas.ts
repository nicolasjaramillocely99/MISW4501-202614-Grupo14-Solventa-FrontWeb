import {
  DetalleEndosoDto,
  FilaEndosoDto,
  HistorialEndososDto,
  PaginaEndososDto,
  ResultadoAplicacionDto,
  SolicitudEndosoDto,
  ValidacionDto,
} from '@core/api/originacion/endosos.modelos';

/**
 * Respuestas de la revisión del endoso con la forma del contrato de HU-W1.4-02 (`docs/contratos/HU-W1.4-02-api.md`): una
 * página de la bandeja, el detalle de cada tipo y estado, el resultado de aplicar y el historial de una póliza.
 */

export const SOLICITUD_BENEFICIARIOS_ENDOSO_DTO: SolicitudEndosoDto = {
  request_id: 'SOL-MOD-2026-0042',
  policy_id: 'pol-acc-4f2a',
  change_type: 'beneficiaries',
  channel: 'web',
  filed_at: '2026-09-16T20:10:00Z',
  status: 'in_review',
  status_changed_at: '2026-09-16T20:30:00Z',
  returned: false,
  decision_reason: null,
  requester_name: 'Carolina Pérez Ruiz',
};

export const FILA_ENDOSO_DTO: FilaEndosoDto = {
  ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO,
  status: 'filed',
  holder: { full_name: 'Carolina Pérez Ruiz', document_id: '1020345678' },
};

export const PAGINA_ENDOSOS_DTO: PaginaEndososDto = {
  items: [
    FILA_ENDOSO_DTO,
    {
      ...FILA_ENDOSO_DTO,
      request_id: 'SOL-MOD-2026-0041',
      policy_id: 'pol-acc-9b1c',
      change_type: 'insured_amount',
      status: 'in_review',
      holder: { full_name: 'Diego Salazar Peña', document_id: '80221334' },
    },
    {
      ...FILA_ENDOSO_DTO,
      request_id: 'SOL-MOD-2026-0043',
      policy_id: 'pol-acc-9b1c',
      status: 'not_applied',
      returned: false,
      holder: { full_name: 'Diego Salazar Peña', document_id: '80221334' },
    },
    {
      ...FILA_ENDOSO_DTO,
      request_id: 'SOL-MOD-2026-0039',
      policy_id: 'pol-acc-7d2e',
      change_type: 'personal_data',
      status: 'applied',
      holder: { full_name: 'Marta Ruiz Ospina', document_id: '41556902' },
    },
  ],
  page: 1,
  page_size: 20,
  total_items: 4,
  total_pages: 1,
  indicators: {
    pending: { count: 5, overdue: 2 },
    applied_today: { count: 8, mean_time_to_apply_seconds: 12000 },
    rejected_last_7_days: { count: 1, top_reason: 'shares_total_100' },
  },
};

export const PAGINA_ENDOSOS_VACIA_DTO: PaginaEndososDto = {
  items: [],
  page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
  indicators: {
    pending: { count: 0, overdue: 0 },
    applied_today: { count: 0, mean_time_to_apply_seconds: null },
    rejected_last_7_days: { count: 0, top_reason: null },
  },
};

export const VALIDACIONES_BENEFICIARIOS_DTO: ValidacionDto[] = [
  { code: 'shares_total_100', outcome: 'passed', params: { shares: '60|40', total: '100' } },
  { code: 'onerous_beneficiary_intact', outcome: 'passed', params: { lender: 'Banco Aliado', basis: 'outstanding_balance' } },
  { code: 'identity_documents_valid', outcome: 'passed', params: { checks: '2' } },
  { code: 'no_open_claim', outcome: 'passed', params: { open_claims: '0' } },
  { code: 'requester_is_holder', outcome: 'passed', params: { requester: 'Carolina Pérez Ruiz', channel: 'web' } },
];

const POLIZA_DTO: DetalleEndosoDto['policy'] = {
  policy_id: 'pol-acc-4f2a',
  line: 'life',
  holder: { full_name: 'Carolina Pérez Ruiz', document_id: '1020345678' },
  in_force: true,
  coverage_start: '2026-07-16T12:00:00Z',
  coverage_end: '2027-07-16T12:00:00Z',
  insured_amount: 250000000,
  premium: 68500,
  currency: 'COP',
  onerous_beneficiary: { partner_id: 'aliado-banco-1', name: 'Banco Aliado', basis: 'outstanding_balance' },
  endorsements: {
    count: 1,
    last: { endorsement_id: 'END-2026-0099', change_type: 'personal_data', applied_at: '2026-09-16T19:30:00Z' },
  },
};

/** Beneficiarios en revisión: dos filas, el panel de la póliza y las cinco validaciones en vista previa. */
export const DETALLE_BENEFICIARIOS_DTO: DetalleEndosoDto = {
  request: SOLICITUD_BENEFICIARIOS_ENDOSO_DTO,
  changes: [
    {
      field: 'beneficiaries',
      previous: { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 100 },
      requested: { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 60 },
    },
    {
      field: 'beneficiaries',
      previous: null,
      requested: { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310', share_percent: 40 },
    },
  ],
  premium: null,
  policy: POLIZA_DTO,
  validations: VALIDACIONES_BENEFICIARIOS_DTO,
  validations_source: 'preview',
  decision: null,
};

/** Suma asegurada en revisión: valor y prima recalculada con el motor v1. */
export const DETALLE_SUMA_DTO: DetalleEndosoDto = {
  request: { ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO, request_id: 'SOL-MOD-2026-0045', change_type: 'insured_amount' },
  changes: [{ field: 'insured_amount', previous: 250000000, requested: 300000000 }],
  premium: { previous: 68500, new: 82200, currency: 'COP', rating_version: 'v1' },
  policy: POLIZA_DTO,
  validations: [
    { code: 'insured_amount_within_limits', outcome: 'passed', params: { requested: '300000000', min: '10000000', max: '2000000000' } },
    { code: 'no_open_claim', outcome: 'passed', params: { open_claims: '0' } },
    { code: 'requester_is_holder', outcome: 'passed', params: { requester: 'Carolina Pérez Ruiz', channel: 'web' } },
  ],
  validations_source: 'preview',
  decision: null,
};

/** Datos personales en revisión: dirección y teléfono. */
export const DETALLE_DATOS_DTO: DetalleEndosoDto = {
  request: { ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO, request_id: 'SOL-MOD-2026-0046', change_type: 'personal_data', channel: 'mobile' },
  changes: [
    { field: 'personal_data.address', previous: null, requested: 'Calle 100 # 15-20, Bogotá' },
    { field: 'personal_data.phone', previous: null, requested: '3012345678' },
  ],
  premium: null,
  policy: POLIZA_DTO,
  validations: [
    { code: 'personal_data_valid', outcome: 'passed', params: {} },
    { code: 'requester_is_holder', outcome: 'passed', params: { requester: 'Carolina Pérez Ruiz', channel: 'mobile' } },
  ],
  validations_source: 'preview',
  decision: null,
};

/** No aplicado (O3b): el documento de Lucía no está en la Registraduría; sin devolver todavía. */
export const DETALLE_NO_APLICADO_DTO: DetalleEndosoDto = {
  ...DETALLE_BENEFICIARIOS_DTO,
  request: { ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO, request_id: 'SOL-MOD-2026-0043', status: 'not_applied' },
  validations: [
    VALIDACIONES_BENEFICIARIOS_DTO[0],
    VALIDACIONES_BENEFICIARIOS_DTO[1],
    { code: 'identity_documents_valid', outcome: 'failed', params: { checks: '2', not_found: '1', document: 'TI 1142998000' } },
    VALIDACIONES_BENEFICIARIOS_DTO[3],
    VALIDACIONES_BENEFICIARIOS_DTO[4],
  ],
  validations_source: 'attempt',
  decision: {
    outcome: 'not_applied',
    by: { name: 'Andrés Ruiz', role: 'operations' },
    at: '2026-09-16T21:20:00Z',
    observations: null,
    endorsement_id: null,
    failed: ['identity_documents_valid'],
  },
};

/** Aplicada: el endoso con su autor. */
export const DETALLE_APLICADO_DTO: DetalleEndosoDto = {
  ...DETALLE_BENEFICIARIOS_DTO,
  request: { ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO, status: 'applied' },
  validations_source: 'attempt',
  policy: { ...POLIZA_DTO, endorsements: { count: 2, last: { endorsement_id: 'END-2026-0102', change_type: 'beneficiaries', applied_at: '2026-09-16T21:20:00Z' } } },
  decision: {
    outcome: 'applied',
    by: { name: 'Andrés Ruiz', role: 'operations' },
    at: '2026-09-16T21:20:00Z',
    observations: null,
    endorsement_id: 'END-2026-0102',
    failed: [],
  },
};

/** Rechazada sin intento: sin validaciones. */
export const DETALLE_RECHAZADO_DTO: DetalleEndosoDto = {
  ...DETALLE_BENEFICIARIOS_DTO,
  request: {
    ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO,
    status: 'rejected',
    decision_reason: 'El parentesco declarado no permite esta designación.',
  },
  validations: [],
  validations_source: 'none',
  decision: {
    outcome: 'rejected',
    by: { name: 'Andrés Ruiz', role: 'operations' },
    at: '2026-09-16T21:40:00Z',
    observations: 'El parentesco declarado no permite esta designación.',
    endorsement_id: null,
    failed: [],
  },
};

/** Devuelta al asegurado tras el no aplicado. */
export const DETALLE_DEVUELTO_DTO: DetalleEndosoDto = {
  ...DETALLE_NO_APLICADO_DTO,
  request: {
    ...DETALLE_NO_APLICADO_DTO.request,
    returned: true,
    decision_reason: 'El documento de Lucía no está en la Registraduría. Corrígelo y radica de nuevo.',
  },
  decision: {
    outcome: 'returned',
    by: { name: 'Andrés Ruiz', role: 'operations' },
    at: '2026-09-16T21:30:00Z',
    observations: 'El documento de Lucía no está en la Registraduría. Corrígelo y radica de nuevo.',
    endorsement_id: null,
    failed: ['identity_documents_valid'],
  },
};

export const APLICACION_APLICADA_DTO: ResultadoAplicacionDto = {
  outcome: 'applied',
  request: { ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO, status: 'applied' },
  endorsement: { endorsement_id: 'END-2026-0102', version: 2, applied_at: '2026-09-16T21:20:00Z', by: { name: 'Andrés Ruiz', role: 'operations' } },
  attempt: null,
  validations: VALIDACIONES_BENEFICIARIOS_DTO,
};

export const APLICACION_NO_APLICADA_DTO: ResultadoAplicacionDto = {
  outcome: 'not_applied',
  request: { ...SOLICITUD_BENEFICIARIOS_ENDOSO_DTO, status: 'not_applied' },
  endorsement: null,
  attempt: { at: '2026-09-16T21:20:00Z', by: { name: 'Andrés Ruiz', role: 'operations' }, failed: ['identity_documents_valid'] },
  validations: DETALLE_NO_APLICADO_DTO.validations,
};

export const HISTORIAL_ENDOSOS_DTO: HistorialEndososDto = {
  policy_id: 'pol-acc-4f2a',
  holder: { full_name: 'Carolina Pérez Ruiz', document_id: '1020345678' },
  entries: [
    {
      outcome: 'applied',
      at: '2026-09-16T21:20:00Z',
      endorsement_id: 'END-2026-0102',
      request_id: 'SOL-MOD-2026-0042',
      change_type: 'beneficiaries',
      changes: DETALLE_BENEFICIARIOS_DTO.changes,
      premium: null,
      failed: [],
      by: { name: 'Andrés Ruiz', role: 'operations' },
    },
    {
      outcome: 'not_applied',
      at: '2026-09-16T17:20:00Z',
      endorsement_id: null,
      request_id: 'SOL-MOD-2026-0041',
      change_type: 'beneficiaries',
      changes: DETALLE_BENEFICIARIOS_DTO.changes,
      premium: null,
      failed: ['identity_documents_valid'],
      by: { name: 'Andrés Ruiz', role: 'operations' },
    },
    {
      outcome: 'applied',
      at: '2026-09-15T14:00:00Z',
      endorsement_id: 'END-2026-0090',
      request_id: 'SOL-MOD-2026-0030',
      change_type: 'insured_amount',
      changes: [{ field: 'insured_amount', previous: 200000000, requested: 250000000 }],
      premium: { previous: 55000, new: 68500, currency: 'COP' },
      failed: [],
      by: { name: 'Andrés Ruiz', role: 'operations' },
    },
  ],
};

export const HISTORIAL_VACIO_DTO: HistorialEndososDto = {
  policy_id: 'pol-acc-sin',
  holder: { full_name: 'Carolina Pérez Ruiz', document_id: '1020345678' },
  entries: [],
};
