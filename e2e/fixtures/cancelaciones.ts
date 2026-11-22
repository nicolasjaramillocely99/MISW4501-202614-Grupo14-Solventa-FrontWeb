import { Page } from '@playwright/test';

import { SOLICITUDES, condiciones, pagina } from './solicitudes-modificacion';

/**
 * Datos y simulación del API Gateway para la cancelación con reembolso prorrateado (HU-W1.6-01), con la forma de
 * `docs/contratos/HU-W1.6-01-api.md` (origination 0.20.0): una póliza de vida al día (`VH-2026-004512`) que se cotiza,
 * se cancela y pasa a mostrar su reembolso.
 */

export const POLIZA_ID = 'VH-2026-004512';

const BASE = {
  policy_id: POLIZA_ID,
  holder_name: 'Carolina Pérez',
  premium: 142300,
  currency: 'COP',
  insured_amount: 68000000,
  coverages: [
    { code: 'death', insured_amount: 68000000 },
    { code: 'total_permanent_disability', insured_amount: 68000000 },
  ],
  coverage_start: '2026-11-18T15:00:00Z',
  coverage_end: '2027-11-18T15:00:00Z',
  renewal_of: null,
  renewal_window: { opens_at: '2027-10-19T15:00:00Z', closes_at: '2027-11-18T15:00:00Z' },
  renewal: null,
};

const VIGENTE = {
  ...BASE,
  can_renew: false,
  payment: { status: 'up_to_date', next_due_at: '2026-12-18T15:00:00Z', pending: null },
  cancellation: null,
};

const TARJETA = {
  method: 'card',
  brand: 'visa',
  last4: '1111',
  installments: 1,
  bank_code: null,
  payer_type: null,
  captured_at: '2026-11-18T15:00:00Z',
};

const MESES = [
  {
    month: 1,
    kind: 'issuance',
    status: 'paid',
    due_at: '2026-11-18T15:00:00Z',
    amount: 142300,
    currency: 'COP',
    paid_at: '2026-11-18T15:00:00Z',
    attempts: [],
  },
];

const PERIODO = {
  month: 1,
  kind: 'issuance',
  start: '2026-11-18T15:00:00Z',
  end: '2026-12-18T15:00:00Z',
  paid_amount: 142300,
  currency: 'COP',
};

export const COTIZACION = {
  policy_id: POLIZA_ID,
  effective_at: '2026-12-04T04:59:59Z',
  paid_period: PERIODO,
  unused_days: 14,
  period_days: 30,
  prorate_percent: 46.7,
  refund_amount: 66406,
  currency: 'COP',
  refund_method: { method: 'card', brand: 'visa', last4: '1111', bank_code: null },
  payment_status: 'up_to_date',
};

/** La del día siguiente: el `409 refund_changed` la devuelve. */
export const COTIZACION_DIA_SIGUIENTE = {
  ...COTIZACION,
  effective_at: '2026-12-05T04:59:59Z',
  unused_days: 13,
  prorate_percent: 43.3,
  refund_amount: 61663,
};

function cancelacion(monto: number, reembolso: string) {
  return {
    reason: 'insured_request',
    cancelled_at: '2026-12-03T15:00:00Z',
    effective_at: '2026-12-04T04:59:59Z',
    refund: reembolso,
    month: null,
    due_at: null,
    grace_ends_at: null,
    amount: null,
    currency: 'COP',
    attempts: null,
    email_sent_at: null,
    refund_detail: {
      reference: 'REF-2026-00001',
      amount: monto,
      currency: 'COP',
      method: { method: 'card', brand: 'visa', last4: '1111', bank_code: null },
      registered_at: '2026-12-03T15:00:00Z',
      completed_at: null,
      paid_period: PERIODO,
      unused_days: 14,
      period_days: 30,
      prorate_percent: 46.7,
    },
    insured_reason: { code: 'mortgage_paid', comments: null },
  };
}

export interface SimulacionCancelacion {
  /** Los cuerpos de cada `POST …/cancellation`. */
  confirmaciones: unknown[];
}

/**
 * Simula `GET /v1/policies`, `GET /v1/policies/{id}`, la cotización y la confirmación de la cancelación, y lo que A2 lee
 * de HU-W1.4-01. La primera cotización falla si `cotizacionFalla`; la primera confirmación responde `409 refund_changed`
 * si `montoCambia`. Tras una confirmación aceptada, la póliza queda cancelada con el reembolso en proceso.
 */
export async function simularCancelacion(
  page: Page,
  opciones: { montoCambia?: boolean; cotizacionFalla?: boolean } = {},
): Promise<SimulacionCancelacion> {
  const estado: SimulacionCancelacion = { confirmaciones: [] };
  let cancelada: ReturnType<typeof cancelacion> | null = null;
  let cotizada = false;
  let montoCambia = opciones.montoCambia ?? false;
  let cotizacionFalla = opciones.cotizacionFalla ?? false;
  await page.route(
    (url) => url.pathname.startsWith('/v1/policies'),
    async (ruta) => {
      const { pathname, searchParams } = new URL(ruta.request().url());
      const metodo = ruta.request().method();
      const json = (status: number, cuerpo: unknown) =>
        ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });
      const poliza = cancelada
        ? { ...BASE, can_renew: false, payment: { status: 'cancelled', next_due_at: null, pending: null }, cancellation: cancelada }
        : VIGENTE;
      if (pathname === '/v1/policies') {
        await json(200, { items: [poliza], partial: false });
      } else if (pathname === '/v1/policies/change-requests') {
        await json(200, pagina(searchParams, [{ ...SOLICITUDES.radicada, policy_id: POLIZA_ID }]));
      } else if (pathname.endsWith('/current-terms')) {
        await json(200, condiciones({ policy: { ...condiciones().policy, policy_id: POLIZA_ID } }));
      } else if (pathname.endsWith('/cancellation/quote')) {
        if (cotizacionFalla) {
          cotizacionFalla = false;
          await json(503, { error: 'cancellation_unavailable', message: 'retry later' });
          return;
        }
        await json(200, cotizada && !montoCambia ? COTIZACION_DIA_SIGUIENTE : COTIZACION);
      } else if (pathname.endsWith('/cancellation') && metodo === 'POST') {
        const cuerpo = ruta.request().postDataJSON() as { refund_amount: number };
        estado.confirmaciones.push(cuerpo);
        if (montoCambia) {
          montoCambia = false;
          cotizada = true;
          await json(409, { error: 'refund_changed', message: 'the refund changed', quote: COTIZACION_DIA_SIGUIENTE });
          return;
        }
        cancelada = cancelacion(cuerpo.refund_amount, 'in_process');
        await json(201, { policy_id: POLIZA_ID, status: 'cancelled', cancellation: cancelada });
      } else if (pathname === `/v1/policies/${POLIZA_ID}`) {
        await json(200, { ...poliza, payment_method: TARJETA, payments: MESES });
      } else {
        await json(404, { error: 'policy_not_found', message: 'no existe' });
      }
    },
  );
  return estado;
}
