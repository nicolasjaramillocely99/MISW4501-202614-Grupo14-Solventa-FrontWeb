import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { AceptacionOfertaPagina } from '../../paginas/aceptacion-oferta.pagina';
import { PagoPagina } from '../../paginas/pago.pagina';

const ACEPTACION = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc';

/** Cobro con la forma de `GET /v1/acceptances/{id}/charge` (contrato HA-D02, `HA-D02-api.md`). */
function cobro(cambios: Record<string, unknown> = {}) {
  return {
    acceptance_id: ACEPTACION,
    offer_id: 'demo-active-e2e',
    customer_id: 'sub-asegurado',
    accepted_at: '2026-10-16T19:04:58Z',
    status: 'pending',
    idempotency_key: `cobro-${ACEPTACION}`,
    amount: 89500,
    currency: 'COP',
    attempts: 3,
    last_attempt_at: '2026-10-16T19:05:12.5Z',
    last_failure_at: '2026-10-16T19:05:13.2Z',
    next_attempt_at: '2026-10-16T19:05:15.2Z',
    retry_window: { started_at: '2026-10-16T19:05:00Z', ends_at: '2026-10-17T19:05:00Z' },
    failure_reason: null,
    confirmed_at: null,
    policy_id: null,
    coverage_activated_at: null,
    activation_published_at: null,
    resume_count: 0,
    updated_at: '2026-10-16T19:05:13.2Z',
    ...cambios,
  };
}

const CONFIRMADO = cobro({
  status: 'confirmed',
  next_attempt_at: null,
  confirmed_at: '2026-10-16T19:06:00Z',
  policy_id: `pol-${ACEPTACION}`,
  coverage_activated_at: '2026-10-16T19:06:00Z',
  activation_published_at: '2026-10-16T19:06:00.1Z',
});

/**
 * Paso 4 del canal embebido: el cobro de la prima con la pasarela caída (HA-D02). Cognito y el API Gateway se
 * simulan con `page.route`; la sesión es la de un asegurado.
 */
test.describe('Pago pendiente (HA-D02)', () => {
  test('muestra el pago pendiente con la aceptación guardada y luego el pago confirmado', async ({ page }) => {
    await simularCognito(page);
    const pago = new PagoPagina(page);
    const llamadas = await pago.simularGateway([
      { estado: 200, cuerpo: cobro() },
      { estado: 200, cuerpo: cobro({ attempts: 4, next_attempt_at: new Date(Date.now() + 1_500).toISOString() }) },
      { estado: 200, cuerpo: CONFIRMADO },
    ]);

    await pago.abrirConSesion(ACEPTACION);
    await expect(pago.titulo).toHaveText('Tu pago está pendiente');
    await expect(page.getByText(`cobro-${ACEPTACION} (idempotente)`)).toBeVisible();
    await expect(page.getByText(/Intentos sin respuesta: [34]/)).toBeVisible();
    await expect(page.getByText(/Te avisaremos por correo cuando el pago se confirme/)).toBeVisible();
    await expect(page.getByRole('button', { name: /otro medio de pago/ })).toHaveCount(0);
    await verificarAccesibilidad(page);

    await expect(pago.titulo).toHaveText('Pago confirmado', { timeout: 15_000 });
    await expect(page.getByText(`pol-${ACEPTACION}`)).toBeVisible();
    expect(llamadas.consultas[0]).toBe(`/v1/acceptances/${ACEPTACION}/charge`);
    await verificarAccesibilidad(page);
  });

  test('una ventana vencida queda como excepción que gestiona operaciones', async ({ page }) => {
    await simularCognito(page);
    const pago = new PagoPagina(page);
    await pago.simularGateway([
      { estado: 200, cuerpo: cobro({ status: 'failed', failure_reason: 'retry_window_expired', next_attempt_at: null }) },
    ]);

    await pago.abrirConSesion(ACEPTACION);

    await expect(pago.titulo).toHaveText('No pudimos completar el cobro');
    await expect(page.getByRole('alert')).toContainText('Un analista de operaciones gestionará tu caso');
    await expect(pago.continuar).toHaveAttribute('href', '/inicio');
    await verificarAccesibilidad(page);
  });

  test('desde la emisión iniciada se abre el estado del pago', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    const aceptacion = {
      acceptance_id: ACEPTACION,
      offer_id: 'demo-active-e2e',
      customer_id: 'sub-asegurado',
      channel: 'web',
      accepted_at: '2026-10-16T19:04:58Z',
      status: 'issuance_pending',
      underwriting: { outcome: 'approved', reason: null, decided_at: '2026-10-16T19:05:00Z' },
      processing: { attempts: 0, last_failure_at: null, next_attempt_at: null },
      updated_at: '2026-10-16T19:05:00Z',
    };
    await oferta.simularGateway({
      deOferta: { estado: 200, cuerpo: aceptacion },
      aceptar: { estado: 200, cuerpo: aceptacion },
      consultas: [{ estado: 200, cuerpo: aceptacion }],
    });
    const pago = new PagoPagina(page);
    await pago.simularGateway([{ estado: 200, cuerpo: cobro() }]);

    await oferta.abrirConSesion('demo-active-e2e');
    await expect(oferta.titulo).toHaveText('Suscripción aprobada');
    await page.getByRole('link', { name: 'Ver el estado de tu pago' }).click();

    await expect(page).toHaveURL(new RegExp(`/embebido/pago/${ACEPTACION}$`));
    await expect(pago.titulo).toHaveText('Tu pago está pendiente');
    await verificarAccesibilidad(page);
  });
});
