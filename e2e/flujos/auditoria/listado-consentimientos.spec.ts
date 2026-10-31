import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { CONSENTIMIENTO_ID as ID, activo, errorHttp, ok } from '../../fixtures/consentimientos';
import { FILAS, fila, pagina, respuesta, revocadaDesdeApp, sinResultados } from '../../fixtures/listado-consentimientos';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { DetalleConsentimientoPagina } from '../../paginas/detalle-consentimiento.pagina';
import { ListadoConsentimientosPagina } from '../../paginas/listado-consentimientos.pagina';

/**
 * Listado de consentimientos de Open Finance para cumplimiento (HU-W4.2-01): O14 / O14b y el detalle O15 completo.
 * Cognito y el API Gateway se simulan con `page.route`; la sesión es la de un analista de operaciones.
 */
test.describe('Listado de consentimientos para cumplimiento (HU-W4.2-01)', () => {
  test('muestra la tabla paginada con indicadores y filtros (CA-1)', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const consultas = await listado.simularListado();

    await new DetalleConsentimientoPagina(page).abrirComo('/auditoria/consentimientos');

    await expect(listado.titulo).toHaveText('Consentimientos Open Finance');
    await expect(listado.indicadores).toContainText('1.284');
    await expect(listado.indicadores).toContainText('12 desde la app · 25 desde el portal');
    await expect(listado.filas).toHaveCount(6);
    const primera = listado.filas.first();
    await expect(primera).toContainText('Ana María Pérez');
    await expect(primera).toContainText(`******4050 · ${ID}`);
    await expect(primera).toContainText('20/10/2026, 10:00');
    await expect(primera).toContainText('20/10/2027');
    await expect(primera).toContainText('Activo');
    await expect(primera).toContainText('productos de crédito · saldos');
    await expect(listado.filas.nth(3)).toContainText('Revocado 10/09');
    await expect(listado.filas.nth(4)).toContainText('Vencido');
    await expect(listado.conteo).toHaveText(/1 a 6 de 1\.433 registros · página 1 de 239 · el filtro se conserva al navegar/);
    await expect(listado.anterior).toBeDisabled();
    expect(consultas[0].toString()).toBe('page=1&page_size=6');
    await verificarAccesibilidad(page);
  });

  test('filtra por estado y fechas y pagina sin perder el filtro (CA-2)', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const consultas = await listado.simularListado();
    await new DetalleConsentimientoPagina(page).abrirComo('/auditoria/consentimientos');
    await expect(listado.filas).toHaveCount(6);

    await listado.estado.selectOption('revoked');
    await expect(page).toHaveURL('/auditoria/consentimientos?estado=revoked');
    await listado.desde.fill('2026-09-01');
    await expect(page).toHaveURL('/auditoria/consentimientos?estado=revoked&desde=2026-09-01');
    await listado.hasta.fill('2026-09-16');
    await expect(page).toHaveURL('/auditoria/consentimientos?estado=revoked&desde=2026-09-01&hasta=2026-09-16');
    expect(consultas.at(-1)?.toString()).toBe('page=1&page_size=6&status=revoked&granted_from=2026-09-01&granted_to=2026-09-16');

    await listado.siguiente.click();
    await expect(page).toHaveURL('/auditoria/consentimientos?estado=revoked&desde=2026-09-01&hasta=2026-09-16&pagina=2');
    expect(consultas.at(-1)?.toString()).toBe('page=2&page_size=6&status=revoked&granted_from=2026-09-01&granted_to=2026-09-16');

    // Recargar mantiene el filtro y la página.
    const antes = consultas.length;
    await page.reload();
    await expect(listado.filas).toHaveCount(6);
    expect(consultas.length).toBeGreaterThan(antes);
    expect(consultas.at(-1)?.toString()).toBe('page=2&page_size=6&status=revoked&granted_from=2026-09-01&granted_to=2026-09-16');
    await expect(listado.estado).toHaveValue('revoked');
    await expect(listado.desde).toHaveValue('2026-09-01');

    // Un rango al revés se avisa en «Hasta» y no se consulta.
    const sinRango = consultas.length;
    await listado.hasta.fill('2026-08-01');
    await expect(page.getByRole('alert')).toContainText('«Hasta» no puede ser anterior a «Otorgado desde».');
    expect(consultas.length).toBe(sinRango);
    await verificarAccesibilidad(page);

    // La búsqueda del cliente viaja como q.
    await listado.hasta.fill('2026-09-16');
    await listado.cliente.fill('nunez');
    await listado.cliente.press('Enter');
    await expect(page).toHaveURL(/cliente=nunez/);
    expect(consultas.at(-1)?.get('q')).toBe('nunez');
    expect(consultas.at(-1)?.get('page')).toBe('1');
  });

  test('sin resultados muestra el mensaje con el filtro y «Limpiar filtros», sin errores (CA-3)', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') {
        errores.push(mensaje.text());
      }
    });
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const consultas = await listado.simularListado([respuesta(sinResultados()), respuesta(pagina())]);

    await new DetalleConsentimientoPagina(page).abrirComo(
      '/auditoria/consentimientos?estado=revoked&desde=2026-09-01&hasta=2026-09-16&entidad=cooperativa-andina&cliente=Rojas',
    );

    await expect(page.getByRole('heading', { name: 'Sin consentimientos para el filtro aplicado' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      'No hay consentimientos de Cooperativa Andina en estado Revocado, otorgados entre el 01/09/2026 y el 16/09/2026, para el cliente buscado.',
    );
    await expect(listado.conteo).toHaveText(/0 registros · página 1 de 1/);
    await expect(listado.anterior).toBeDisabled();
    await expect(listado.siguiente).toBeDisabled();
    await expect(listado.indicadores).toContainText('1.284');
    await verificarAccesibilidad(page);

    await listado.limpiarFiltros.click();
    await expect(page).toHaveURL('/auditoria/consentimientos');
    await expect(listado.filas).toHaveCount(6);
    expect(consultas.at(-1)?.toString()).toBe('page=1&page_size=6');
    expect(errores).toEqual([]);
  });

  test('abre el detalle completo y «Volver» regresa con el filtro (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await listado.simularListado();
    await detalle.simularGateway({ lecturas: [ok(activo())] });
    await detalle.abrirComo('/auditoria/consentimientos?estado=active&pagina=2');
    await expect(listado.filas).toHaveCount(6);

    await listado.ver(ID).click();

    await expect(page).toHaveURL(`/auditoria/consentimientos/${ID}`);
    await expect(page.getByText(/otorgado el 20\/10\/2026, 10:00 en el flujo embebido \(Banco Aliado\) · vence el 20\/10\/2027/)).toBeVisible();
    const datos = page.getByRole('region', { name: 'Datos del cliente y del consentimiento' });
    await expect(datos).toContainText('Embebido · Banco Aliado');
    await expect(datos).toContainText('Registro inmutable · términos v1');
    await expect(datos).toContainText('Perfil de riesgo y oferta de seguro de vida hipotecario');
    await expect(datos).toContainText('20/10/2026 → 20/10/2027');
    await expect(page.getByRole('region', { name: 'Alcance detallado' })).toBeVisible();
    await expect(detalle.entidades).toContainText('Datos autorizados');
    await expect(page.getByRole('region', { name: 'Historial de estados' })).toContainText('canal Banco Aliado (flujo embebido)');
    await verificarAccesibilidad(page);

    await page.getByRole('main').getByRole('link', { name: 'Consentimientos' }).click();
    await expect(page).toHaveURL('/auditoria/consentimientos?estado=active&pagina=2');
  });

  test('muestra el estado que el servidor tiene en la siguiente consulta (CA-5)', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const despues = [revocadaDesdeApp(ID, 'Ana María Pérez'), ...FILAS.slice(1)];
    await listado.simularListado([
      respuesta(pagina()),
      respuesta(pagina({ items: despues, indicadores: { active: 1283, revoked_last_30_days: { total: 38, mobile_app: 13, compliance_portal: 25 } } })),
    ]);
    await new DetalleConsentimientoPagina(page).abrirComo('/auditoria/consentimientos');
    await expect(listado.filas.first()).toContainText('Activo');

    // El asegurado revocó desde la app: la siguiente consulta lo trae revocado.
    await page.reload();

    await expect(listado.filas.first()).toContainText('Revocado 10/09');
    await expect(listado.indicadores).toContainText('13 desde la app · 25 desde el portal');
    await expect(listado.indicadores).toContainText('1.283');
  });

  test('un 503 muestra el error con «Reintentar»', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    await listado.simularListado([errorHttp(503, 'service_unavailable'), respuesta(pagina())]);

    await new DetalleConsentimientoPagina(page).abrirComo('/auditoria/consentimientos');

    await expect(page.getByRole('alert')).toContainText('El servicio de auditoría no respondió');
    await verificarAccesibilidad(page);
    await listado.reintentar.click();
    await expect(listado.filas).toHaveCount(6);
  });

  test('solo el analista de operaciones entra al listado (CA-6)', async ({ page }) => {
    for (const rol of ['asesor', 'asegurado'] as const) {
      const otra = await page.context().newPage();
      await simularCognito(otra);
      const consultas = await new ListadoConsentimientosPagina(otra).simularListado();
      await new DetalleConsentimientoPagina(otra).abrirComo('/auditoria/consentimientos', rol);
      await expect(otra).toHaveURL(/\/acceso\/no-autorizado/);
      expect(consultas).toEqual([]);
      await otra.close();
    }

    await simularCognito(page);
    await new ListadoConsentimientosPagina(page).simularListado([errorHttp(403, 'forbidden')]);
    await new DetalleConsentimientoPagina(page).abrirComo('/auditoria/consentimientos');
    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);
  });

  test('una fila revocada desde el portal lleva su fecha y el estado parcial se distingue con texto', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    await listado.simularListado([respuesta(pagina({ items: [fila('cns-1', 'Uno'), FILAS[5]], total: 2, totalPaginas: 1 }))]);

    await new DetalleConsentimientoPagina(page).abrirComo('/auditoria/consentimientos');

    await expect(listado.filas).toHaveCount(2);
    await expect(listado.filas.nth(1)).toContainText('Revocación parcial');
    await expect(listado.conteo).toHaveText(/1 a 2 de 2 registros · página 1 de 1/);
    await expect(listado.siguiente).toBeDisabled();
  });
});
