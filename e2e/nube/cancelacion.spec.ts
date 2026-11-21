import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_NUBE, RolNube, USUARIOS_NUBE } from '../fixtures/usuarios-nube';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';

/**
 * La cancelación con reembolso prorrateado en el portal **desplegado** (HU-W1.6-01, ventana de staging): Cognito real con
 * los usuarios permanentes, CloudFront y el API Gateway (`/v1/policies/{proxy+}`). **Sin `page.route`.** Cancela la póliza
 * C3 que compra la siembra única de la ventana (`tests/e2e/hu-w1.5/assisted-renewal-cloud.sh --seed` del backend; su id
 * llega en `NUBE_POLIZA_CANCELAR`): A5 con el cálculo (CA-1), la confirmación y A5b con el reembolso registrado (CA-2), y
 * A1 con «Cancelada». Solo existe en el proyecto `nube` (`E2E_NUBE=1` y `E2E_BASE_URL`), nunca en el CI.
 */

const POLIZA = process.env['NUBE_POLIZA_CANCELAR'] ?? '';

async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await page.goto('/acceso/iniciar-sesion');
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe('Cancelación con reembolso prorrateado en la nube (HU-W1.6-01)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
    expect(POLIZA, 'Define NUBE_POLIZA_CANCELAR con la póliza C3 de la siembra').not.toBe('');
  });

  test('el asegurado ve el cálculo, cancela C3 y ve el reembolso registrado (CA-1, CA-2)', async ({ page }) => {
    await ingresar(page, 'asegurado');
    await page.goto(`/originacion/polizas/${POLIZA}`);
    await page.getByRole('link', { name: 'Cancelar póliza' }).click({ timeout: 30_000 });

    await expect(page).toHaveURL(new RegExp(`/originacion/polizas/${POLIZA}/cancelar$`));
    const calculo = page.getByRole('region', { name: 'Cálculo del reembolso' });
    await expect(calculo).toBeVisible({ timeout: 30_000 });
    await expect(calculo).toContainText(/\d+ de \d+/);
    await expect(calculo).toContainText('Visa •••• 1111 (medio de pago original)');
    await expect(calculo).toContainText('al final del día');
    await expect(page.getByRole('region', { name: 'Monto a reembolsar' })).toContainText('COP');
    await verificarAccesibilidad(page);

    await page.getByLabel('Motivo de la cancelación').selectOption('property_sold');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    await expect(page).toHaveURL(new RegExp(`/originacion/polizas/${POLIZA}$`), { timeout: 30_000 });
    await expect(page.getByRole('status')).toContainText('Cancelación registrada');
    const detalle = page.getByRole('region', { name: 'Detalle del reembolso' });
    await expect(detalle).toContainText(/REF-\d{4}-\d{5,}/);
    await expect(detalle).toContainText('Vendí el inmueble');
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Volver a mis pólizas' }).click();
    await expect(page.getByRole('row').filter({ hasText: POLIZA })).toContainText('Cancelada', { timeout: 30_000 });
  });

  for (const rol of ['asesor', 'operaciones'] as const) {
    test(`${rol} no entra a la cancelación`, async ({ page }) => {
      await ingresar(page, rol);

      await page.goto(`/originacion/polizas/${POLIZA}/cancelar`);
      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/, { timeout: 30_000 });
    });
  }
});
