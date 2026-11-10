import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { FOTOS, ID_DEVUELTO, INFORME_ILEGIBLE } from '../../fixtures/correccion';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { documentoPdf, fotoJpg } from '../../fixtures/siniestros';
import { CorreccionRadicacionPagina } from '../../paginas/correccion-radicacion.pagina';

/**
 * Edición de la radicación devuelta (HU-W2.1-04, A9). Cognito y el API Gateway se simulan con `page.route`; la sesión
 * es la de un asegurado.
 */
test.describe('Edición de la radicación devuelta (HU-W2.1-04)', () => {
  test('desde el detalle corrige el informe, sube la placa, ajusta el lugar y reenvía con el mismo número (CA-1 a CA-4)', async ({
    page,
  }) => {
    await simularCognito(page);
    const correccion = new CorreccionRadicacionPagina(page);
    const trafico = await correccion.simularGateway();

    await correccion.abrirComo(`/siniestros/${ID_DEVUELTO}`);
    await expect(page.getByText('El asesor devolvió tu radicación')).toBeVisible();
    await page.getByRole('link', { name: 'Corregir y reenviar' }).click();

    await expect(page).toHaveURL(`/siniestros/${ID_DEVUELTO}/corregir`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01877' }),
    ).toBeVisible();
    await expect(page.getByText(/no es legible y falta la fotografía de la placa/)).toBeVisible();
    await expect(page.getByText('2 pendientes')).toBeVisible();
    await expect(correccion.fila('traffic_report')).toContainText('Reemplazar');
    await expect(correccion.fila('plate_photo')).toContainText('Falta');
    await expect(page.getByText('Pedido por el asesor')).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/correccion/a9-devuelta.png', fullPage: true });

    // CA-3: no se reenvía mientras falte algo.
    await page.getByRole('button', { name: 'Reenviar radicación' }).click();
    await expect(page.getByRole('alert')).toContainText('Antes de reenviar, completa lo que falta');
    expect(trafico.reenvios).toEqual([]);

    await correccion.subir(
      'Reemplazar archivos de Informe de tránsito o croquis',
      documentoPdf('croquis-legible.pdf'),
    );
    await correccion.subir('Subir archivos de Fotografía de la placa', fotoJpg('placa.jpg'));
    await expect(correccion.fila('traffic_report')).toContainText('Listo');
    await expect(correccion.fila('plate_photo')).toContainText('Listo');
    await page
      .getByLabel(/Lugar del hecho/)
      .fill('Calle 80 con carrera 30, frente al centro comercial, Bogotá');
    await expect(page.getByText('0 pendientes')).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('button', { name: 'Reenviar radicación' }).click();

    await expect(page.getByRole('heading', { name: 'Radicación reenviada' })).toBeVisible();
    await expect(
      page.getByText(/SIN-2026-01877 conserva su número y volvió a estado Activo/),
    ).toBeVisible();
    expect(trafico.subidas).toEqual(['croquis-legible.pdf', 'placa.jpg']);
    expect(trafico.reenvios).toHaveLength(1);
    const cuerpo = trafico.reenvios[0];
    expect(cuerpo['review_seq']).toBe(1);
    expect(cuerpo['place']).toBe('Calle 80 con carrera 30, frente al centro comercial, Bogotá');
    expect(cuerpo['occurred_at']).toBeUndefined();
    const soportes = cuerpo['supports'] as { requirement_code: string; support_ids: string[] }[];
    expect(soportes.map((s) => s.requirement_code)).toEqual(['traffic_report', 'plate_photo']);
    expect(soportes[0].support_ids).not.toContain(INFORME_ILEGIBLE.support_id);
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Ver el siniestro' }).click();
    await expect(page).toHaveURL(`/siniestros/${ID_DEVUELTO}`);
    await expect(page.getByText('El asesor devolvió tu radicación')).toHaveCount(0);
  });

  test('agregar una foto envía las seis de antes más la nueva (CA-2)', async ({ page }) => {
    await simularCognito(page);
    const correccion = new CorreccionRadicacionPagina(page);
    const trafico = await correccion.simularGateway();
    await correccion.abrirComo(`/siniestros/${ID_DEVUELTO}/corregir`);

    await correccion.subir('Agregar archivos a Fotos del vehículo', fotoJpg('foto-7.jpg'));
    await correccion.subir(
      'Reemplazar archivos de Informe de tránsito o croquis',
      documentoPdf('croquis.pdf'),
    );
    await correccion.subir('Subir archivos de Fotografía de la placa', fotoJpg('placa.jpg'));
    await expect(page.getByText('0 pendientes')).toBeVisible();
    await page.getByRole('button', { name: 'Reenviar radicación' }).click();
    await expect(page.getByRole('heading', { name: 'Radicación reenviada' })).toBeVisible();

    const fotos = (
      trafico.reenvios[0]['supports'] as { requirement_code: string; support_ids: string[] }[]
    )[0];
    expect(fotos.requirement_code).toBe('vehicle_photos');
    expect(fotos.support_ids.slice(0, 6)).toEqual(FOTOS.map((f) => f.support_id));
    expect(fotos.support_ids).toHaveLength(7);
  });

  test('lo que el servidor rechaza queda señalado en su soporte (422)', async ({ page }) => {
    await simularCognito(page);
    const correccion = new CorreccionRadicacionPagina(page);
    await correccion.simularGateway({
      respuestas: [
        {
          estado: 422,
          cuerpo: {
            error: 'validation_failed',
            message: 'x',
            fields: [{ field: 'supports.plate_photo', code: 'invalid_format' }],
          },
        },
      ],
    });
    await correccion.abrirComo(`/siniestros/${ID_DEVUELTO}/corregir`);

    await correccion.subir(
      'Reemplazar archivos de Informe de tránsito o croquis',
      documentoPdf('croquis.pdf'),
    );
    await correccion.subir('Subir archivos de Fotografía de la placa', fotoJpg('placa.jpg'));
    await page.getByRole('button', { name: 'Reenviar radicación' }).click();

    await expect(correccion.fila('plate_photo')).toContainText(
      'un archivo no tiene un formato admitido',
    );
    await expect(page.getByRole('heading', { name: 'Radicación reenviada' })).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('el asesor no corrige una radicación: va a «acceso no autorizado» (CA-5)', async ({
    page,
  }) => {
    await simularCognito(page);
    await new CorreccionRadicacionPagina(page).abrirComo(
      `/siniestros/${ID_DEVUELTO}/corregir`,
      'asesor',
    );

    await expect(page).toHaveURL('/acceso/no-autorizado');
  });
});
