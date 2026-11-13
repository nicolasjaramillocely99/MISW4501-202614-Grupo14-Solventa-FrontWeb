import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_NUBE, RolNube, USUARIOS_NUBE } from '../fixtures/usuarios-nube';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';
import { PolizasPorVencerPagina } from '../paginas/polizas-por-vencer.pagina';
import { RenovacionAsistidaPagina } from '../paginas/renovacion-asistida.pagina';

/**
 * Humo de la renovación asistida en el portal **desplegado** (HU-W1.5-03, ventana de staging): Cognito real con los
 * usuarios permanentes, CloudFront y el API Gateway. **Sin `page.route`**. Solo existe en el proyecto `nube`
 * (`E2E_NUBE=1` y `E2E_BASE_URL`), nunca en el CI. Las pólizas las siembra `tests/e2e/hu-w1.5/assisted-renewal-cloud.sh
 * --seed` del backend. La prueba recotiza la primera póliza renovable y deja lista la aceptación, pero **no formaliza**:
 * la formalización, el código de confirmación y el pago fallido los demuestra Nicolás con sus pólizas sembradas.
 */

async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await page.goto('/acceso/iniciar-sesion');
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe('Renovación asistida en la nube (HU-W1.5-03)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
  });

  test('el asesor entra por «Renovar», recotiza con el motor y la aceptación habilita «Formalizar» (CA-1, CA-2)', async ({ page }) => {
    const s6 = new PolizasPorVencerPagina(page);
    const s7 = new RenovacionAsistidaPagina(page);
    await ingresar(page, 'asesor');
    await page.goto('/originacion/renovaciones');
    const renovar = page.getByRole('link', { name: /^Renovar la póliza / }).first();
    await expect(renovar).toBeVisible({ timeout: 30_000 });

    await renovar.click();

    await expect(page).toHaveURL(/\/originacion\/renovaciones\/[^/]+$/);
    await expect(s7.titulo).toHaveText(/^Renovación asistida · /, { timeout: 30_000 });
    await expect(page.getByText(/^Vence el \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
    await expect(s7.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.recotizar.click();
    // Una póliza sembrada puede tener el consentimiento revocado (D-8): entonces la pantalla lo dice y no recotiza.
    const recotizada = s7.subtitulo.filter({ hasText: /Recotizada el / });
    await expect(recotizada.or(s7.alerta)).toBeVisible({ timeout: 30_000 });
    await verificarAccesibilidad(page);
    if ((await recotizada.count()) === 0) {
      return;
    }
    await expect(s7.prima).toContainText(/COP/);
    await expect(s7.fuente('Open Finance')).toContainText(/Operativo|No disponible/);
    await expect(s7.fuente('Motor de rating')).toContainText('Versión v1');

    await s7.aceptarPorLlamada(`GRAB-NUBE-${Date.now().toString(36)}`);
    await expect(s7.formalizar).toBeEnabled();

    await page.getByRole('button', { name: 'Renovaciones', exact: true }).click();
    await expect(s6.titulo).toHaveText('Renovaciones');
  });

  test('«Ver» de una renovación en curso muestra el estado del cobro (01·D-3 a+)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await ingresar(page, 'asesor');
    await page.goto('/originacion/renovaciones?estado=renewal_in_progress');
    const ver = page.getByRole('link', { name: /^Ver la renovación de la póliza / }).first();
    const vacio = page.getByRole('heading', { name: 'Sin pólizas por vencer en el rango' });
    await expect(ver.or(vacio)).toBeVisible({ timeout: 30_000 });
    test.skip((await ver.count()) === 0, 'Ninguna póliza sembrada tiene la renovación en curso todavía');

    await ver.click();

    await expect(s7.titulo).toHaveText(/^Renovación (en curso|formalizada) · /, { timeout: 30_000 });
    await expect(s7.paso('Cobro de la prima')).toBeVisible();
    await expect(s7.recotizar).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('el asegurado no entra a la renovación asistida', async ({ page }) => {
    await ingresar(page, 'asegurado');

    await page.goto('/originacion/renovaciones/pol-cualquiera');

    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);
  });
});
