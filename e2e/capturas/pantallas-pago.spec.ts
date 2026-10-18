import { expect, test } from '@playwright/test';

import { simularCognito } from '../fixtures/sesion-por-rol';
import { PagoPagina } from '../paginas/pago.pagina';

/**
 * No valida nada: deja capturas de E4 y E4c para revisar el diseño contra el
 * prototipo. Se corre a mano con `npx playwright test e2e/capturas`.
 */

const ACEPTACION = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc';

function cobro(cambios: Record<string, unknown> = {}) {
  return {
    acceptance_id: ACEPTACION,
    offer_id: 'demo-active-e2e',
    customer_id: 'sub-asegurado',
    accepted_at: '2026-09-16T19:04:58Z',
    status: 'pending',
    idempotency_key: `cobro-${ACEPTACION}`,
    amount: 68500,
    currency: 'COP',
    attempts: 0,
    last_attempt_at: null,
    last_failure_at: null,
    next_attempt_at: null,
    retry_window: { started_at: '2026-09-16T19:05:00Z', ends_at: '2026-09-17T19:05:00Z' },
    failure_reason: null,
    confirmed_at: null,
    policy_id: null,
    coverage_activated_at: null,
    activation_published_at: null,
    resume_count: 0,
    payment_method: null,
    payment_attempt: 0,
    updated_at: '2026-09-16T19:05:13.2Z',
    ...cambios,
  };
}

test('E4 · captura del medio de pago', async ({ page }) => {
  await simularCognito(page);
  const pago = new PagoPagina(page);
  await pago.simularGateway([{ estado: 200, cuerpo: cobro() }]);
  await pago.abrirConSesion(ACEPTACION);

  await expect(pago.titulo).toHaveText('Paga tu primera prima');
  await page.screenshot({ path: 'e2e/capturas/E4-medio-de-pago.png', fullPage: true });
});

test('E4c · pago rechazado con otra tarjeta', async ({ page }) => {
  await simularCognito(page);
  const pago = new PagoPagina(page);
  await pago.simularGateway([
    {
      estado: 200,
      cuerpo: cobro({
        status: 'failed',
        failure_reason: 'payment_rejected',
        attempts: 1,
        last_failure_at: '2026-09-16T19:05:20Z',
        payment_method: {
          method: 'card',
          brand: 'visa',
          last4: '0002',
          installments: 1,
          bank_code: null,
          captured_at: '2026-09-16T19:05:10Z',
        },
        payment_attempt: 1,
      }),
    },
  ]);
  await pago.abrirConSesion(ACEPTACION);

  await expect(pago.titulo).toHaveText('Tu pago fue rechazado');
  await page.screenshot({ path: 'e2e/capturas/E4c-pago-rechazado.png', fullPage: true });
});
