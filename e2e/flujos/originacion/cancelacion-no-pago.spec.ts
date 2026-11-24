import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  CONTRASENA_PRUEBA,
  RolPrueba,
  USUARIOS_PRUEBA,
  simularCognito,
} from '../../fixtures/sesion-por-rol';
import { SOLICITUDES, condiciones, pagina } from '../../fixtures/solicitudes-modificacion';
import { InicioSesionPagina } from '../../paginas/inicio-sesion.pagina';

/**
 * Cancelación de la póliza por incumplimiento de pago (HU-W1.6-02): A1 con el estado del pago, A2/A2b y la vista
 * del asesor. Cognito y el API Gateway se simulan con `page.route`, con la forma de `docs/contratos/HU-W1.6-02-api.md`.
 */

const BASE = {
  holder_name: 'Carolina Pérez',
  premium: 142300,
  currency: 'COP',
  insured_amount: 68000000,
  coverages: [
    { code: 'death', insured_amount: 68000000 },
    { code: 'total_permanent_disability', insured_amount: 68000000 },
  ],
  renewal_of: null,
  can_renew: false,
  renewal: null,
};

const CANCELADA = {
  ...BASE,
  policy_id: 'pol-acc-093377',
  coverage_start: '2026-07-12T05:00:00Z',
  coverage_end: '2027-07-12T05:00:00Z',
  renewal_window: { opens_at: '2027-06-12T05:00:00Z', closes_at: '2027-07-12T05:00:00Z' },
  payment: { status: 'cancelled', next_due_at: null, pending: null },
  cancellation: {
    reason: 'non_payment',
    cancelled_at: '2026-09-12T05:00:00Z',
    refund: 'not_applicable',
    month: 2,
    due_at: '2026-08-12T05:00:00Z',
    grace_ends_at: '2026-09-11T05:00:00Z',
    amount: 142300,
    currency: 'COP',
    attempts: 3,
    email_sent_at: '2026-09-12T05:01:00Z',
  },
};

const EN_GRACIA = {
  ...BASE,
  policy_id: 'pol-acc-330417',
  coverage_start: '2026-06-01T12:00:00Z',
  coverage_end: '2027-06-01T12:00:00Z',
  renewal_window: { opens_at: '2027-05-02T12:00:00Z', closes_at: '2027-06-01T12:00:00Z' },
  payment: {
    status: 'payment_pending',
    next_due_at: null,
    pending: {
      month: 4,
      due_at: '2026-09-01T12:00:00Z',
      grace_ends_at: '2026-10-01T12:00:00Z',
      cancels_at: '2026-10-02T12:00:00Z',
      amount: 142300,
      currency: 'COP',
      attempts: 1,
      next_attempt_at: '2026-09-09T12:00:00Z',
    },
  },
  cancellation: null,
};

const TARJETA = {
  method: 'card',
  brand: 'visa',
  last4: '0010',
  installments: 1,
  bank_code: null,
  payer_type: null,
  captured_at: '2026-07-12T05:00:00Z',
};

const rechazo = (attempt: number, attempted_at: string) => ({
  attempt,
  outcome: 'declined',
  decline_code: '51',
  attempted_at,
});

const DETALLE_CANCELADA = {
  ...CANCELADA,
  payment_method: TARJETA,
  payments: [
    {
      month: 2,
      kind: 'installment',
      status: 'unpaid',
      due_at: '2026-08-12T05:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: null,
      attempts: [
        rechazo(1, '2026-08-13T05:00:00Z'),
        rechazo(2, '2026-08-20T05:00:00Z'),
        rechazo(3, '2026-08-27T05:00:00Z'),
      ],
    },
    {
      month: 1,
      kind: 'issuance',
      status: 'paid',
      due_at: '2026-07-12T05:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: '2026-07-12T05:00:00Z',
      attempts: [],
    },
  ],
};

const DETALLE_EN_GRACIA = {
  ...EN_GRACIA,
  payment_method: TARJETA,
  payments: [
    {
      month: 4,
      kind: 'installment',
      status: 'pending',
      due_at: '2026-09-01T12:00:00Z',
      amount: 142300,
      currency: 'COP',
      paid_at: null,
      attempts: [rechazo(1, '2026-09-02T12:00:00Z')],
    },
  ],
};

/** Simula `GET /v1/policies` y `GET /v1/policies/{id}`; una póliza que no está responde 404. Devuelve los ids pedidos. */
async function simularPolizas(page: Page): Promise<string[]> {
  const pedidos: string[] = [];
  const detalles: Record<string, unknown> = {
    [CANCELADA.policy_id]: DETALLE_CANCELADA,
    [EN_GRACIA.policy_id]: DETALLE_EN_GRACIA,
  };
  await page.route(
    (url) => url.pathname.startsWith('/v1/policies'),
    async (ruta) => {
      const { pathname } = new URL(ruta.request().url());
      const json = (status: number, cuerpo: unknown) =>
        ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });
      if (pathname === '/v1/policies') {
        await json(200, { items: [EN_GRACIA, CANCELADA], partial: false });
        return;
      }
      if (pathname.endsWith('/contract-document')) {
        pedidos.push(pathname);
        await ruta.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.7\n'),
        });
        return;
      }
      const id = decodeURIComponent(pathname.split('/')[3] ?? '');
      pedidos.push(id);
      const detalle = detalles[id];
      await (detalle
        ? json(200, detalle)
        : json(404, { error: 'policy_not_found', message: 'no existe' }));
    },
  );
  return pedidos;
}

async function abrirComo(page: Page, ruta: string, rol: RolPrueba): Promise<void> {
  await page.goto(ruta);
  await new InicioSesionPagina(page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
}

test.describe('Cancelación de póliza por incumplimiento de pago (HU-W1.6-02)', () => {
  test('A1 marca «No pago» y «Pago pendiente», y la póliza cancelada abre A2b sin reembolso (CA-1, CA-2)', async ({
    page,
  }) => {
    await simularCognito(page);
    const pedidos = await simularPolizas(page);

    await abrirComo(page, '/originacion/polizas', 'asegurado');

    const cancelada = page.getByRole('row').filter({ hasText: 'pol-acc-093377' });
    await expect(cancelada).toContainText('No pago');
    await expect(cancelada).toContainText('Cancelada por no pago · sin reembolso');
    await expect(page.getByRole('row').filter({ hasText: 'pol-acc-330417' })).toContainText(
      'Pago pendiente',
    );
    await expect(page.getByRole('alert')).toContainText(
      'Tu póliza pol-acc-330417 tiene un pago pendiente',
    );
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'pol-acc-093377', exact: true }).click();

    await expect(page).toHaveURL('/originacion/polizas/pol-acc-093377');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Vida · pol-acc-093377' }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(
      'Póliza cancelada por incumplimiento de pago',
    );
    await expect(page.getByRole('alert')).toContainText('no genera reembolso');
    const detalle = page.getByRole('region', { name: 'Detalle de la cancelación' });
    await expect(detalle).toContainText('No aplica');
    await expect(detalle).toContainText('No pago · cuota 2');
    await expect(detalle).toContainText('Correo y push enviados');
    await expect(detalle).not.toContainText('SMS');
    const historial = page.getByRole('region', { name: 'Historial de cobros' });
    await expect(historial.getByRole('listitem')).toHaveCount(3);
    await expect(historial).toContainText('Cancelación automática');
    await expect(historial).toContainText('Cobro de la cuota 2 rechazado (3 intentos)');
    await expect(historial).toContainText('fondos insuficientes');
    await expect(page.getByRole('heading', { name: 'Coberturas (sin vigencia)' })).toBeVisible();
    // Los botones de A2b están, sin historia que los respalde todavía.
    await expect(page.getByRole('button', { name: 'Hablar con un asesor' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Solicitar nueva cotización' })).toBeDisabled();
    expect(pedidos).toEqual(['pol-acc-093377']);
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/cancelacion/a2b.png', fullPage: true });
  });

  test('A2 de una póliza en gracia avisa cuándo se cobra de nuevo y cuándo se cancela', async ({
    page,
  }) => {
    await simularCognito(page);
    const pedidos = await simularPolizas(page);
    // HU-W1.4-01 (ajuste A-10): «Beneficiarios» y «Mis solicitudes» leen las condiciones vigentes y las solicitudes.
    await page.route(
      (url) =>
        url.pathname.endsWith('/current-terms') || url.pathname === '/v1/policies/change-requests',
      async (ruta) => {
        const url = new URL(ruta.request().url());
        const cuerpo = url.pathname.endsWith('/current-terms')
          ? condiciones({ policy: { ...condiciones().policy, policy_id: EN_GRACIA.policy_id } })
          : pagina(url.searchParams, [{ ...SOLICITUDES.radicada, policy_id: EN_GRACIA.policy_id }]);
        await ruta.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(cuerpo),
        });
      },
    );

    await abrirComo(page, '/originacion/polizas/pol-acc-330417', 'asegurado');

    await expect(page.getByText('Pago pendiente', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Tienes pendiente el pago de la cuota 4');
    await expect(page.getByRole('alert')).toContainText('Conservas tu cobertura');
    const resumen = page.getByRole('region', { name: 'Resumen' });
    await expect(resumen).toContainText('Visa •••• 0010');
    await expect(resumen).toContainText('Pago pendiente · cuota 4');
    // HU-W1.6-01: «Cancelar póliza» lleva a A5.
    await expect(page.getByRole('link', { name: 'Cancelar póliza', exact: true })).toHaveAttribute(
      'href',
      '/originacion/polizas/pol-acc-330417/cancelar',
    );
    // HU-W1.4-01 (ajuste A-10): la solicitud de modificación y «Mis solicitudes» ya funcionan.
    for (const nombre of ['Solicitar modificación', 'Modificar']) {
      await expect(page.getByRole('link', { name: nombre, exact: true })).toHaveAttribute(
        'href',
        '/originacion/polizas/pol-acc-330417/modificar',
      );
    }
    await expect(page.getByRole('link', { name: 'Ver todas', exact: true })).toHaveAttribute(
      'href',
      '/originacion/solicitudes?poliza=pol-acc-330417',
    );
    await expect(page.getByRole('region', { name: 'Beneficiarios' })).toContainText('Banco Aliado');
    await expect(page.getByRole('region', { name: 'Mis solicitudes' })).toContainText(
      'SOL-MOD-2026-0042',
    );
    await expect(page.getByRole('region', { name: 'Documentos' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Historial de cobros' })).toContainText(
      'Cobro de la cuota 4 rechazado (1 intento)',
    );
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/cancelacion/a2.png', fullPage: true });

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar póliza' }).click();
    expect((await descarga).suggestedFilename()).toBe('poliza-pol-acc-330417.pdf');
    expect(pedidos).toContain('/v1/policies/pol-acc-330417/contract-document');
  });

  test('una póliza que no es del asegurado no se muestra', async ({ page }) => {
    await simularCognito(page);
    await simularPolizas(page);

    await abrirComo(page, '/originacion/polizas/pol-de-otro', 'asegurado');

    await expect(page.getByRole('heading', { name: 'No encontramos la póliza' })).toBeVisible();
  });

  test('el asesor ve el contador de canceladas por no pago y la póliza marcada en Renovaciones', async ({
    page,
  }) => {
    await simularCognito(page);
    await page.route(
      (url) => url.pathname === '/v1/policies/expiring',
      (ruta) =>
        ruta.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                policy_id: 'pol-acc-093377',
                line: 'life',
                product: null,
                holder: {
                  full_name: 'Carolina Pérez Ruiz',
                  document_type: 'CC',
                  document_id: '1020345678',
                },
                premium: 142300,
                currency: 'COP',
                coverage_end: '2027-07-12T05:00:00Z',
                status: 'cancelled_non_payment',
                can_renew: false,
                renewal_window: {
                  opens_at: '2027-06-12T05:00:00Z',
                  closes_at: '2027-07-12T05:00:00Z',
                },
                renewal: null,
                cancelled_at: '2026-09-12T05:00:00Z',
              },
            ],
            expires_from: '2026-09-16',
            expires_to: '2026-10-16',
            window_days: 30,
            due_within_window: 12,
            cancelled_non_payment_last_30_days: 2,
            total: 1,
            page: 1,
            page_size: 20,
          }),
        }),
    );

    await abrirComo(page, '/originacion/renovaciones', 'asesor');

    const tarjeta = page.getByRole('region', {
      name: 'Pólizas canceladas por no pago en los últimos 30 días',
    });
    await expect(tarjeta).toContainText('Canceladas por no pago');
    await expect(tarjeta).toContainText('2');
    const fila = page.getByRole('row').filter({ hasText: 'pol-acc-093377' });
    await expect(fila).toContainText('Cancelada por no pago');
    await expect(fila).toContainText('—');
    await expect(fila.getByRole('link')).toHaveCount(0);
    await verificarAccesibilidad(page);
  });
});
