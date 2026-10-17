import { SolicitudRevisionDto } from '@core/api/originacion/revision.modelos';

/**
 * Solicitud pendiente de la bandeja de decisión humana con la forma de `GET /v1/review-requests/{id}`, tomada de
 * las respuestas capturadas en `docs/contratos/HU-W1.1-02-api.md` (los nombres son de prueba).
 */
export const SOLICITUD_PENDIENTE_DTO: SolicitudRevisionDto = {
  acceptance_id: '6af8ce61-2424-4ed2-8375-57eaf9f9ee67',
  offer_id: 'demo-review-1792212135',
  customer_id: 'ff5a40b9-19f8-413a-8665-f73d9196fc6d',
  applicant: { full_name: 'Carolina Pérez Ruiz', document_id: 'CC 1020345678', email: 'carolina@example.com' },
  offer: { premium: 89500, currency: 'COP', mode: 'provisional', expires_at: '2026-10-18T04:42:19.9766934Z' },
  reason: 'provisional_offer',
  received_at: '2026-10-17T04:42:19.9766934Z',
  status: 'pending',
  decision: null,
};

/** La misma solicitud tras un ajuste del 10 % con el correo al cliente enviado. */
export const SOLICITUD_AJUSTADA_DTO: SolicitudRevisionDto = {
  ...SOLICITUD_PENDIENTE_DTO,
  offer: { premium: 89500, currency: 'COP' },
  status: 'decided',
  decision: {
    decision_id: 'a37c997a-e061-4042-8621-2d365ed021bc',
    type: 'adjust',
    advisor: { id: '413ed637-0f56-4b36-b181-70fe3ee8e578', email: 'asesor@example.com' },
    decided_at: '2026-10-17T04:42:20.022742Z',
    observations: 'Ingreso declarado sin verificar',
    premium_adjustment_pct: 10,
    adjusted_offer: {
      offer_id: 'adj-6af8ce61-2424-4ed2-8375-57eaf9f9ee67',
      premium: 98450,
      currency: 'COP',
      expires_at: '2026-10-18T04:42:20.022742Z',
    },
    notification: { channel: 'email', status: 'sent', attempts: 0, sent_at: '2026-10-17T04:42:20.0484603Z' },
  },
};

/** Solicitud por puntaje de riesgo alto, rechazada por el asesor (aviso al cliente pendiente). */
export const SOLICITUD_RECHAZADA_DTO: SolicitudRevisionDto = {
  ...SOLICITUD_PENDIENTE_DTO,
  acceptance_id: '0f686241-8cb4-48ed-af20-ff3db8da5b68',
  offer_id: 'demo-highrisk-1792212135',
  offer: { premium: 89500, currency: 'COP' },
  reason: 'high_risk_score',
  received_at: '2026-10-17T04:42:20.2693679Z',
  status: 'decided',
  decision: {
    decision_id: 'bf186159-d530-4d96-93fb-aa779e009894',
    type: 'reject',
    advisor: { id: '413ed637-0f56-4b36-b181-70fe3ee8e578', email: 'asesor@example.com' },
    decided_at: '2026-10-17T04:42:20.2845185Z',
    observations: 'Riesgo fuera de la política',
    premium_adjustment_pct: null,
    adjusted_offer: null,
    notification: { channel: 'email', status: 'pending', attempts: 0, sent_at: null },
  },
};
