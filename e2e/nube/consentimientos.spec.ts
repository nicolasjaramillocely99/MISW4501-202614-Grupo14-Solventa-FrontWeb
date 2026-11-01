import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_NUBE, RolNube, USUARIOS_NUBE } from '../fixtures/usuarios-nube';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';
import { ListadoConsentimientosPagina } from '../paginas/listado-consentimientos.pagina';

/**
 * Humo del listado de consentimientos en el portal **desplegado** (HU-W4.2-01, ventana de staging): Cognito real con los
 * usuarios permanentes, CloudFront y el API Gateway con el `GET` exacto de `/v1/audit/consents` publicado con Cognito.
 * **Sin `page.route`**. Solo existe en el proyecto `nube` (`E2E_NUBE=1` y `E2E_BASE_URL`), nunca en el CI. Los datos los
 * siembra `tests/e2e/hu-w4.2/list-cloud.sh` del backend; esta prueba no depende de cuántos haya.
 */

async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await page.goto('/acceso/iniciar-sesion');
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe('Listado de consentimientos en la nube (HU-W4.2-01)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
  });

  test('el analista de operaciones lista, filtra, pagina y abre el detalle (CA-1, CA-2, CA-4)', async ({ page }) => {
    const listado = new ListadoConsentimientosPagina(page);
    await ingresar(page, 'operaciones');

    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Consentimientos' }).click();

    await expect(page).toHaveURL(/\/auditoria\/consentimientos$/);
    await expect(listado.titulo).toHaveText('Consentimientos Open Finance');
    await expect(listado.indicadores).toBeVisible({ timeout: 30_000 });
    await expect(listado.conteo).toBeVisible();
    await verificarAccesibilidad(page);

    await listado.estado.selectOption('active');
    await expect(page).toHaveURL(/estado=active/);
    await expect(listado.conteo).toBeVisible({ timeout: 30_000 });
    if (await listado.siguiente.isEnabled()) {
      await listado.siguiente.click();
      await expect(page).toHaveURL(/estado=active&pagina=2/);
      await expect(listado.filas.first()).toContainText('Activo');
    }

    if ((await listado.filas.count()) > 0) {
      await listado.filas.first().getByRole('link').click();
      await expect(page.getByRole('region', { name: 'Datos del cliente y del consentimiento' })).toContainText('Finalidad', {
        timeout: 30_000,
      });
      await verificarAccesibilidad(page);
      await page.getByRole('main').getByRole('link', { name: 'Consentimientos' }).click();
      await expect(page).toHaveURL(/estado=active/);
    }
  });

  test('un filtro sin resultados muestra el estado vacío (CA-3)', async ({ page }) => {
    const listado = new ListadoConsentimientosPagina(page);
    await ingresar(page, 'operaciones');

    await page.goto(`/auditoria/consentimientos?cliente=nadie-${Date.now().toString(36)}`);

    await expect(page.getByRole('heading', { name: 'Sin consentimientos para el filtro aplicado' })).toBeVisible({ timeout: 30_000 });
    await expect(listado.conteo).toHaveText(/0 registros · página 1 de 1/);
    await verificarAccesibilidad(page);
  });

  test('el asesor no ve la opción y no entra (CA-6)', async ({ page }) => {
    await ingresar(page, 'asesor');

    await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Consentimientos' })).toHaveCount(0);
    await page.goto('/auditoria/consentimientos');
    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);
  });
});
