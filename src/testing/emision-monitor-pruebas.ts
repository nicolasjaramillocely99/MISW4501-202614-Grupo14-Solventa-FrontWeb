import {
  AccionEmisionDto,
  EmisionDto,
  ListaEmisionesDto,
} from '@core/api/originacion/emision-monitor.modelos';

/** Una emisión por estado, como las devuelve `GET /v1/issuances` (HU-W1.3-04). */
export const EMISION_ACEPTADA_DTO: EmisionDto = {
  acceptance_id: 'acc-0001',
  offer_id: 'off-0001',
  customer_id: 'cliente-0001',
  customer_name: null,
  channel: 'mobile',
  status: 'accepted',
  step: 'underwriting',
  accepted_at: '2026-10-20T15:04:05Z',
  updated_at: '2026-10-20T15:04:05Z',
  amount: null,
  currency: null,
  attempts: 0,
  policy_id: null,
  reason: null,
  failed_at: null,
  notified_at: null,
  unattended: false,
  resume_count: 0,
  last_resumed_at: null,
  last_resumed_by: null,
};

export const EMISION_EN_COBRO_DTO: EmisionDto = {
  ...EMISION_ACEPTADA_DTO,
  acceptance_id: 'acc-0002',
  offer_id: 'off-0002',
  customer_name: 'Jorge Andrés Molina',
  channel: 'web',
  status: 'charging',
  step: 'premium_charge',
  amount: 89500,
  currency: 'COP',
  attempts: 3,
};

export const EMISION_ACTIVA_DTO: EmisionDto = {
  ...EMISION_ACEPTADA_DTO,
  acceptance_id: 'acc-0003',
  offer_id: 'off-0003',
  customer_name: 'Carolina Pérez Ruiz',
  channel: 'web',
  status: 'active',
  step: 'notification',
  amount: 89500,
  currency: 'COP',
  policy_id: 'pol-acc-0003',
};

export const EMISION_NOTIFICADA_DTO: EmisionDto = {
  ...EMISION_ACTIVA_DTO,
  acceptance_id: 'acc-0006',
  offer_id: 'off-0006',
  customer_name: 'Marta Ruiz Ospina',
  status: 'notified',
  step: 'completed',
  policy_id: 'pol-acc-0006',
  notified_at: '2026-10-20T15:05:00Z',
};

/** Excepción del cobro que lleva más de 30 minutos sin analista. */
export const EMISION_EXCEPCION_DTO: EmisionDto = {
  ...EMISION_ACEPTADA_DTO,
  acceptance_id: 'acc-0004',
  offer_id: 'off-0004',
  customer_name: 'Luis Fernando Castro',
  channel: 'web',
  status: 'exception',
  step: 'premium_charge',
  amount: 89500,
  currency: 'COP',
  attempts: 9,
  reason: 'retry_window_expired',
  failed_at: '2026-10-20T15:30:00Z',
  unattended: true,
};

/** Excepción de la emisión contractual (el generador de documentos), ya reintentada una vez. */
export const EMISION_DOCUMENTO_FALLIDO_DTO: EmisionDto = {
  ...EMISION_EXCEPCION_DTO,
  acceptance_id: 'acc-0005',
  offer_id: 'off-0005',
  customer_name: 'Pedro Gómez Lara',
  step: 'contract_document',
  attempts: 12,
  policy_id: 'pol-acc-0005',
  reason: 'document_generation_failed',
  unattended: false,
  resume_count: 1,
  last_resumed_at: '2026-10-20T16:00:00Z',
  last_resumed_by: 'ops-1',
};

export const EMISIONES_DTO: EmisionDto[] = [
  EMISION_EXCEPCION_DTO,
  EMISION_DOCUMENTO_FALLIDO_DTO,
  EMISION_NOTIFICADA_DTO,
  EMISION_ACTIVA_DTO,
  EMISION_EN_COBRO_DTO,
  EMISION_ACEPTADA_DTO,
];

/** Lo que devuelve `GET /v1/issuances` con todas las emisiones y sus conteos. */
export const LISTA_EMISIONES_DTO: ListaEmisionesDto = {
  items: EMISIONES_DTO,
  counts: {
    accepted: 18,
    charging: 6,
    charging_with_retries: 2,
    active_today: 42,
    notified_today: 40,
    exceptions: 3,
    unattended: 1,
  },
};

export const ACCIONES_DTO: AccionEmisionDto[] = [
  { id: 2, action: 'retry', actor: 'ops-2', note: 'El generador volvió', created_at: '2026-10-20T17:00:00Z' },
  { id: 1, action: 'resume', actor: 'ops-1', note: 'Pasarela restablecida', created_at: '2026-10-20T16:00:00Z' },
];
