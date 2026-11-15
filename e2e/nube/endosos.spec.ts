import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_NUBE, RolNube, USUARIOS_NUBE } from '../fixtures/usuarios-nube';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';

/**
 * Humo de los endosos del analista en el portal **desplegado** (HU-W1.4-02, ventana de staging): Cognito real con los
 * usuarios permanentes, CloudFront y el API Gateway (`/v1/policies/{proxy+}` con Cognito). **Sin `page.route`** y **sin
 * decidir nada**: no pulsa *Revisar*, *Aplicar endoso*, *Rechazar* ni *Devolver*; las decisiones las comprueba
 * `tests/e2e/hu-w1.4/endorsement-cloud.sh` del backend y la demostración guiada usa las solicitudes de la siembra única
 * (`assisted-renewal-cloud.sh --seed`). Solo existe en el proyecto `nube` (`E2E_NUBE=1` y `E2E_BASE_URL`), nunca en el CI.
 */

async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await page.goto('/acceso/iniciar-sesion');
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe('Endosos del analista en la nube (HU-W1.4-02)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
  });

  test('operaciones abre la bandeja, una solicitud aplicada y su historial (CA-1, CA-4)', async ({ page }) => {
    await ingresar(page, 'operaciones');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Endosos' }).click();

    await expect(page).toHaveURL(/\/originacion\/endosos$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Endosos');
    await expect(page.getByRole('region', { name: 'Indicadores de los endosos' })).toBeVisible({ timeout: 30_000 });
    await verificarAccesibilidad(page);

    await page.getByLabel('Estado', { exact: true }).selectOption('applied');
    await expect(page).toHaveURL(/estado=applied/);
    const ver = page.getByRole('link', { name: /^Ver la solicitud SOL-MOD-/ }).first();
    await expect(ver).toBeVisible({ timeout: 30_000 });
    await ver.click();

    await expect(page).toHaveURL(/\/originacion\/endosos\/SOL-MOD-[^/]+$/);
    await expect(page.locator('.encabezado app-insignia-estado')).toHaveText('Aplicada', { timeout: 30_000 });
    await expect(page.getByRole('table', { name: 'Cambio solicitado' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Endoso aplicado' })).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Ver historial' }).click();
    await expect(page).toHaveURL(/\/originacion\/polizas\/[^/]+\/endosos$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historial de endosos');
    await expect(page.getByRole('table', { name: 'Entradas del historial' }).locator('tbody tr').first()).toContainText(/END-\d{4}-\d{4}/, {
      timeout: 30_000,
    });
    await verificarAccesibilidad(page);
  });

  for (const rol of ['asegurado', 'asesor'] as const) {
    test(`${rol} no entra a los endosos del analista`, async ({ page }) => {
      await ingresar(page, rol);

      for (const ruta of ['/originacion/endosos', '/originacion/endosos/SOL-MOD-2026-0001', '/originacion/polizas/pol-x/endosos']) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/acceso\/no-autorizado$/, { timeout: 30_000 });
      }
    });
  }
});
