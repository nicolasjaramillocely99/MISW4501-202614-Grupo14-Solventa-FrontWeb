import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  CERRADA,
  EN_CAMINO,
  ID_CASO,
  TERMINADA,
  VISITA_REPORTADA,
} from '../../fixtures/intervencion';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { SeguimientoIntervencionPagina } from '../../paginas/seguimiento-intervencion.pagina';

const RUTA = `/siniestros/${ID_CASO}/seguimiento`;

/**
 * Seguimiento de la intervención del prestador y cierre del caso (HU-W2.3-02, O8). Cognito y el API Gateway se simulan
 * con `page.route`; la sesión es la de un analista de operaciones. El orden de los pasos, el cierre y la liberación del
 * prestador los certifica el backend: aquí se verifica que el portal los muestra y envía lo correcto.
 */
test.describe('Seguimiento de la intervención y cierre del caso (HU-W2.3-02)', () => {
  test.beforeEach(async ({ page }) => {
    await simularCognito(page);
  });

  test('registra la visita con su informe y la línea de tiempo lo refleja (CA-1 y CA-2)', async ({
    page,
  }) => {
    const o8 = new SeguimientoIntervencionPagina(page);
    const trafico = await o8.simularGateway({
      lectura: EN_CAMINO,
      trasAvances: [VISITA_REPORTADA],
    });
    await o8.abrirComo(RUTA);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Intervención del prestador · SIN-2026-01655' }),
    ).toBeVisible();
    await expect(o8.fila('accepted')).toContainText('visita programada 15/09/2026 8:00 a 12:00');
    await expect(o8.fila('visit_done')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByText('El informe llega con la visita del prestador.')).toBeVisible();
    await verificarAccesibilidad(page);

    await o8.fila('visit_done').getByRole('button', { name: 'Registrar avance' }).click();
    const dialogo = o8.dialogo();
    await expect(dialogo).toHaveAccessibleName(
      'Registrar avance: Visita realizada e informe enviado',
    );
    await dialogo.getByLabel('Fecha y hora del avance').fill('2026-09-15T09:30');
    await dialogo.getByLabel('Causa verificada').fill('Filtración por tubería del piso superior');
    await dialogo.getByLabel('Daño').fill('Techo y muro de cocina · 6 m²');
    await dialogo.getByLabel('Costo de reparación (COP)').fill('4350000');
    await dialogo.getByLabel('Tiempo de ejecución (días hábiles)').fill('2');
    await dialogo.getByLabel('Fotografías recibidas').fill('8');
    await verificarAccesibilidad(page);
    await dialogo.getByRole('button', { name: 'Registrar avance' }).click();

    await expect(dialogo).toBeHidden();
    expect(trafico.avances).toEqual([
      {
        step: 'visit_done',
        occurred_at: '2026-09-15T14:30:00.000Z',
        report: {
          cause: 'Filtración por tubería del piso superior',
          damage: 'Techo y muro de cocina · 6 m²',
          repair_cost_minor: 435_000_000,
          repair_days: 2,
          photos: 8,
        },
      },
    ]);
    await expect(o8.fila('visit_done')).toContainText(
      'Causa: Filtración por tubería del piso superior',
    );
    await expect(o8.fila('repair_authorized')).toHaveAttribute('aria-current', 'step');
    const informe = page.getByRole('region', { name: 'Informe del prestador' });
    await expect(informe).toContainText('2 días hábiles');
    await expect(informe).toContainText('8 fotografías recibidas por el prestador');
  });

  test('no deja cerrar mientras la intervención no termina (CA-4)', async ({
    page,
  }) => {
    const o8 = new SeguimientoIntervencionPagina(page);
    await o8.simularGateway({ lectura: VISITA_REPORTADA });
    await o8.abrirComo(RUTA);

    await page.getByRole('button', { name: 'Cerrar caso' }).click();
    await expect(o8.dialogo().getByRole('alert')).toContainText(
      'falta registrar reparación autorizada y reparación ejecutada y cierre',
    );
    await expect(o8.dialogo().getByRole('button', { name: 'Cerrar caso' })).toBeDisabled();
    await verificarAccesibilidad(page);
    await o8.dialogo().getByRole('button', { name: 'Cancelar' }).click();
    await expect(o8.dialogo()).toBeHidden();
  });

  test('cierra el caso terminado con su resultado y deja de ofrecer acciones (CA-3 y CA-5)', async ({ page }) => {
    const o8 = new SeguimientoIntervencionPagina(page);
    const trafico = await o8.simularGateway({
      lectura: TERMINADA,
      trasCierres: [{ status: 201, cuerpo: CERRADA }],
    });
    await o8.abrirComo(RUTA);
    await expect(page.getByText('Listo para cerrar')).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar caso' }).click();
    const dialogo = o8.dialogo();
    await dialogo.getByRole('button', { name: 'Cerrar caso' }).click();
    await expect(dialogo.getByText('Marca la confirmación para cerrar el caso.')).toBeVisible();
    expect(trafico.cierres).toHaveLength(0);

    await dialogo.getByLabel('Resultado del cierre').selectOption('repaired');
    await dialogo.getByLabel('Fecha y hora de cierre').fill('2026-09-18T17:00');
    await dialogo.getByLabel('Observaciones').fill('Asegurada conforme');
    await dialogo.getByRole('checkbox').check();
    await verificarAccesibilidad(page);
    await dialogo.getByRole('button', { name: 'Cerrar caso' }).click();

    await expect(dialogo).toBeHidden();
    expect(trafico.cierres).toEqual([
      { result: 'repaired', closed_at: '2026-09-18T22:00:00.000Z', notes: 'Asegurada conforme' },
    ]);
    await expect(page.getByRole('region', { name: 'Caso cerrado' })).toContainText(
      'Reparación completada · Observaciones: Asegurada conforme',
    );
    await expect(page.getByRole('button', { name: 'Cerrar caso' })).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('el asegurado no entra al seguimiento', async ({ page }) => {
    const o8 = new SeguimientoIntervencionPagina(page);
    await o8.simularGateway({ lectura: CERRADA });
    await o8.abrirComo(RUTA, 'asegurado');
    await expect(page).toHaveURL('/acceso/no-autorizado');
  });
});
