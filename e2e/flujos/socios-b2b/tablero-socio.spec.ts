import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { TableroSocioPagina } from '../../paginas/tablero-socio.pagina';

/**
 * Tablero de integración del socio (HU-W3.2-01): B1 con sus rangos y el estado sin datos. Cognito y el API Gateway se
 * simulan con `page.route`; la sesión es la del socio «Banco Aliado». El reloj del navegador queda en el 16/09/2026,
 * 22:30 de Colombia (en UTC ya es el 17), para que los rangos sean fijos.
 */
test.describe('Tablero de integración del socio (HU-W3.2-01)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-17T03:30:00Z') });
    await simularCognito(page);
  });

  test('muestra cotizaciones, pólizas y conversión y cambia de rango (CA-1, CA-2, CA-4)', async ({ page }) => {
    const tablero = new TableroSocioPagina(page);
    const consultas = await tablero.simular({
      '2026-08-18..2026-09-16': { cotizaciones: 12480, polizas: 1872, conversion: 15 },
      '2026-09-10..2026-09-16': { cotizaciones: 3100, polizas: 508, conversion: 16.4 },
      '2026-09-01..2026-09-15': { cotizaciones: 6000, polizas: 900, conversion: 15 },
    });

    await tablero.abrirComoSocio();

    await expect(tablero.titulo).toHaveText('Tablero de integración');
    await expect(tablero.subtitulo).toContainText('Banco Aliado · últimos 30 días (18/08 a 16/09/2026)');
    await expect(tablero.cotizaciones).toContainText('12.480');
    await expect(tablero.polizas).toContainText('1.872');
    await expect(tablero.conversion).toContainText('15 %');
    await expect(tablero.aislamiento).toContainText('exclusivamente las cotizaciones y pólizas de Banco Aliado');
    await verificarAccesibilidad(page);

    await tablero.rango('Últimos 7 días').click();
    await expect(tablero.cotizaciones).toContainText('3.100');
    await expect(tablero.conversion).toContainText('16,4 %');
    await expect(tablero.rango('Últimos 7 días')).toHaveAttribute('aria-pressed', 'true');

    await tablero.rango('Personalizado').click();
    await tablero.formularioPersonalizado.getByLabel('Fecha inicial').fill('2026-09-01');
    await tablero.formularioPersonalizado.getByLabel('Fecha final').fill('2026-09-15');
    await tablero.formularioPersonalizado.getByRole('button', { name: 'Aplicar' }).click();
    await expect(tablero.subtitulo).toContainText('rango personalizado (01/09 a 15/09/2026)');
    await expect(tablero.cotizaciones).toContainText('6.000');

    for (const consulta of consultas) {
      expect([...consulta.keys()].sort()).toEqual(['from', 'to']);
    }
  });

  test('no deja aplicar una fecha inicial posterior a la final (CA-2)', async ({ page }) => {
    const tablero = new TableroSocioPagina(page);
    const consultas = await tablero.simular({});
    await tablero.abrirComoSocio();
    await expect(tablero.cotizaciones).toBeVisible();
    const antes = consultas.length;

    await tablero.rango('Personalizado').click();
    await tablero.formularioPersonalizado.getByLabel('Fecha inicial').fill('2026-09-16');
    await tablero.formularioPersonalizado.getByLabel('Fecha final').fill('2026-09-15');
    await tablero.formularioPersonalizado.getByRole('button', { name: 'Aplicar' }).click();

    await expect(page.getByRole('alert')).toHaveText('La fecha inicial no puede ser posterior a la fecha final.');
    await verificarAccesibilidad(page);
    expect(consultas.length).toBe(antes);
  });

  test('un rango sin datos muestra 0 sin errores y ofrece ampliar el rango (CA-3)', async ({ page }) => {
    const tablero = new TableroSocioPagina(page);
    await tablero.simular({ '2026-09-10..2026-09-16': { cotizaciones: 40, polizas: 6, conversion: 15 } });
    await tablero.abrirComoSocio();

    await tablero.rango('Hoy').click();

    await expect(tablero.subtitulo).toContainText('Banco Aliado · hoy 16/09/2026');
    await expect(tablero.cotizaciones).toContainText('Sin solicitudes en el rango');
    await expect(tablero.polizas).toContainText('Sin emisiones en el rango');
    await expect(tablero.conversion).toContainText('0 %');
    await expect(tablero.vacio).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await verificarAccesibilidad(page);

    await page.getByRole('button', { name: 'Ver últimos 7 días' }).click();
    await expect(tablero.cotizaciones).toContainText('40');
    await expect(tablero.vacio).toBeHidden();
  });
});
