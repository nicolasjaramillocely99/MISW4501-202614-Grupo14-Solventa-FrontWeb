import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { PagoPagina } from '../../paginas/pago.pagina';

const ACEPTACION = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc';

/** Cobro con la forma de `GET /v1/acceptances/{id}/charge` (contrato `HU-W1.3-02-api.md`). */
function cobro(cambios: Record<string, unknown> = {}) {
  return {
    acceptance_id: ACEPTACION,
    offer_id: 'demo-active-e2e',
    customer_id: 'sub-asegurado',
    accepted_at: '2026-10-16T19:04:58Z',
    status: 'pending',
    idempotency_key: `cobro-${ACEPTACION}`,
    amount: 68500,
    currency: 'COP',
    attempts: 0,
    last_attempt_at: null,
    last_failure_at: null,
    // Sin medio de pago el cobro no tiene fecha de vencimiento: espera la
    // tarjeta y el trabajador no lo toma. Es la bisagra de la historia.
    next_attempt_at: null,
    retry_window: { started_at: '2026-10-16T19:05:00Z', ends_at: '2026-10-17T19:05:00Z' },
    failure_reason: null,
    decline_code: null,
    provider_reference: null,
    offer_expires_at: '2026-10-17T19:30:00Z',
    confirmed_at: null,
    policy_id: null,
    coverage_activated_at: null,
    activation_published_at: null,
    resume_count: 0,
    payment_method: null,
    payment_attempt: 0,
    updated_at: '2026-10-16T19:05:13.2Z',
    ...cambios,
  };
}

const RECHAZADO = cobro({
  status: 'failed',
  failure_reason: 'payment_rejected',
  decline_code: '51',
  provider_reference: 'ch-7',
  attempts: 1,
  last_attempt_at: '2026-10-16T19:05:18Z',
  last_failure_at: '2026-10-16T19:05:20Z',
  payment_method: {
    method: 'card',
    brand: 'visa',
    last4: '0002',
    installments: 1,
    bank_code: null,
    captured_at: '2026-10-16T19:05:10Z',
  },
  payment_attempt: 1,
});

/**
 * Paso 4 del canal embebido: la captura del medio de pago (E4 y E4c, HU-W1.3-02).
 * El estado posterior —la pasarela sin responder— vive en `pago-pendiente.spec.ts`.
 */
test.describe('Medio de pago (HU-W1.3-02)', () => {
  test('sin medio de pago entregado, E4 pide la tarjeta y muestra lo que se va a cobrar', async ({ page }) => {
    await simularCognito(page);
    const pago = new PagoPagina(page);
    await pago.simularGateway([{ estado: 200, cuerpo: cobro() }]);

    await pago.abrirConSesion(ACEPTACION);

    await expect(pago.titulo).toHaveText('Paga tu primera prima');
    await expect(page.getByRole('textbox', { name: 'Número de tarjeta' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pagar \$ 68\.500 COP/ })).toBeVisible();
    await expect(page.getByText('Total a pagar hoy')).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('el número de la tarjeta no sale del navegador: a originación solo viaja el token', async ({ page }) => {
    await simularCognito(page);
    const pago = new PagoPagina(page);
    // La primera consulta llega sin medio de pago (E4); desde que se entrega,
    // el cobro ya tiene fecha y el trabajador lo toma, asi que las siguientes
    // lo devuelven con la tarjeta puesta y un intento hecho.
    const yaConTarjeta = cobro({
      payment_method: {
        method: 'card',
        brand: 'visa',
        last4: '1111',
        installments: 1,
        bank_code: null,
        captured_at: '2026-10-16T19:05:30Z',
      },
      payment_attempt: 1,
      attempts: 1,
      last_attempt_at: '2026-10-16T19:05:31Z',
      next_attempt_at: '2026-10-16T19:05:35Z',
    });
    await pago.simularGateway([
      { estado: 200, cuerpo: cobro() },
      { estado: 200, cuerpo: yaConTarjeta },
    ]);

    await page.route('**/pasarela/tokens', async (ruta) => {
      await ruta.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'tok_visa_1111', brand: 'visa', last4: '1111' }),
      });
    });

    let cuerpoEntregado = '';
    await page.route('**/charge/payment-method', async (ruta) => {
      cuerpoEntregado = ruta.request().postData() ?? '';
      await ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(yaConTarjeta),
      });
    });

    await pago.abrirConSesion(ACEPTACION);
    await page.getByRole('textbox', { name: 'Número de tarjeta' }).fill('4111111111111111');
    await page.getByRole('textbox', { name: 'Vencimiento' }).fill('12/30');
    await page.getByRole('textbox', { name: 'Código de seguridad' }).fill('123');
    await page.getByRole('textbox', { name: 'Nombre del titular' }).fill('Carlos Rios');
    await page.getByRole('button', { name: /Pagar/ }).click();

    await expect(pago.titulo).toHaveText('Tu pago está pendiente');
    expect(cuerpoEntregado).toContain('tok_visa_1111');
    // La garantía que mantiene a Solventa fuera del alcance PCI-DSS.
    expect(cuerpoEntregado).not.toContain('4111111111111111');
    expect(cuerpoEntregado).not.toContain('123');
  });

  test('rechazada por el emisor, E4c deja intentar con otra tarjeta', async ({ page }) => {
    await simularCognito(page);
    const pago = new PagoPagina(page);
    await pago.simularGateway([{ estado: 200, cuerpo: RECHAZADO }]);

    await pago.abrirConSesion(ACEPTACION);

    await expect(pago.titulo).toHaveText('No pudimos procesar tu pago');
    // Lo que el emisor dijo: sin esto, «no se pudo» no le sirve al cliente.
    await expect(page.getByText('Código 51 · Fondos insuficientes')).toBeVisible();
    await expect(page.getByText('ch-7')).toBeVisible();
    await expect(page.getByText('Elige otro medio de pago')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Número de tarjeta' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reintentar el pago/ })).toBeVisible();
    await verificarAccesibilidad(page);
  });
});
