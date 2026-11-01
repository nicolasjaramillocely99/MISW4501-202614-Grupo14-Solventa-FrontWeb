import {
  CredencialesEmitidasDto,
  DetalleSocioDto,
  ListadoSociosDto,
  ResumenSocioDto,
} from '@core/api/socios/socios.modelos';

/**
 * Datos de prueba de la gestión de socios y sus credenciales con la forma del contrato de HU-W3.1-01
 * (`docs/contratos/HU-W3.1-01-api.md` del backend). Los nombres y cifras son los del frame O10 / O11.
 */

export const SOCIO_ID = 'ptn-5f0c2a9e6d7b4c1a8e3f9b2d4c6a8e10';
export const SOCIO_PENDIENTE_ID = 'ptn-0a1b2c3d4e5f60718293a4b5c6d7e8f9';

const ANALISTA = { type: 'operations', id: 'sub-operaciones', label: 'andres.ruiz@solventa.co' };
const SISTEMA = { type: 'system', id: 'partners', label: 'Sistema' };

export const SOCIO_ACTIVO_RESUMEN_DTO: ResumenSocioDto = {
  partner_id: SOCIO_ID,
  code: 'ten_bancoaliado',
  name: 'Banco Aliado',
  type: 'bank',
  status: 'active',
  credentials_status: 'active',
  usage_status: 'normal',
  registered_at: '2026-03-03T15:20:00Z',
  approved_at: '2026-03-03T15:30:00Z',
  quota: { period: 'day', daily_limit: 5000, rate_limit: 100, burst_limit: 200 },
  usage: { date: '2026-11-01', used: 3120, remaining: 1880, percent: 62.4 },
};

export const LISTADO_SOCIOS_DTO: ListadoSociosDto = {
  items: [
    SOCIO_ACTIVO_RESUMEN_DTO,
    {
      partner_id: 'ptn-aerolinea',
      code: 'ten_aerolinea',
      name: 'Aerolínea Aliada',
      type: 'airline',
      status: 'active',
      credentials_status: 'rotation_in_progress',
      usage_status: 'near_limit',
      registered_at: '2026-04-10T12:00:00Z',
      approved_at: '2026-04-10T13:00:00Z',
      quota: { period: 'day', daily_limit: 2000, rate_limit: 50, burst_limit: 100 },
      usage: { date: '2026-11-01', used: 1980, remaining: 20, percent: 99 },
    },
    {
      partner_id: 'ptn-comercio',
      code: 'ten_comercio',
      name: 'Comercio Digital',
      type: 'ecommerce',
      status: 'active',
      credentials_status: 'active',
      usage_status: 'unknown',
      registered_at: '2026-06-01T12:00:00Z',
      approved_at: '2026-06-01T13:00:00Z',
      quota: { period: 'day', daily_limit: 1000, rate_limit: 20, burst_limit: 40 },
      usage: null,
    },
    {
      partner_id: SOCIO_PENDIENTE_ID,
      code: 'ten_fintech',
      name: 'Fintech Pagos',
      type: 'fintech',
      status: 'pending_approval',
      credentials_status: 'none',
      usage_status: 'none',
      registered_at: '2026-09-15T12:00:00Z',
      approved_at: null,
      quota: { period: 'day', daily_limit: 1000, rate_limit: 10, burst_limit: 20 },
      usage: null,
    },
  ],
  indicators: { active_partners: 3, average_quota_used_percent: 80.7, near_limit_partners: 1, near_limit_names: ['Aerolínea Aliada'] },
};

export const LISTADO_VACIO_DTO: ListadoSociosDto = {
  items: [],
  indicators: { active_partners: 0, average_quota_used_percent: null, near_limit_partners: 0, near_limit_names: [] },
};

export const SOCIO_ACTIVO_DTO: DetalleSocioDto = {
  ...SOCIO_ACTIVO_RESUMEN_DTO,
  products: ['vida hipotecario', 'hogar'],
  technical_contact_email: 'api@bancoaliado.co',
  environment: 'staging',
  registered_by: ANALISTA,
  credentials: {
    authentication: 'api_key',
    header: 'x-api-key',
    default_grace_period_hours: 24,
    active: {
      credential_id: 'crd-activa',
      client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2',
      secret_hint: 'a1c9',
      issued_at: '2026-03-03T15:30:00Z',
      issued_by: ANALISTA,
    },
    previous: null,
    first_issued_at: '2026-03-03T15:30:00Z',
    first_issued_by: ANALISTA,
    last_rotated_at: null,
    last_rotated_by: null,
  },
  history: [
    {
      event_id: 'pev-2',
      type: 'credentials_issued',
      occurred_at: '2026-03-03T15:30:00Z',
      actor: ANALISTA,
      status: 'applied',
      details: { client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2', daily_limit: 5000, rate_limit: 100, burst_limit: 200 },
    },
    { event_id: 'pev-1', type: 'registered', occurred_at: '2026-03-03T15:20:00Z', actor: ANALISTA, status: 'applied', details: {} },
  ],
};

/** El mismo socio justo después de rotar: la credencial anterior sigue vigente 24 h (CA-5). */
export const SOCIO_ROTANDO_DTO: DetalleSocioDto = {
  ...SOCIO_ACTIVO_DTO,
  credentials_status: 'rotation_in_progress',
  credentials: {
    ...SOCIO_ACTIVO_DTO.credentials!,
    active: {
      credential_id: 'crd-nueva',
      client_id: 'sol_0b6f1c2a3d4e5f60718293a4',
      secret_hint: 'Zp9Q',
      issued_at: '2026-11-01T14:00:00Z',
      issued_by: ANALISTA,
    },
    previous: {
      credential_id: 'crd-activa',
      client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2',
      secret_hint: 'a1c9',
      issued_at: '2026-03-03T15:30:00Z',
      expires_at: '2026-11-02T14:00:00Z',
    },
    last_rotated_at: '2026-11-01T14:00:00Z',
    last_rotated_by: ANALISTA,
  },
  history: [
    {
      event_id: 'pev-3',
      type: 'credentials_rotated',
      occurred_at: '2026-11-01T14:00:00Z',
      actor: ANALISTA,
      status: 'in_progress',
      details: {
        client_id: 'sol_0b6f1c2a3d4e5f60718293a4',
        previous_client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2',
        grace_period_hours: 24,
        previous_expires_at: '2026-11-02T14:00:00Z',
      },
    },
    ...SOCIO_ACTIVO_DTO.history,
  ],
};

/** Una rotación anterior cuya credencial ya revocó el proceso al vencer la transición. */
export const SOCIO_CON_REVOCACION_DTO: DetalleSocioDto = {
  ...SOCIO_ACTIVO_DTO,
  history: [
    {
      event_id: 'pev-4',
      type: 'credentials_revoked',
      occurred_at: '2026-11-02T14:00:00Z',
      actor: SISTEMA,
      status: 'applied',
      details: { client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2', reason: 'grace_period_ended' },
    },
    ...SOCIO_ACTIVO_DTO.history,
  ],
};

export const SOCIO_PENDIENTE_DTO: DetalleSocioDto = {
  ...LISTADO_SOCIOS_DTO.items[3],
  products: ['viajes'],
  technical_contact_email: 'api@fintechpagos.co',
  environment: 'staging',
  registered_by: ANALISTA,
  credentials: null,
  history: [{ event_id: 'pev-10', type: 'registered', occurred_at: '2026-09-15T12:00:00Z', actor: ANALISTA, status: 'applied', details: {} }],
};

export const SECRETO = 'Zp3kV8wQe1nR5tYb7uIo0pAs2dFg4hJk6lZx9cVbZp9Q';

export const ROTACION_DTO: CredencialesEmitidasDto = {
  partner: SOCIO_ROTANDO_DTO,
  secret: { client_id: 'sol_0b6f1c2a3d4e5f60718293a4', client_secret: SECRETO, header: 'x-api-key' },
};

export const APROBACION_DTO: CredencialesEmitidasDto = {
  partner: {
    ...SOCIO_PENDIENTE_DTO,
    status: 'active',
    credentials_status: 'active',
    usage_status: 'normal',
    approved_at: '2026-11-01T15:00:00Z',
    usage: { date: '2026-11-01', used: 0, remaining: 1000, percent: 0 },
    credentials: {
      ...SOCIO_ACTIVO_DTO.credentials!,
      active: {
        credential_id: 'crd-fintech',
        client_id: 'sol_fintech0000000000000001',
        secret_hint: 'Zp9Q',
        issued_at: '2026-11-01T15:00:00Z',
        issued_by: ANALISTA,
      },
      first_issued_at: '2026-11-01T15:00:00Z',
    },
  },
  secret: { client_id: 'sol_fintech0000000000000001', client_secret: SECRETO, header: 'x-api-key' },
};
