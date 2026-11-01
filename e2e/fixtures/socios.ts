/**
 * Respuestas simuladas del servicio de socios (HU-W3.1-01) con la forma de `docs/contratos/HU-W3.1-01-api.md` del
 * backend. Los nombres y cifras son los del frame O10 / O11.
 */

export const SOCIO_ID = 'ptn-5f0c2a9e6d7b4c1a8e3f9b2d4c6a8e10';
export const PENDIENTE_ID = 'ptn-0a1b2c3d4e5f60718293a4b5c6d7e8f9';
export const SECRETO = 'Zp3kV8wQe1nR5tYb7uIo0pAs2dFg4hJk6lZx9cVbZp9Q';

const ANALISTA = { type: 'operations', id: 'sub-operaciones', label: 'andres.ruiz@solventa.co' };
const CUOTA = { period: 'day', daily_limit: 5000, rate_limit: 100, burst_limit: 200 };

const resumenBanco = {
  partner_id: SOCIO_ID,
  code: 'ten_bancoaliado',
  name: 'Banco Aliado',
  type: 'bank',
  status: 'active',
  credentials_status: 'active',
  usage_status: 'normal',
  registered_at: '2026-03-03T15:20:00Z',
  approved_at: '2026-03-03T15:30:00Z',
  quota: CUOTA,
  usage: { date: '2026-11-01', used: 3120, remaining: 1880, percent: 62.4 },
};

const resumenPendiente = {
  partner_id: PENDIENTE_ID,
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
};

export const LISTADO = {
  items: [
    resumenBanco,
    {
      ...resumenBanco,
      partner_id: 'ptn-aerolinea',
      code: 'ten_aerolinea',
      name: 'Aerolínea Aliada',
      type: 'airline',
      usage_status: 'near_limit',
      quota: { period: 'day', daily_limit: 2000, rate_limit: 50, burst_limit: 100 },
      usage: { date: '2026-11-01', used: 1980, remaining: 20, percent: 99 },
    },
    resumenPendiente,
  ],
  indicators: { active_partners: 2, average_quota_used_percent: 80.7, near_limit_partners: 1, near_limit_names: ['Aerolínea Aliada'] },
};

const credenciales = {
  authentication: 'api_key',
  header: 'x-api-key',
  default_grace_period_hours: 24,
  active: { credential_id: 'crd-activa', client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2', secret_hint: 'a1c9', issued_at: '2026-03-03T15:30:00Z', issued_by: ANALISTA },
  previous: null,
  first_issued_at: '2026-03-03T15:30:00Z',
  first_issued_by: ANALISTA,
  last_rotated_at: null,
  last_rotated_by: null,
};

export const DETALLE_BANCO = {
  ...resumenBanco,
  products: ['vida hipotecario', 'hogar'],
  technical_contact_email: 'api@bancoaliado.co',
  environment: 'staging',
  registered_by: ANALISTA,
  credentials: credenciales,
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

export const ROTACION = {
  partner: {
    ...DETALLE_BANCO,
    credentials_status: 'rotation_in_progress',
    credentials: {
      ...credenciales,
      active: { credential_id: 'crd-nueva', client_id: 'sol_0b6f1c2a3d4e5f60718293a4', secret_hint: 'Zp9Q', issued_at: '2026-11-01T14:00:00Z', issued_by: ANALISTA },
      previous: { credential_id: 'crd-activa', client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2', secret_hint: 'a1c9', issued_at: '2026-03-03T15:30:00Z', expires_at: '2026-11-03T14:00:00Z' },
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
        details: { client_id: 'sol_0b6f1c2a3d4e5f60718293a4', previous_client_id: 'sol_7f3a91c2e8d4b06f5a1c91e2', grace_period_hours: 48 },
      },
      ...DETALLE_BANCO.history,
    ],
  },
  secret: { client_id: 'sol_0b6f1c2a3d4e5f60718293a4', client_secret: SECRETO, header: 'x-api-key' },
};

export const DETALLE_PENDIENTE = {
  ...resumenPendiente,
  products: ['viajes'],
  technical_contact_email: 'api@fintechpagos.co',
  environment: 'staging',
  registered_by: ANALISTA,
  credentials: null,
  history: [{ event_id: 'pev-10', type: 'registered', occurred_at: '2026-09-15T12:00:00Z', actor: ANALISTA, status: 'applied', details: {} }],
};

export const APROBACION = {
  partner: {
    ...DETALLE_PENDIENTE,
    status: 'active',
    credentials_status: 'active',
    usage_status: 'normal',
    approved_at: '2026-11-01T15:00:00Z',
    usage: { date: '2026-11-01', used: 0, remaining: 1000, percent: 0 },
    credentials: {
      ...credenciales,
      active: { credential_id: 'crd-fintech', client_id: 'sol_fintech0000000000000001', secret_hint: 'Zp9Q', issued_at: '2026-11-01T15:00:00Z', issued_by: ANALISTA },
      first_issued_at: '2026-11-01T15:00:00Z',
    },
  },
  secret: { client_id: 'sol_fintech0000000000000001', client_secret: SECRETO, header: 'x-api-key' },
};
