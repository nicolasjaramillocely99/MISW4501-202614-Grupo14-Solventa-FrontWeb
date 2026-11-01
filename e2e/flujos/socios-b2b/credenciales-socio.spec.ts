import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import {
  APROBACION,
  DETALLE_BANCO,
  DETALLE_PENDIENTE,
  LISTADO,
  PENDIENTE_ID,
  ROTACION,
  SECRETO,
  SOCIO_ID,
} from '../../fixtures/socios';
import { SociosPagina } from '../../paginas/socios.pagina';

/**
 * Generación de credenciales para socio nuevo (HU-W3.1-01): O10 y O11. Cognito y el API Gateway se simulan con
 * `page.route`; la sesión es la de un analista de operaciones.
 */
test.describe('Credenciales de socios comerciales (HU-W3.1-01)', () => {
  test('lista los socios con su cuota diaria y abre el detalle sin el secreto', async ({ page }) => {
    await simularCognito(page);
    const socios = new SociosPagina(page);
    await socios.simular({
      'GET /v1/partners': { estado: 200, cuerpo: LISTADO },
      [`GET /v1/partners/${SOCIO_ID}`]: { estado: 200, cuerpo: DETALLE_BANCO },
    });

    await socios.abrirComo('/socios');

    await expect(socios.titulo).toHaveText('Socios comerciales');
    await expect(socios.indicadores).toContainText('Aerolínea Aliada cerca del límite');
    await expect(socios.filas).toHaveCount(3);
    await expect(socios.filas.first()).toContainText('3.120 / 5.000 por día');
    await expect(socios.filas.nth(1)).toContainText('Cerca del límite');
    await expect(socios.filas.nth(2)).toContainText('Pendiente de aprobación');
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Ver Banco Aliado' }).click();
    await expect(page).toHaveURL(`/socios/${SOCIO_ID}`);
    await expect(socios.titulo).toHaveText('Banco Aliado');
    await expect(socios.credenciales).toContainText('sol_7f3a91c2e8d4b06f5a1c91e2');
    await expect(socios.credenciales).toContainText('termina en a1c9');
    await expect(page.getByText('Consumo de hoy · 3.120 de 5.000 solicitudes (62 %)')).toBeVisible();
    await expect(page.getByRole('button', { name: /Dar de baja/ })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(SECRETO);
    await verificarAccesibilidad(page);
  });

  test('aprueba un socio pendiente y muestra el secreto una sola vez (CA-1, CA-4)', async ({ page }) => {
    await simularCognito(page);
    const socios = new SociosPagina(page);
    const recibidas = await socios.simular({
      [`GET /v1/partners/${PENDIENTE_ID}`]: { estado: 200, cuerpo: DETALLE_PENDIENTE },
      [`POST /v1/partners/${PENDIENTE_ID}/approval`]: { estado: 201, cuerpo: APROBACION },
    });

    await socios.abrirComo(`/socios/${PENDIENTE_ID}`);
    await expect(socios.titulo).toHaveText('Fintech Pagos');
    await socios.aprobar.click();

    await expect(socios.dialogoSecreto).toBeVisible();
    await expect(socios.secreto).toHaveText(SECRETO);
    await verificarAccesibilidad(page);
    // Escape no descarta el secreto.
    await page.keyboard.press('Escape');
    await expect(socios.dialogoSecreto).toBeVisible();

    await socios.yaGuarde.click();
    await expect(socios.dialogoSecreto).toBeHidden();
    await expect(page.locator('body')).not.toContainText(SECRETO);
    await expect(socios.credenciales).toContainText('sol_fintech0000000000000001');
    expect(recibidas.map((r) => r.ruta)).toContain(`POST /v1/partners/${PENDIENTE_ID}/approval`);

    // Recargar nunca vuelve a mostrar el secreto: el detalle no lo trae.
    await page.reload();
    await expect(socios.titulo).toHaveText('Fintech Pagos');
    await expect(page.locator('body')).not.toContainText(SECRETO);
  });

  test('rota las credenciales con periodo de transición (CA-5)', async ({ page }) => {
    await simularCognito(page);
    const socios = new SociosPagina(page);
    const recibidas = await socios.simular({
      [`GET /v1/partners/${SOCIO_ID}`]: { estado: 200, cuerpo: DETALLE_BANCO },
      [`POST /v1/partners/${SOCIO_ID}/credential-rotations`]: { estado: 201, cuerpo: ROTACION },
    });

    await socios.abrirComo(`/socios/${SOCIO_ID}`);
    await socios.rotar.click();
    await expect(socios.dialogoRotar).toBeVisible();
    await verificarAccesibilidad(page);
    const horas = socios.dialogoRotar.getByLabel('Periodo de transición (horas)');
    await expect(horas).toHaveValue('24');
    await horas.fill('48');
    await socios.dialogoRotar.getByRole('button', { name: 'Rotar credenciales' }).click();

    await expect(socios.secreto).toHaveText(SECRETO);
    expect(recibidas.find((r) => r.ruta.endsWith('/credential-rotations'))?.cuerpo).toEqual({ grace_period_hours: 48 });
    await socios.yaGuarde.click();

    await expect(socios.credenciales).toContainText('La credencial anterior (sol_7f3a91c2e8d4b06f5a1c91e2) sigue vigente');
    await expect(socios.historial).toContainText('En transición');
    await verificarAccesibilidad(page);
  });

  test('un gateway caído no cambia nada y lo avisa', async ({ page }) => {
    await simularCognito(page);
    const socios = new SociosPagina(page);
    await socios.simular({
      [`GET /v1/partners/${SOCIO_ID}`]: { estado: 200, cuerpo: DETALLE_BANCO },
      [`POST /v1/partners/${SOCIO_ID}/credential-rotations`]: {
        estado: 503,
        cuerpo: { error: 'gateway_unavailable', message: 'the credentials could not be managed now' },
      },
    });

    await socios.abrirComo(`/socios/${SOCIO_ID}`);
    await socios.rotar.click();
    await socios.dialogoRotar.getByRole('button', { name: 'Rotar credenciales' }).click();

    await expect(socios.dialogoRotar.getByRole('alert')).toContainText('No se cambió nada');
    await expect(socios.dialogoSecreto).toBeHidden();
  });
});
