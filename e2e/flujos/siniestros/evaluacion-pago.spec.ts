import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  APROBACION_EN_EXCEPCION,
  APROBACION_PAGADA,
  COLA,
  DETALLE,
  ID_CASO,
  RECHAZO,
  REINTENTO_PAGADO,
} from '../../fixtures/evaluacion';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { EvaluacionSiniestroPagina } from '../../paginas/evaluacion-siniestro.pagina';

/**
 * Evaluación, aprobación y pago del siniestro (HU-W2.2-03). Cognito y el API Gateway se simulan con `page.route`; la
 * sesión es la de un analista de operaciones.
 */
test.describe('Evaluación, aprobación y pago del siniestro (HU-W2.2-03)', () => {
  test('abre el caso desde la cola, ve el desglose y lo aprueba hasta «Pagado» (CA-1, CA-2, CA-5)', async ({ page }) => {
    await simularCognito(page);
    const evaluacion = new EvaluacionSiniestroPagina(page);
    const trafico = await evaluacion.simularGateway({ cola: COLA, excepciones: [], detalle: DETALLE, trasAprobar: APROBACION_PAGADA });

    await evaluacion.abrirComo('/siniestros/evaluacion');

    await expect(page.getByRole('heading', { level: 1, name: 'Casos en evaluación' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Triage 2.*SIN-2026-01655.*Hogar · Daño por agua/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Triage 1.*SIN-2026-01690/ })).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Abrir el siniestro SIN-2026-01655' }).click();
    await expect(page).toHaveURL(`/siniestros/${ID_CASO}/evaluar`);
    await expect(page.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01655' })).toBeVisible();
    await expect(page.getByText('Daño por agua · deducible 5 %')).toBeVisible();
    await expect(page.getByText(/Banco Aliado •••• 4512/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'techo.jpg' })).toBeVisible();

    const bruto = page.getByLabel('Costo de reparación aprobado (antes del deducible)');
    await expect(bruto).toHaveValue('4350000');
    await expect(page.getByText('Monto aprobado (neto a pagar por la aseguradora)')).toBeVisible();
    await expect(page.getByText(/Incluye aplicación de deducible del 5 % \(\$\s?217\.500 COP a cargo del asegurado\)/)).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/evaluacion/o6-antes-de-aprobar.png', fullPage: true });

    await page.getByRole('button', { name: 'Aprobar y pagar' }).click();

    expect(trafico.aprobaciones).toEqual([{ gross_amount_minor: 435_000_000 }]);
    await expect(page.getByText(/Indemnización pagada: \$\s?4\.132\.500 COP al asegurado\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pago de la indemnización' })).toBeVisible();
    await expect(page.getByText('Aprobado por andres.ruiz@solventa.co')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprobar y pagar' })).toHaveCount(0);
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/evaluacion/o6-pagado.png', fullPage: true });
  });

  test('rechaza con motivo obligatorio y lo deja registrado (CA-3, CA-5)', async ({ page }) => {
    await simularCognito(page);
    const evaluacion = new EvaluacionSiniestroPagina(page);
    const trafico = await evaluacion.simularGateway({ cola: COLA, excepciones: [], detalle: DETALLE, trasRechazar: RECHAZO });
    await evaluacion.abrirComo(`/siniestros/${ID_CASO}/evaluar`);

    await page.getByRole('radio', { name: /Rechazar/ }).check();
    await page.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByText('El motivo es obligatorio.')).toBeVisible();
    expect(trafico.rechazos).toEqual([]);

    await page.getByLabel('Motivo del rechazo').fill('La póliza excluye los daños por falta de mantenimiento.');
    await page.getByRole('button', { name: 'Rechazar' }).click();

    expect(trafico.rechazos).toEqual([{ reason: 'La póliza excluye los daños por falta de mantenimiento.' }]);
    await expect(page.getByRole('heading', { name: 'Rechazo' })).toBeVisible();
    await expect(page.getByText('Rechazo notificado al asegurado')).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('O6b: atiende la excepción de pago y reintenta con la cuenta corregida (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const evaluacion = new EvaluacionSiniestroPagina(page);
    const enExcepcion = { ...DETALLE, claim: { ...DETALLE.claim, status: 'payment_exception' }, decision: APROBACION_EN_EXCEPCION };
    const fila = { ...COLA[0], status: 'payment_exception' };
    const trafico = await evaluacion.simularGateway({ cola: COLA, excepciones: [fila], detalle: enExcepcion, trasReintentar: REINTENTO_PAGADO });
    await evaluacion.abrirComo('/siniestros/evaluacion');

    await page.getByRole('tab', { name: 'Excepciones de pago' }).click();
    await expect(page.getByRole('row', { name: /SIN-2026-01655.*Excepción de pago/ })).toBeVisible();
    await page.getByRole('link', { name: 'Abrir el siniestro SIN-2026-01655' }).click();

    await expect(page.getByText('El pago de la indemnización falló')).toBeVisible();
    await expect(page.getByText(/cuenta destino inválida/)).toBeVisible();
    await expect(page.getByText(`indemnizacion-${ID_CASO} (idempotente)`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contactar al asegurado' })).toHaveAttribute('href', 'mailto:carolina.perez@correo.example');
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/evaluacion/o6b-excepcion.png', fullPage: true });

    await page.getByLabel('Cuenta destino').fill('0123-4567-12');
    await page.getByRole('button', { name: 'Reintentar pago' }).click();

    expect(trafico.reintentos).toEqual([
      { destination: { bank_code: '1007', bank_name: 'Banco Aliado', account_type: 'savings', account_number: '0123-4567-12' } },
    ]);
    await expect(page.getByText(/Indemnización pagada/).first()).toBeVisible();
    await expect(page.getByText('Pago reintentado por andres.ruiz@solventa.co')).toBeVisible();
  });
});
