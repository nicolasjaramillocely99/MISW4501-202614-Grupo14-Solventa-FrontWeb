import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  AGOTADA,
  ATENDIDA_SIN_NECESIDAD,
  AVISADA,
  BANDEJA,
  BANDEJA_CON_NUEVA,
  CERRADA_OTRO,
  CON_SUGERENCIA,
  CON_SUGERENCIA_ACTUALIZADA,
  DESPACHADA,
  DESPACHADA_POR_OTRA,
  FILA_CON_GPS,
  HOGAR_CERRADA,
  HOGAR_NUEVA,
  ID_CON_GPS,
  ID_HOGAR,
  ID_SIN_GPS,
  ID_VIAJE,
  NUEVA,
  POLITICA,
  SIN_GPS_EN_LLAMADA,
  UBICADA_POR_VOZ,
  VIAJE,
} from '../../fixtures/asistencias';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { AsistenciasPagina } from '../../paginas/asistencias.pagina';

const BANDEJA_RUTA = '/siniestros/asistencias';
const detalle = (id: string) => `${BANDEJA_RUTA}/${id}`;

/**
 * Atención de solicitudes de asistencia entrantes (HU-W2.3-03). Cognito y el API Gateway se simulan con `page.route` y
 * las teselas de OpenStreetMap se sirven en blanco (sin red); la sesión es la de un analista de operaciones. La
 * sugerencia, la distancia y la llegada estimada las certifica el backend: aquí se verifica que el portal las muestra y
 * envía lo correcto.
 */
test.describe('Atención de solicitudes de asistencia (HU-W2.3-03)', () => {
  test.beforeEach(async ({ page }) => {
    await simularCognito(page);
  });

  test('bandeja: indicadores, aviso sin GPS, filas, mapa y refresco a los 30 s (CA-1)', async ({
    page,
  }) => {
    await page.clock.install();
    const asistencias = new AsistenciasPagina(page);
    const trafico = await asistencias.simularGateway({ bandejas: [BANDEJA, BANDEJA_CON_NUEVA] });
    await asistencias.abrirComo(BANDEJA_RUTA);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Asistencias en sitio' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Asistencias', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const indicadores = page.getByRole('region', { name: 'Indicadores de hoy' });
    await expect(indicadores).toContainText('Nuevas2');
    await expect(indicadores).toContainText('3 min 40 s');
    await expect(page.getByText('Hay 1 solicitud sin ubicación registrada.')).toBeVisible();

    const conGps = asistencias.fila('AST-2026-0001');
    await expect(conGps).toContainText('AU-2026-868766');
    await expect(conGps).toContainText('Autos · IZJ-766');
    await expect(conGps).toContainText('4,7712 N · 74,0452 O · ±8 m');
    await expect(conGps).toContainText(/\d\d:\d\d/);
    await expect(conGps).toContainText('Nueva');
    await expect(asistencias.fila('AST-2026-0002')).toContainText('Sin señal GPS');
    await expect(asistencias.fila('AST-2026-0004')).toContainText('con Diana Torres');
    await expect(asistencias.fila('AST-2026-0003')).toContainText('Cerrada');

    // Las abiertas con coordenadas: la nueva con GPS y la en llamada ubicada por voz.
    await expect(asistencias.mapaBandeja().locator('.mapa-asignacion__marcador')).toHaveCount(2);
    await expect(page.getByText('2 solicitudes abiertas con ubicación')).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/asistencias/o9-bandeja.png', fullPage: true });

    // La siguiente lectura llega sola, sin recargar.
    await page.clock.runFor(30_000);
    await expect(asistencias.fila('AST-2026-0005')).toContainText('Diego Salazar Peña');
    await expect(asistencias.mapaBandeja().locator('.mapa-asignacion__marcador')).toHaveCount(3);
    expect(trafico.lecturasBandeja).toBe(2);

    await page.getByRole('button', { name: 'Actualizar' }).click();
    await expect.poll(() => trafico.lecturasBandeja).toBe(3);
  });

  test('atiende desde la bandeja, registra la necesidad y ve la sugerencia (CA-2)', async ({
    page,
  }) => {
    await page.clock.install();
    const asistencias = new AsistenciasPagina(page);
    const trafico = await asistencias.simularGateway({
      bandejas: [BANDEJA],
      detalles: { [ID_CON_GPS]: [NUEVA] },
      politica: POLITICA,
      tras: { attend: ATENDIDA_SIN_NECESIDAD, need: CON_SUGERENCIA },
    });
    await asistencias.abrirComo(BANDEJA_RUTA);

    await page.getByRole('button', { name: 'Atender AST-2026-0001' }).click();

    await expect(page).toHaveURL(detalle(ID_CON_GPS));
    expect(trafico.escrituras).toEqual([{ accion: 'attend', id: ID_CON_GPS, cuerpo: null }]);
    // El detalle llega con la respuesta de «Atender»: no se vuelve a leer.
    expect(trafico.lecturasDetalle).toBe(0);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Asistencia AST-2026-0001' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Llamada en curso' })).toBeVisible();
    const cronometro = page.getByRole('timer', { name: 'Duración de la llamada' });
    const inicio = await cronometro.textContent();
    await page.clock.runFor(2_000);
    await expect(cronometro).not.toHaveText(inicio ?? '');
    await expect(page.getByText('21/11/2026 16:16:10 Z')).toBeVisible();
    await expect(page.getByText(/4,7712 N · 74,0452 O\s*· precisión 8 m/)).toBeVisible();
    await expect(
      asistencias.mapaDetalle().locator('.mapa-asignacion__marcador--incidente'),
    ).toBeVisible();

    await page.getByRole('combobox', { name: 'Necesidad reportada' }).selectOption('towing');
    await page.getByRole('button', { name: 'Registrar' }).click();

    expect(trafico.escrituras[1]).toEqual({
      accion: 'need',
      id: ID_CON_GPS,
      cuerpo: { need: 'towing' },
    });
    const sugerido = page.getByRole('row', { name: /Grúas Autopista Norte/ });
    await expect(sugerido).toContainText('0,9 km');
    await expect(sugerido).toContainText('12 min');
    await expect(sugerido).toContainText('Sugerido');
    await expect(sugerido).toContainText('2 despachos hoy');
    await expect(page.getByRole('row', { name: /Auxilio Vial Norte/ })).toContainText('2,2 km');
    // Los que no se pueden despachar quedan plegados y sin «Despachar».
    await expect(page.getByRole('button', { name: 'Despachar a Grúas Calle 80' })).toHaveCount(0);
    await page
      .getByText('Otros prestadores con la especialidad (2) · no se pueden despachar')
      .click();
    await expect(page.getByRole('row', { name: /Grúas del Valle/ })).toContainText('297,6 km');
    // En el mapa: el asegurado y los prestadores a 20 km o menos.
    await expect(
      asistencias.mapaDetalle().locator('.mapa-asignacion__marcador--candidato'),
    ).toHaveCount(3);
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/asistencias/o9b-sugerencia.png', fullPage: true });
  });

  test('sin GPS registra la ubicación que dicta el asegurado, con el pin (CA-1, CA-2)', async ({
    page,
  }) => {
    const asistencias = new AsistenciasPagina(page);
    const trafico = await asistencias.simularGateway({
      detalles: { [ID_SIN_GPS]: [SIN_GPS_EN_LLAMADA] },
      politica: POLITICA,
      tras: { 'voice-location': UBICADA_POR_VOZ },
    });
    await asistencias.abrirComo(detalle(ID_SIN_GPS));

    await expect(page.getByText('Sin señal GPS')).toBeVisible();
    await expect(
      page.getByText('Registra la ubicación para ver los prestadores sugeridos.'),
    ).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByLabel('Dirección').fill('Vía Cali–Palmira km 4');
    await asistencias.mapaDetalle().click({ position: { x: 300, y: 140 } });
    await expect(page.getByLabel('Latitud')).toHaveValue(/^-?\d+\.\d{6}$/);
    await expect(
      asistencias.mapaDetalle().locator('.mapa-asignacion__marcador--incidente'),
    ).toBeVisible();

    // La alternativa por teclado: corregir las coordenadas en los campos.
    await page.getByLabel('Latitud').fill('91');
    await page.getByRole('button', { name: 'Guardar ubicación' }).click();
    await expect(page.getByText('La latitud va de −90 a 90.')).toBeVisible();
    expect(trafico.escrituras).toEqual([]);

    await page.getByLabel('Latitud').fill('3.4921');
    await page.getByLabel('Longitud').fill('-76.4203');
    await page.getByRole('button', { name: 'Guardar ubicación' }).click();

    expect(trafico.escrituras).toEqual([
      {
        accion: 'voice-location',
        id: ID_SIN_GPS,
        cuerpo: { address: 'Vía Cali–Palmira km 4', latitude: 3.4921, longitude: -76.4203 },
      },
    ]);
    await expect(page.getByText(/Indicada por voz · registrada por Andrés Ruiz/)).toBeVisible();
    await expect(page.getByRole('row', { name: /Grúas del Valle/ })).toContainText('Sugerido');
    await expect(page.getByRole('button', { name: 'Corregir ubicación' })).toBeVisible();
    // Tras guardar, el mapa deja de ser editable: el pin «por voz» y el prestador sugerido de Palmira.
    await expect(
      asistencias.mapaDetalle().locator('.mapa-asignacion__marcador--incidente'),
    ).toContainText('Asegurado · por voz');
    await expect(
      asistencias.mapaDetalle().locator('.mapa-asignacion__marcador--candidato'),
    ).toHaveText(['Grúas del Valle · 1,9 km']);
  });

  test('despacha al sugerido tras confirmar y sigue el aviso al prestador (CA-3)', async ({
    page,
  }) => {
    await page.clock.install();
    const asistencias = new AsistenciasPagina(page);
    const trafico = await asistencias.simularGateway({
      detalles: { [ID_CON_GPS]: [CON_SUGERENCIA] },
      politica: POLITICA,
      tras: { dispatch: DESPACHADA },
    });
    await asistencias.abrirComo(detalle(ID_CON_GPS));

    await page.getByRole('button', { name: 'Despachar prestador sugerido' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(
      dialogo.getByRole('heading', { name: '¿Despachar a Grúas Autopista Norte?' }),
    ).toBeVisible();
    await expect(dialogo).toContainText('4,7712 N · 74,0452 O · precisión 8 m');
    await verificarAccesibilidad(page);
    await dialogo.getByRole('button', { name: 'Confirmar despacho' }).click();

    expect(trafico.escrituras).toEqual([
      { accion: 'dispatch', id: ID_CON_GPS, cuerpo: { provider_id: 'prv-gruas-autopista-norte' } },
    ]);
    await expect(page.getByRole('heading', { name: 'Prestador despachado' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'despachos@gruasautopistanorte.example.com' }),
    ).toHaveAttribute('href', 'mailto:despachos@gruasautopistanorte.example.com');
    await expect(page.getByText(/\d\d\/\d\d\/2026, \d\d:\d\d por Andrés Ruiz/)).toBeVisible();
    await expect(page.getByText('Enviando el despacho al prestador…')).toBeVisible();
    await expect(page.getByRole('button', { name: /Despachar|Cerrar solicitud/ })).toHaveCount(0);

    // El backend envía el correo; la página vuelve a leer la solicitud cada 5 s mientras está pendiente.
    await asistencias.simularGateway({ detalles: { [ID_CON_GPS]: [AVISADA] }, politica: POLITICA });
    await page.clock.runFor(5_000);
    await expect(page.getByText(/Aviso enviado al prestador · \d\d:\d\d/)).toBeVisible();
    await expect(page.getByText(/Andrés Ruiz despachó a Grúas Autopista Norte/)).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/asistencias/o9b-despachada.png', fullPage: true });

    // En la bandeja ya figura como despachada.
    await asistencias.simularGateway({
      bandejas: [
        {
          ...BANDEJA,
          items: [{ ...FILA_CON_GPS, status: 'dispatched', dispatched_at: '2026-11-21T16:17:30Z' }],
        },
      ],
    });
    await page.getByRole('link', { name: 'Asistencias' }).first().click();
    await expect(asistencias.fila('AST-2026-0001')).toContainText('Despachada');
    await expect(page.getByRole('link', { name: 'Ver AST-2026-0001' })).toBeVisible();
  });

  test.describe('cierre por otro medio (CA-4)', () => {
    test('en llamada: motivo obligatorio y nota obligatoria con «Otro»', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      const trafico = await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [CON_SUGERENCIA] },
        politica: POLITICA,
        tras: { close: CERRADA_OTRO },
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await asistencias.cerrarSolicitud();
      await expect(page.getByRole('combobox', { name: 'Motivo de la resolución' })).toBeFocused();
      await expect(page.getByText('Elige el motivo de la resolución.')).toBeVisible();

      await page.getByRole('combobox', { name: 'Motivo de la resolución' }).selectOption('other');
      await asistencias.cerrarSolicitud();
      await expect(page.getByText('Escribe una nota: es obligatoria con «Otro».')).toBeVisible();
      expect(trafico.escrituras).toEqual([]);
      await verificarAccesibilidad(page);

      await page
        .getByRole('textbox', { name: /^Nota/ })
        .fill('El asegurado consiguió quien le pasara corriente');
      await asistencias.cerrarSolicitud();

      expect(trafico.escrituras).toEqual([
        {
          accion: 'close',
          id: ID_CON_GPS,
          cuerpo: { reason: 'other', note: 'El asegurado consiguió quien le pasara corriente' },
        },
      ]);
      const cerrada = page.locator('section', {
        has: page.getByRole('heading', { name: 'Solicitud cerrada' }),
      });
      await expect(cerrada).toContainText('Otro');
      await expect(cerrada).toContainText('El asegurado consiguió quien le pasara corriente');
      await expect(cerrada).toContainText('por Andrés Ruiz');
      await expect(page.getByRole('heading', { name: 'Prestadores cercanos' })).toHaveCount(0);
      await verificarAccesibilidad(page);
    });

    test('desde una nueva, sin atenderla, con «Resuelto durante la llamada»', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      const trafico = await asistencias.simularGateway({
        detalles: { [ID_HOGAR]: [HOGAR_NUEVA] },
        politica: POLITICA,
        tras: { close: HOGAR_CERRADA },
      });
      await asistencias.abrirComo(detalle(ID_HOGAR));

      await expect(page.getByRole('heading', { name: 'Llamada entrante' })).toBeVisible();
      await page
        .getByRole('combobox', { name: 'Motivo de la resolución' })
        .selectOption('resolved_by_phone');
      await asistencias.cerrarSolicitud();

      expect(trafico.escrituras).toEqual([
        { accion: 'close', id: ID_HOGAR, cuerpo: { reason: 'resolved_by_phone' } },
      ]);
      await expect(page.getByText('Resuelto durante la llamada').first()).toBeVisible();
      await expect(
        page.getByText(/Andrés Ruiz cerró la solicitud: Resuelto durante la llamada/),
      ).toBeVisible();
      expect(trafico.escrituras.some((e) => e.accion === 'dispatch')).toBe(false);
    });
  });

  test.describe('conflictos entre analistas (CA-3, CA-5)', () => {
    test('otro analista la despachó: avisa y muestra su despacho y la toma en el historial', async ({
      page,
    }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [CON_SUGERENCIA, DESPACHADA_POR_OTRA] },
        politica: POLITICA,
        tras: { dispatch: { status: 409, error: 'assistance_not_open' } },
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await page.getByRole('button', { name: 'Despachar a Auxilio Vial Norte' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar despacho' }).click();

      await expect(page.getByRole('alert')).toHaveText(
        'Otro analista ya despachó o cerró esta solicitud. La vista se actualizó.',
      );
      await expect(page.getByRole('heading', { name: 'Prestador despachado' })).toBeVisible();
      await expect(page.getByText(/por Diana Torres/).first()).toBeVisible();
      const historial = page.getByRole('list').filter({ hasText: 'atendió la solicitud' });
      await expect(historial.getByRole('listitem')).toHaveText([
        /Andrés Ruiz atendió la solicitud/,
        /Andrés Ruiz registró la necesidad Grúa/,
        /Diana Torres tomó la solicitud de andres\.ruiz@solventa\.co/,
        /Diana Torres despachó a Auxilio Vial Norte/,
      ]);
      await verificarAccesibilidad(page);
    });

    test('el prestador dejó de estar disponible: avisa y muestra la sugerencia actualizada', async ({
      page,
    }) => {
      const asistencias = new AsistenciasPagina(page);
      const trafico = await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [CON_SUGERENCIA, CON_SUGERENCIA_ACTUALIZADA] },
        politica: POLITICA,
        tras: { dispatch: { status: 422, error: 'provider_not_eligible' } },
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await page.getByRole('button', { name: 'Despachar prestador sugerido' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar despacho' }).click();

      await expect(page.getByRole('alert')).toHaveText(
        'Ese prestador ya no está disponible: revisa la sugerencia actualizada.',
      );
      await expect(page.getByRole('row', { name: /Auxilio Vial Norte/ })).toContainText('Sugerido');
      await expect(
        page.getByRole('button', { name: 'Despachar a Grúas Autopista Norte' }),
      ).toHaveCount(0);
      expect(trafico.lecturasDetalle).toBe(2);
    });

    test('si la solicitud volvió a estar sin atender, pide atenderla', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [CON_SUGERENCIA, NUEVA] },
        politica: POLITICA,
        tras: { dispatch: { status: 409, error: 'assistance_not_attended' } },
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await page.getByRole('button', { name: 'Despachar prestador sugerido' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar despacho' }).click();

      await expect(page.getByRole('alert')).toHaveText(
        'Atiende la solicitud antes de continuar. La vista se actualizó.',
      );
      await expect(page.getByRole('button', { name: 'Atender' })).toBeVisible();
    });
  });

  test('sin prestador disponible: cierra como «Sin prestador disponible»', async ({ page }) => {
    const asistencias = new AsistenciasPagina(page);
    await asistencias.simularGateway({
      detalles: { [ID_CON_GPS]: [AGOTADA] },
      politica: POLITICA,
    });
    await asistencias.abrirComo(detalle(ID_CON_GPS));

    await expect(page.getByText('No hay prestadores disponibles a 20 km o menos')).toBeVisible();
    await expect(page.getByText('5 km · 0 disponibles')).toBeVisible();
    await expect(page.getByText('20 km · 0 disponibles')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Despachar prestador sugerido' })).toBeDisabled();
    await expect(page.getByText('No hay un prestador disponible para despachar.')).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('button', { name: 'Cerrar como «Sin prestador disponible»' }).click();

    const motivo = page.getByRole('combobox', { name: 'Motivo de la resolución' });
    await expect(motivo).toHaveValue('no_provider_available');
    await expect(motivo).toBeFocused();
  });

  test('póliza de Viaje: sin asistencia en sitio', async ({ page }) => {
    const asistencias = new AsistenciasPagina(page);
    await asistencias.simularGateway({ detalles: { [ID_VIAJE]: [VIAJE] }, politica: POLITICA });
    await asistencias.abrirComo(detalle(ID_VIAJE));

    await expect(
      page.getByText('Sin asistencia en sitio para esta póliza: ciérrala con un motivo.'),
    ).toBeVisible();
    await expect(page.getByText('Objeto asegurado')).toBeVisible();
  });

  test.describe('roles', () => {
    for (const rol of ['asegurado', 'asesor'] as const) {
      test(`el rol ${rol} no entra a la bandeja ni al detalle`, async ({ page }) => {
        const asistencias = new AsistenciasPagina(page);
        await asistencias.simularGateway({ bandejas: [BANDEJA] });
        await asistencias.abrirComo(BANDEJA_RUTA, rol);
        await expect(page).toHaveURL('/acceso/no-autorizado');

        await page.goto(detalle(ID_CON_GPS));
        await expect(page).toHaveURL('/acceso/no-autorizado');
      });
    }

    test('un 403 del gateway lleva a «acceso no autorizado»', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({ bandejas: [{ status: 403, error: 'forbidden' }] });
      await asistencias.abrirComo(BANDEJA_RUTA);

      await expect(page).toHaveURL('/acceso/no-autorizado');
    });
  });

  test.describe('resiliencia', () => {
    test('503 al entrar a la bandeja → «Reintentar»', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        bandejas: [{ status: 503, error: 'assistance_unavailable' }, BANDEJA],
      });
      await asistencias.abrirComo(BANDEJA_RUTA);

      await expect(page.getByText('No pudimos cargar las solicitudes de asistencia')).toBeVisible();
      await verificarAccesibilidad(page);
      await page.getByRole('button', { name: 'Reintentar' }).click();
      await expect(asistencias.fila('AST-2026-0001')).toBeVisible();
    });

    test('503 en un refresco: la tabla sigue y lo avisa', async ({ page }) => {
      await page.clock.install();
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        bandejas: [BANDEJA, { status: 503, error: 'assistance_unavailable' }],
      });
      await asistencias.abrirComo(BANDEJA_RUTA);
      await expect(asistencias.fila('AST-2026-0001')).toBeVisible();

      await page.clock.runFor(30_000);

      await expect(
        page.getByText('No pudimos actualizar la bandeja; se muestra la última lectura.'),
      ).toBeVisible();
      await expect(asistencias.fila('AST-2026-0001')).toBeVisible();
    });

    test('503 de la política: la necesidad ofrece reintentar y el cierre sigue', async ({
      page,
    }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [ATENDIDA_SIN_NECESIDAD] },
        politica: { status: 503, error: 'assistance_unavailable' },
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await expect(page.getByText('No pudimos cargar las necesidades.')).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Motivo de la resolución' }).locator('option'),
      ).toHaveCount(7);

      await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [ATENDIDA_SIN_NECESIDAD] },
        politica: POLITICA,
      });
      await page.getByRole('button', { name: 'Reintentar' }).click();
      await expect(page.getByRole('combobox', { name: 'Necesidad reportada' })).toBeVisible();
    });

    test('sin teselas del mapa, el detalle sigue usable', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [CON_SUGERENCIA] },
        politica: POLITICA,
        sinTeselas: true,
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await expect(asistencias.mapaDetalle()).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Despachar prestador sugerido' }),
      ).toBeEnabled();
    });

    test('solicitud inexistente → «No encontramos esta solicitud»', async ({ page }) => {
      const asistencias = new AsistenciasPagina(page);
      await asistencias.simularGateway({
        detalles: { [ID_CON_GPS]: [{ status: 404, error: 'assistance_request_not_found' }] },
        politica: POLITICA,
      });
      await asistencias.abrirComo(detalle(ID_CON_GPS));

      await expect(
        page.getByRole('heading', { name: 'No encontramos esta solicitud' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Volver a asistencias' })).toBeVisible();
    });
  });
});
