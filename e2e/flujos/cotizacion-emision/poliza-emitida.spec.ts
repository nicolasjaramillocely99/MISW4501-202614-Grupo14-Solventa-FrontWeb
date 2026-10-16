import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { PolizaEmitidaPagina } from '../../paginas/poliza-emitida.pagina';

const COMPLETADA = {
  policy_id: 'pol-e2e',
  status: 'completed',
  activated_at: '2026-10-16T15:00:00Z',
  available_at: '2026-10-16T15:00:01Z',
  within_slo: true,
  document: { document_id: 'b1e2', version: 1, size_bytes: 2310, generated_at: '2026-10-16T15:00:01Z' },
  notification: { channel: 'email', status: 'sent', attempts: 0, sent_at: '2026-10-16T15:00:01Z' },
};

const PENDIENTE = {
  ...COMPLETADA,
  status: 'pending',
  available_at: null,
  within_slo: null,
  document: null,
  notification: { channel: 'email', status: 'pending', attempts: 0, sent_at: null },
};

/** Paso 5 del canal embebido: póliza emitida (HU-W1.3-03). Cognito y el API Gateway se simulan con `page.route`. */
test.describe('Póliza emitida: documento y notificación (HU-W1.3-03)', () => {
  test('espera la generación del documento y luego permite descargarlo', async ({ page }) => {
    await simularCognito(page);
    const poliza = new PolizaEmitidaPagina(page);
    const llamadas = await poliza.simularGateway([
      { estado: 200, cuerpo: PENDIENTE },
      { estado: 200, cuerpo: COMPLETADA },
    ]);

    await poliza.abrirConSesion('pol-e2e');
    await expect(poliza.titulo).toHaveText('Estamos preparando tu documento');
    await expect(poliza.descargar).toBeDisabled();
    await verificarAccesibilidad(page);

    await expect(poliza.titulo).toHaveText('Tu póliza fue emitida', { timeout: 10_000 });
    await expect(page.getByText(/Te enviamos un correo con un enlace seguro/)).toBeVisible();
    await expect(poliza.descargar).toBeEnabled();
    expect(llamadas.consultas).toBeGreaterThanOrEqual(2);
    await verificarAccesibilidad(page);

    const [descarga] = await Promise.all([page.waitForEvent('download'), poliza.descargar.click()]);
    expect(descarga.suggestedFilename()).toBe('poliza-pol-e2e.pdf');
  });

  test('avisa si el correo no pudo entregarse pero deja descargar el documento', async ({ page }) => {
    await simularCognito(page);
    const poliza = new PolizaEmitidaPagina(page);
    await poliza.simularGateway([
      {
        estado: 200,
        cuerpo: { ...COMPLETADA, status: 'failed', notification: { channel: 'email', status: 'failed', attempts: 12, sent_at: null } },
      },
    ]);

    await poliza.abrirConSesion('pol-e2e');

    await expect(page.getByText(/No logramos enviarte el correo/)).toBeVisible();
    await expect(poliza.descargar).toBeEnabled();
    await verificarAccesibilidad(page);
  });

  test('una póliza que aún no tiene emisión se informa y permite reintentar', async ({ page }) => {
    await simularCognito(page);
    const poliza = new PolizaEmitidaPagina(page);
    await poliza.simularGateway([{ estado: 404, cuerpo: { error: 'policy_not_found', message: 'x' } }]);

    await poliza.abrirConSesion('pol-e2e');

    await expect(poliza.alerta).toContainText('Aún no encontramos una emisión');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await verificarAccesibilidad(page);
  });
});
