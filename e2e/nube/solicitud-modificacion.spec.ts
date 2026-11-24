import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_NUBE, RolNube, USUARIOS_NUBE } from '../fixtures/usuarios-nube';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';

/**
 * Humo de la solicitud de modificación en el portal **desplegado** (HU-W1.4-01, ventana de staging): Cognito real con los
 * usuarios permanentes, CloudFront y el API Gateway (`/v1/policies` y `/v1/policies/{proxy+}` con Cognito). **Sin
 * `page.route`** y **sin radicar nada**: la radicación por API la comprueba `tests/e2e/hu-w1.4/change-request-cloud.sh` del
 * backend sobre P9 y la demostración guiada usa P8 (siembra única `assisted-renewal-cloud.sh --seed`). Solo existe en el
 * proyecto `nube` (`E2E_NUBE=1` y `E2E_BASE_URL`), nunca en el CI.
 */

async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await page.goto('/acceso/iniciar-sesion');
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe('Solicitud de modificación en la nube (HU-W1.4-01)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
  });

  test('el asegurado abre A3 desde «Mis pólizas» con los tres tipos y el beneficiario oneroso (CA-1)', async ({ page }) => {
    await ingresar(page, 'asegurado');
    await page.goto('/originacion/polizas');

    const modificar = page.getByRole('link', { name: /^Solicitar modificación de la póliza / }).first();
    await expect(modificar).toBeVisible({ timeout: 30_000 });
    await modificar.click();

    await expect(page).toHaveURL(/\/originacion\/polizas\/[^/]+\/modificar$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitar una modificación');
    await expect(page.getByRole('group', { name: 'Tipo de cambio' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('radio')).toHaveCount(3);
    await verificarAccesibilidad(page);
  });

  test('el asegurado ve «Mis solicitudes» con sus indicadores (CA-2)', async ({ page }) => {
    await ingresar(page, 'asegurado');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Mis solicitudes' }).click();

    await expect(page).toHaveURL(/\/originacion\/solicitudes$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mis solicitudes');
    await expect(page.getByRole('region', { name: 'Resumen de tus solicitudes' })).toBeVisible({ timeout: 30_000 });
    await verificarAccesibilidad(page);
  });

  for (const rol of ['asesor', 'operaciones'] as const) {
    test(`${rol} no entra a la solicitud de modificación (CA-4)`, async ({ page }) => {
      await ingresar(page, rol);

      for (const ruta of ['/originacion/solicitudes', '/originacion/polizas/pol-x/modificar']) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/acceso\/no-autorizado$/, { timeout: 30_000 });
      }
    });
  }
});
