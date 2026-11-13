import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { PolizasPorVencerPagina } from '../../paginas/polizas-por-vencer.pagina';

/**
 * Pólizas próximas a vencer del asesor (HU-W1.5-01, pantalla S6): la entrada de la renovación asistida (HU-W1.5-03).
 * Cognito y el API Gateway se simulan con `page.route`; la sesión es la de un asesor comercial. El gateway simulado
 * aplica el rango por defecto 16/09/2026 → 16/10/2026 (ventana de 30 días) y filtra por rango y estado.
 */
test.describe('Pólizas próximas a vencer del asesor (HU-W1.5-01)', () => {
  test('el asesor ve las pólizas por vencer con su vencimiento y estado (CA-1)', async ({ page }) => {
    await simularCognito(page);
    const s6 = new PolizasPorVencerPagina(page);
    const consultas = await s6.simularListado();

    await s6.abrirComo('/originacion/renovaciones');

    await expect(s6.titulo).toHaveText('Renovaciones');
    await expect(s6.tarjeta).toContainText('Vencen en 30 días');
    await expect(s6.tarjeta).toContainText('12');
    await expect(s6.desde).toHaveValue('2026-09-16');
    await expect(s6.hasta).toHaveValue('2026-10-16');
    await expect(s6.estado).toHaveValue('');
    await expect(s6.conteo).toHaveText('4 resultados');
    await expect(s6.filas).toHaveCount(4);
    const segunda = s6.filas.nth(1);
    await expect(segunda).toContainText('pol-acc-118204');
    await expect(segunda).toContainText('Carolina Pérez Ruiz');
    await expect(segunda).toContainText('1.020.345.678');
    await expect(segunda).toContainText('Vida');
    await expect(segunda).toContainText('02/10/2026');
    await expect(segunda).toContainText(/142\.300\sCOP/);
    await expect(segunda).toContainText('Por vencer');
    await expect(s6.filas.nth(2)).toContainText('Renovación en curso');
    await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Renovaciones' })).toBeVisible();
    expect(consultas[0].toString()).toBe('page=1&page_size=20');
    await verificarAccesibilidad(page);
  });

  test('filtra por rango de vencimiento y la URL conserva el filtro (CA-2)', async ({ page }) => {
    await simularCognito(page);
    const s6 = new PolizasPorVencerPagina(page);
    const consultas = await s6.simularListado();
    await s6.abrirComo('/originacion/renovaciones');
    await expect(s6.filas).toHaveCount(4);

    await s6.hasta.fill('2026-11-16');
    await expect(page).toHaveURL('/originacion/renovaciones?desde=2026-09-16&hasta=2026-11-16');
    await expect(s6.conteo).toHaveText('5 resultados');
    expect(consultas.at(-1)?.toString()).toBe('page=1&page_size=20&expires_from=2026-09-16&expires_to=2026-11-16');
    // La que vence más adelante sale sin «Renovar», con la fecha en que abre su ventana (D-5 a).
    const ultima = s6.filas.nth(4);
    await expect(ultima).toContainText('pol-acc-004512');
    await expect(ultima).toContainText('Renovable desde el 16/10/2026');
    await expect(ultima.getByRole('link')).toHaveCount(0);

    await s6.desde.fill('2026-10-02');
    await expect(page).toHaveURL('/originacion/renovaciones?desde=2026-10-02&hasta=2026-11-16');
    await expect(s6.conteo).toHaveText('4 resultados');
    await expect(s6.filas.first()).toContainText('pol-acc-118204');

    await s6.estado.selectOption('renewal_in_progress');
    await expect(page).toHaveURL('/originacion/renovaciones?desde=2026-10-02&hasta=2026-11-16&estado=renewal_in_progress');
    await expect(s6.conteo).toHaveText('1 resultado');

    // Recargar mantiene el filtro.
    await page.reload();
    await expect(s6.filas).toHaveCount(1);
    await expect(s6.desde).toHaveValue('2026-10-02');
    await expect(s6.estado).toHaveValue('renewal_in_progress');
    expect(consultas.at(-1)?.toString()).toBe(
      'page=1&page_size=20&expires_from=2026-10-02&expires_to=2026-11-16&status=renewal_in_progress',
    );
    await verificarAccesibilidad(page);
  });

  test('un rango sin pólizas muestra el estado vacío sin errores y «Limpiar filtros» vuelve al rango por defecto (CA-3)', async ({
    page,
  }) => {
    await simularCognito(page);
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') {
        errores.push(mensaje.text());
      }
    });
    const s6 = new PolizasPorVencerPagina(page);
    const consultas = await s6.simularListado();

    await s6.abrirComo('/originacion/renovaciones?desde=2026-12-01&hasta=2026-12-15');

    await expect(page.getByRole('heading', { name: 'Sin pólizas por vencer en el rango' })).toBeVisible();
    await expect(page.getByText('No hay pólizas que venzan entre el 01/12/2026 y el 15/12/2026 con el estado Todos.')).toBeVisible();
    await expect(s6.conteo).toHaveText('0 resultados');
    await expect(s6.tabla.getByRole('columnheader')).toHaveCount(7);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await verificarAccesibilidad(page);

    await s6.limpiarFiltros.click();
    await expect(page).toHaveURL('/originacion/renovaciones');
    await expect(s6.filas).toHaveCount(4);
    await expect(s6.desde).toHaveValue('2026-09-16');
    expect(consultas.at(-1)?.toString()).toBe('page=1&page_size=20');
    expect(errores).toEqual([]);
  });

  test('«Renovar» y «Ver» llevan a la renovación asistida de la póliza (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const s6 = new PolizasPorVencerPagina(page);
    await s6.simularListado();
    await s6.abrirComo('/originacion/renovaciones');

    await expect(s6.renovar('pol-acc-118204')).toHaveAttribute('href', '/originacion/renovaciones/pol-acc-118204');
    await expect(s6.renovar('pol-acc-118204')).toHaveText('Renovar');
    await expect(s6.ver('pol-acc-771003')).toHaveAttribute('href', '/originacion/renovaciones/pol-acc-771003');
    await expect(s6.ver('pol-acc-771003')).toHaveText('Ver');
    await expect(s6.renovar('pol-acc-771003')).toHaveCount(0);
  });

  test('un 503 muestra el error con «Reintentar» y un rango al revés se avisa sin consultar', async ({ page }) => {
    await simularCognito(page);
    const s6 = new PolizasPorVencerPagina(page);
    const consultas = await s6.simularListado([
      { estado: 503, cuerpo: { error: 'renewal_unavailable', message: 'the policies could not be listed; retry later' } },
    ]);
    await s6.abrirComo('/originacion/renovaciones');

    await expect(page.getByRole('alert')).toContainText('No pudimos cargar las pólizas próximas a vencer');
    await verificarAccesibilidad(page);
    await s6.reintentar.click();
    await expect(s6.filas).toHaveCount(4);
    expect(consultas).toHaveLength(2);

    await s6.hasta.fill('2026-09-01');
    await expect(page.getByRole('alert')).toContainText('«Hasta» no puede ser anterior a «Vencen desde».');
    await expect(s6.tabla).toHaveCount(0);
    expect(consultas).toHaveLength(2);
    await verificarAccesibilidad(page);
  });

  test('el asegurado no entra a «Renovaciones»', async ({ page }) => {
    await simularCognito(page);
    const s6 = new PolizasPorVencerPagina(page);
    const consultas = await s6.simularListado();

    await s6.abrirComo('/originacion/renovaciones', 'asegurado');

    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);
    expect(consultas).toHaveLength(0);
  });
});
