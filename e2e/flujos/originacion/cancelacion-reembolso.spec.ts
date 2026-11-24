import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { POLIZA_ID, simularCancelacion } from '../../fixtures/cancelaciones';
import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA, simularCognito } from '../../fixtures/sesion-por-rol';
import { InicioSesionPagina } from '../../paginas/inicio-sesion.pagina';

/**
 * Cancelación de la póliza con reembolso prorrateado (HU-W1.6-01): A2 → A5 (el cálculo antes de confirmar, CA-1) →
 * confirmación → A5b en el detalle (la póliza cancelada y el reembolso registrado, CA-2) → A1 con «Cancelada». Cognito y
 * el API Gateway se simulan con `page.route`, con la forma de `docs/contratos/HU-W1.6-01-api.md`.
 */

async function abrirDetalle(page: Page): Promise<void> {
  await page.goto(`/originacion/polizas/${POLIZA_ID}`);
  await new InicioSesionPagina(page).ingresar(USUARIOS_PRUEBA.asegurado.correo, CONTRASENA_PRUEBA);
  await expect(page.getByRole('heading', { level: 1, name: `Vida · ${POLIZA_ID}` })).toBeVisible();
}

async function elegirYAceptar(page: Page): Promise<void> {
  await page.getByLabel('Motivo de la cancelación').selectOption('mortgage_paid');
  await page.getByRole('checkbox').check();
}

test.describe('Cancelación con reembolso prorrateado (HU-W1.6-01)', () => {
  test('A2 → A5 con el cálculo → confirmar → A5b → A1 con «Cancelada» (CA-1, CA-2)', async ({ page }) => {
    await simularCognito(page);
    const simulacion = await simularCancelacion(page);
    await abrirDetalle(page);

    await page.getByRole('link', { name: 'Cancelar póliza' }).click();

    await expect(page).toHaveURL(`/originacion/polizas/${POLIZA_ID}/cancelar`);
    await expect(page.getByRole('heading', { level: 1, name: 'Cancelar póliza de vida hipotecario' })).toBeVisible();
    const calculo = page.getByRole('region', { name: 'Cálculo del reembolso' });
    await expect(calculo).toContainText('142.300 COP');
    await expect(calculo).toContainText('14 de 30');
    await expect(calculo).toContainText('46,7 %');
    await expect(calculo).toContainText('Visa •••• 1111 (medio de pago original)');
    await expect(calculo).toContainText('Hoy, 03/12/2026, al final del día');
    await expect(page.getByRole('region', { name: 'Monto a reembolsar' })).toContainText('66.406 COP');
    await expect(page.getByRole('button', { name: 'Confirmar cancelación' })).toBeDisabled();
    await elegirYAceptar(page);
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/cancelacion-reembolso/a5.png', fullPage: true });

    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    await expect(page).toHaveURL(`/originacion/polizas/${POLIZA_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: `Vida hipotecario · ${POLIZA_ID}` })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Cancelación registrada');
    const detalle = page.getByRole('region', { name: 'Detalle del reembolso' });
    await expect(detalle).toContainText('66.406 COP');
    await expect(detalle).toContainText('Visa •••• 1111');
    await expect(detalle).toContainText('REF-2026-00001');
    await expect(detalle).toContainText('03/12/2026 · 23:59');
    await expect(detalle).toContainText('Pagué el crédito hipotecario');
    await expect(detalle).toContainText('En proceso');
    await expect(page.getByText(/constancia/i)).toHaveCount(0);
    expect(simulacion.confirmaciones).toEqual([
      { reason: 'mortgage_paid', comments: null, refund_amount: 66406, accept_terms: true },
    ]);
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/cancelacion-reembolso/a5b.png', fullPage: true });

    await page.getByRole('link', { name: 'Volver a mis pólizas' }).click();

    await expect(page).toHaveURL('/originacion/polizas');
    const fila = page.getByRole('row').filter({ hasText: POLIZA_ID });
    await expect(fila).toContainText('Cancelada');
    await expect(fila).toContainText('Cancelada a solicitud · reembolso');
    await verificarAccesibilidad(page);
  });

  test('«Conservar mi póliza» vuelve al detalle sin cancelar', async ({ page }) => {
    await simularCognito(page);
    const simulacion = await simularCancelacion(page);
    await abrirDetalle(page);
    await page.getByRole('link', { name: 'Cancelar póliza' }).click();
    await expect(page.getByRole('region', { name: 'Cálculo del reembolso' })).toBeVisible();

    await page.getByRole('link', { name: 'Conservar mi póliza' }).click();

    await expect(page).toHaveURL(`/originacion/polizas/${POLIZA_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: `Vida · ${POLIZA_ID}` })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cancelar póliza' })).toBeVisible();
    expect(simulacion.confirmaciones).toEqual([]);
  });

  test('si el monto cambió muestra el nuevo y pide aceptarlo otra vez; el error de carga ofrece reintentar', async ({
    page,
  }) => {
    await simularCognito(page);
    const simulacion = await simularCancelacion(page, { montoCambia: true, cotizacionFalla: true });
    await page.goto(`/originacion/polizas/${POLIZA_ID}/cancelar`);
    await new InicioSesionPagina(page).ingresar(USUARIOS_PRUEBA.asegurado.correo, CONTRASENA_PRUEBA);

    await expect(page.getByRole('alert')).toContainText('No pudimos calcular tu reembolso');
    await expect(page.getByRole('button', { name: 'Confirmar cancelación' })).toBeDisabled();
    await verificarAccesibilidad(page);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByRole('region', { name: 'Monto a reembolsar' })).toContainText('66.406 COP');
    await elegirYAceptar(page);

    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    await expect(page.getByRole('alert')).toContainText('El monto a reembolsar cambió');
    await expect(page.getByRole('region', { name: 'Monto a reembolsar' })).toContainText('61.663 COP');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Confirmar cancelación' })).toBeDisabled();
    await verificarAccesibilidad(page);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    await expect(page).toHaveURL(`/originacion/polizas/${POLIZA_ID}`);
    await expect(page.getByRole('region', { name: 'Detalle del reembolso' })).toContainText('61.663 COP');
    expect(simulacion.confirmaciones.map((c) => (c as { refund_amount: number }).refund_amount)).toEqual([66406, 61663]);
  });
});
