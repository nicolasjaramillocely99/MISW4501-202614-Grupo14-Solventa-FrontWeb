import { EstadoRevocacionDto } from '@core/api/auditoria/revocacion.modelos';

/** Identificador del consentimiento de los ejemplos del contrato HU-W4.2-02. */
export const CONSENTIMIENTO_ID = 'cns-4f1c2a9be0d34c6f8a7e5d1b2c3a4f5e';

const TITULAR = { full_name: 'Ana María Pérez', document_masked: '******4050' };

const ALCANCE: EstadoRevocacionDto['scope'] = [
  { code: 'open_finance', data_categories: ['credit_products', 'balances', 'payment_behavior'], validity: '12_months' },
  { code: 'open_data', data_categories: ['public_records'], validity: '12_months' },
  { code: 'kyc', data_categories: ['identity_verification'], validity: 'single_use' },
];

const ENTIDADES = [{ code: 'aliado-banco-1', name: 'Banco Aliado' }];

const OTORGADO = { status: 'granted', occurred_at: '2026-10-20T15:00:00Z', entity_code: null, actor_type: null, reason: null, reference: null };

/** Ejemplo del contrato: consentimiento activo (abre el modal). */
export const ESTADO_ACTIVO_DTO: EstadoRevocacionDto = {
  consent_id: CONSENTIMIENTO_ID,
  status: 'active',
  revocable: true,
  holder: TITULAR,
  scope: ALCANCE,
  entities: ENTIDADES,
  revocation: null,
  history: [OTORGADO],
};

/** Revocado desde el portal con el aviso en curso: la entidad sigue `pending` (respuesta del 201). */
export const ESTADO_EN_CURSO_DTO: EstadoRevocacionDto = {
  ...ESTADO_ACTIVO_DTO,
  status: 'revoked',
  revocable: false,
  revocation: {
    receipt_number: 'REV-2026-0089',
    requested_at: '2026-10-25T16:00:00.123456Z',
    effective_at: '2026-10-25T16:00:00.123456Z',
    channel: 'compliance_portal',
    notice_status: 'in_progress',
    requested_by: { type: 'operations', id: 'sub-operaciones' },
    reason: 'customer_request',
    reference: 'TCK-2026-0412',
    entities: [
      { code: 'aliado-banco-1', name: 'Banco Aliado', status: 'pending', confirmed_at: null, deadline_at: '2026-10-25T16:05:00.123456Z' },
    ],
  },
  history: [
    OTORGADO,
    { status: 'revocation_requested', occurred_at: '2026-10-25T16:00:00.123456Z', entity_code: null, actor_type: 'operations', reason: 'customer_request', reference: 'TCK-2026-0412' },
    { status: 'revoked', occurred_at: '2026-10-25T16:00:00.123456Z', entity_code: null, actor_type: 'operations', reason: null, reference: null },
  ],
};

/** Todas las entidades confirmaron: «Revocado». */
export const ESTADO_REVOCADO_DTO: EstadoRevocacionDto = {
  ...ESTADO_EN_CURSO_DTO,
  revocation: {
    ...ESTADO_EN_CURSO_DTO.revocation!,
    notice_status: 'completed',
    entities: [
      {
        code: 'aliado-banco-1',
        name: 'Banco Aliado',
        status: 'confirmed',
        confirmed_at: '2026-10-25T16:01:10Z',
        deadline_at: '2026-10-25T16:05:00.123456Z',
      },
    ],
  },
  history: [
    ...ESTADO_EN_CURSO_DTO.history,
    { status: 'revocation_confirmed', occurred_at: '2026-10-25T16:01:10Z', entity_code: 'aliado-banco-1', actor_type: 'system', reason: null, reference: null },
  ],
};

/** Ejemplo del contrato: revocación parcial, la entidad no confirmó dentro de su plazo. */
export const ESTADO_PARCIAL_DTO: EstadoRevocacionDto = {
  ...ESTADO_EN_CURSO_DTO,
  status: 'partially_revoked',
  revocation: {
    ...ESTADO_EN_CURSO_DTO.revocation!,
    notice_status: 'partial',
    entities: [
      { code: 'aliado-banco-1', name: 'Banco Aliado', status: 'not_confirmed', confirmed_at: null, deadline_at: '2026-10-25T16:05:00.123456Z' },
    ],
  },
  history: [
    ...ESTADO_EN_CURSO_DTO.history,
    { status: 'revocation_not_confirmed', occurred_at: '2026-10-25T16:05:00.123456Z', entity_code: 'aliado-banco-1', actor_type: 'system', reason: null, reference: null },
  ],
};

/** Revocado por el titular desde la app: sin motivo ni referencia. */
export const ESTADO_REVOCADO_EN_APP_DTO: EstadoRevocacionDto = {
  ...ESTADO_REVOCADO_DTO,
  revocation: {
    ...ESTADO_REVOCADO_DTO.revocation!,
    channel: 'mobile_app',
    requested_by: { type: 'holder', id: 'sub-titular' },
    reason: null,
    reference: null,
  },
};

/** Consentimiento vencido: no se puede revocar. */
export const ESTADO_VENCIDO_DTO: EstadoRevocacionDto = {
  ...ESTADO_ACTIVO_DTO,
  status: 'expired',
  revocable: false,
  history: [OTORGADO, { status: 'expired', occurred_at: '2027-10-20T15:00:00Z', entity_code: null, actor_type: null, reason: null, reference: null }],
};
