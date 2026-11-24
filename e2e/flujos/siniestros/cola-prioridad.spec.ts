import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { COLA_PRIORIDAD, DETALLE, RESUMEN_COLA } from '../../fixtures/evaluacion';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { EvaluacionSiniestroPagina } from '../../paginas/evaluacion-siniestro.pagina';

/**
 * Cola de trabajo ordenada por prioridad (HU-W2.2-02, O5). Cognito y el API Gateway se simulan con `page.route`; la
 * sesión es la de un analista de operaciones.
 */
test.describe('Cola de siniestros por prioridad (HU-W2.2-02)', () => {
  test('muestra la cola por prioridad con indicadores, asegurado y filtros (CA-1, CA-2, O5)', async ({
    page,
  }) => {
    await simularCognito(page);
    const cola = new EvaluacionSiniestroPagina(page);
    const trafico = await cola.simularGateway({
      cola: COLA_PRIORIDAD,
      resumen: RESUMEN_COLA,
      excepciones: [],
      detalle: DETALLE,
    });

    await cola.abrirComo('/siniestros/evaluacion');

    await expect(page.getByRole('heading', { level: 1, name: 'Cola de siniestros' })).toBeVisible();
    const filas = page.getByRole('row');
    await expect(filas.nth(1)).toContainText(/Triage 1.*SIN-2026-01690.*Andrea Rojas Mejía/);
    await expect(filas.nth(2)).toContainText(/Triage 2.*SIN-2026-01655.*Carolina Pérez Ruiz/);
    await expect(page.locator('[data-nivel="1"]')).toHaveText('3');
    await expect(page.locator('[data-nivel="2"]')).toHaveText('7');
    await expect(page.locator('[data-nivel="3"]')).toHaveText('12');
    await expect(page.getByText('4.2 días')).toBeVisible();
    await expect(page.getByText(/2 casos en cola · actualizado hace/)).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/cola/o5-cola-prioridad.png', fullPage: true });

    await page.getByLabel('Prioridad', { exact: true }).selectOption('1');
    await page.getByLabel('Producto', { exact: true }).selectOption('auto');

    await expect.poll(() => trafico.consultasCola.at(-1)?.toString()).toBe('level=1&line=auto');
    await page.getByLabel('Prioridad', { exact: true }).selectOption('');
    await expect.poll(() => trafico.consultasCola.at(-1)?.toString()).toBe('line=auto');
  });

  test('una cola vacía no muestra indicadores ficticios (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const cola = new EvaluacionSiniestroPagina(page);
    await cola.simularGateway({ cola: [], excepciones: [], detalle: DETALLE });

    await cola.abrirComo('/siniestros/evaluacion');

    await expect(page.getByText('No hay siniestros en evaluación.')).toBeVisible();
    await expect(page.locator('[data-nivel="1"]')).toHaveText('0');
    await expect(page.getByText('Sin casos decididos')).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('solo operaciones entra a la cola (CA-5)', async ({ page }) => {
    await simularCognito(page);
    const cola = new EvaluacionSiniestroPagina(page);
    await cola.simularGateway({
      cola: COLA_PRIORIDAD,
      resumen: RESUMEN_COLA,
      excepciones: [],
      detalle: DETALLE,
    });

    await cola.abrirComo('/siniestros/evaluacion', 'asesor');

    await expect(page).toHaveURL('/acceso/no-autorizado');
  });
});
