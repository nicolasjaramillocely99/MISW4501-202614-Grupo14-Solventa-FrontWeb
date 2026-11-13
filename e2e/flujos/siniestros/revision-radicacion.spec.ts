import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { ID_CASO } from '../../fixtures/evaluacion';
import { APROBADA, DEVUELTA, RADICACION, RADICACIONES } from '../../fixtures/revision';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { RevisionRadicacionPagina } from '../../paginas/revision-radicacion.pagina';

/**
 * Intervención del asesor en la aprobación de la radicación (HU-W2.1-03, S8). Cognito y el API Gateway se simulan con
 * `page.route`; la sesión es la de un asesor comercial.
 */
test.describe('Revisión de la radicación por el asesor (HU-W2.1-03)', () => {
  test('abre la radicación desde «Siniestros», ve los soportes y la aprueba (CA-1, CA-2)', async ({
    page,
  }) => {
    await simularCognito(page);
    const revision = new RevisionRadicacionPagina(page);
    const trafico = await revision.simularGateway({
      radicaciones: RADICACIONES,
      detalle: RADICACION,
      trasAprobar: APROBADA,
    });

    await revision.abrirComo('/siniestros/revision');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Radicaciones por revisar' }),
    ).toBeVisible();
    await expect(
      page.getByRole('row', { name: /SIN-2026-01877.*Autos · Colisión.*Portal web/ }),
    ).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Revisar la radicación SIN-2026-01877' }).click();
    await expect(page).toHaveURL(`/siniestros/revision/${ID_CASO}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Radicación SIN-2026-01877' }),
    ).toBeVisible();
    await expect(page.getByText('Pendiente de revisión')).toBeVisible();
    await expect(page.getByText('Calle 80 con carrera 30, Bogotá')).toBeVisible();
    await expect(
      page.getByText(/SIN-2026-01500 · rechazado \(cristales, 08\/2026\)/),
    ).toBeVisible();
    await expect(page.locator('[data-codigo="plate_photo"]')).toContainText('Opcional');
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/revision/s8-pendiente.png', fullPage: true });

    await page.getByRole('button', { name: 'Aprobar y enviar a evaluación' }).click();

    expect(trafico.aprobaciones).toEqual([{}]);
    await expect(
      page.getByText(/pasó a «En evaluación» y entró a la cola de triage/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprobar y enviar a evaluación' })).toHaveCount(
      0,
    );
    await expect(page.getByText('Aprobada por Laura Gómez')).toBeVisible();
  });

  test('marca el informe ilegible, pide la placa y devuelve al cliente con el motivo y el mensaje (CA-3)', async ({
    page,
  }) => {
    await simularCognito(page);
    const revision = new RevisionRadicacionPagina(page);
    const trafico = await revision.simularGateway({
      radicaciones: RADICACIONES,
      detalle: RADICACION,
      trasDevolver: DEVUELTA,
    });

    await revision.abrirComo(`/siniestros/revision/${ID_CASO}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Radicación SIN-2026-01877' }),
    ).toBeVisible();

    const informe = page.locator('[data-codigo="traffic_report"]');
    await informe.getByRole('radio', { name: 'Ilegible' }).check();
    await informe.getByRole('textbox').fill('borroso, no se lee el número de croquis');
    await page
      .locator('[data-codigo="plate_photo"]')
      .getByRole('checkbox', { name: 'Solicitar al cliente' })
      .check();
    await expect(
      page.getByRole('button', { name: 'Aprobar y enviar a evaluación' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Devolver al cliente' }).click();
    await expect(page.getByLabel('Motivo')).toBeFocused();
    await page.getByLabel('Motivo').selectOption('illegible_or_incomplete_supports');
    await page
      .getByLabel('Mensaje para el cliente')
      .fill('El informe de tránsito no se puede leer y falta la foto de la placa.');
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/revision/s8-devolucion.png', fullPage: true });

    await page.getByRole('button', { name: 'Devolver radicación' }).click();

    expect(trafico.devoluciones).toEqual([
      {
        reason_code: 'illegible_or_incomplete_supports',
        message: 'El informe de tránsito no se puede leer y falta la foto de la placa.',
        supports: [
          {
            requirement_code: 'traffic_report',
            verdict: 'illegible',
            note: 'borroso, no se lee el número de croquis',
          },
          { requirement_code: 'plate_photo', verdict: 'missing' },
        ],
        facts_to_correct: [],
      },
    ]);
    await expect(page.getByText(/quedó «Devuelto al cliente»/)).toBeVisible();
    await expect(page.getByText('Devuelta por Laura Gómez')).toBeVisible();
    await expect(page.locator('[data-codigo="traffic_report"]')).toContainText('Ilegible');
  });

  test('no deja devolver sin motivo, mensaje ni nada que pedir', async ({ page }) => {
    await simularCognito(page);
    const revision = new RevisionRadicacionPagina(page);
    const trafico = await revision.simularGateway({
      radicaciones: RADICACIONES,
      detalle: RADICACION,
    });

    await revision.abrirComo(`/siniestros/revision/${ID_CASO}`);
    await page.getByRole('button', { name: 'Devolver radicación' }).click();

    await expect(page.getByText('Elige el motivo de la devolución.')).toBeVisible();
    await expect(page.getByText('Escribe el mensaje para el cliente.')).toBeVisible();
    await expect(page.getByText(/Para devolver, marca al menos un soporte/)).toBeVisible();
    expect(trafico.devoluciones).toEqual([]);
  });
});
