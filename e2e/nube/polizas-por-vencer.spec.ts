import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_NUBE, RolNube, USUARIOS_NUBE } from '../fixtures/usuarios-nube';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';
import { PolizasPorVencerPagina } from '../paginas/polizas-por-vencer.pagina';

/**
 * Humo de las pólizas próximas a vencer en el portal **desplegado** (HU-W1.5-01, ventana de staging): Cognito real con los
 * usuarios permanentes, CloudFront y el API Gateway (`/v1/policies/{proxy+}` con Cognito). **Sin `page.route`**. Solo existe
 * en el proyecto `nube` (`E2E_NUBE=1` y `E2E_BASE_URL`), nunca en el CI. Las pólizas las siembra el guion único de las
 * renovaciones del backend (`tests/e2e/hu-w1.5/assisted-renewal-cloud.sh --seed`, HU-W1.5-03) para el asegurado permanente;
 * esta prueba no depende de cuántas haya, solo de que haya alguna renovable.
 */

async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await page.goto('/acceso/iniciar-sesion');
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
  await expect(page).toHaveURL(/\/inicio$/);
}

/** Un día civil `AAAA-MM-DD` a `años` de hoy: un rango sin pólizas sembradas (vencen en 12 o 24 meses). */
function diaEn(anios: number, dias = 0): string {
  const fecha = new Date();
  fecha.setUTCFullYear(fecha.getUTCFullYear() + anios);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

test.describe('Pólizas próximas a vencer en la nube (HU-W1.5-01)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
  });

  test('el asesor ve las pólizas por vencer y «Renovar» lleva a la renovación asistida (CA-1, CA-4)', async ({ page }) => {
    const s6 = new PolizasPorVencerPagina(page);
    await ingresar(page, 'asesor');

    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Renovaciones' }).click();

    await expect(page).toHaveURL(/\/originacion\/renovaciones$/);
    await expect(s6.titulo).toHaveText('Renovaciones');
    await expect(s6.tarjeta).toContainText(/Vencen en \d+ días/, { timeout: 30_000 });
    await expect(s6.filas.first()).toBeVisible({ timeout: 30_000 });
    await expect(s6.desde).not.toHaveValue('');
    await expect(s6.hasta).not.toHaveValue('');
    await expect(s6.filas.first()).toContainText(/Por vencer|Renovación en curso/);
    await verificarAccesibilidad(page);

    const renovar = page.getByRole('link', { name: /^Renovar la póliza / }).first();
    await expect(renovar).toHaveAttribute('href', /^\/originacion\/renovaciones\/[^/]+$/);
  });

  test('filtra por estado y por rango, y un rango sin pólizas muestra el estado vacío (CA-2, CA-3)', async ({ page }) => {
    const s6 = new PolizasPorVencerPagina(page);
    await ingresar(page, 'asesor');
    await page.goto('/originacion/renovaciones');
    await expect(s6.filas.first()).toBeVisible({ timeout: 30_000 });

    await s6.estado.selectOption('expiring');
    await expect(page).toHaveURL(/estado=expiring/);
    await expect(s6.conteo).toBeVisible({ timeout: 30_000 });

    await page.goto(`/originacion/renovaciones?desde=${diaEn(5)}&hasta=${diaEn(5, 7)}`);
    await expect(page.getByRole('heading', { name: 'Sin pólizas por vencer en el rango' })).toBeVisible({ timeout: 30_000 });
    await expect(s6.conteo).toHaveText('0 resultados');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await verificarAccesibilidad(page);

    await s6.limpiarFiltros.click();
    await expect(page).toHaveURL(/\/originacion\/renovaciones$/);
    await expect(s6.filas.first()).toBeVisible({ timeout: 30_000 });
  });

  test('el asegurado no ve la opción y no entra', async ({ page }) => {
    await ingresar(page, 'asegurado');

    await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Renovaciones' })).toHaveCount(0);
    await page.goto('/originacion/renovaciones');
    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);
  });
});
