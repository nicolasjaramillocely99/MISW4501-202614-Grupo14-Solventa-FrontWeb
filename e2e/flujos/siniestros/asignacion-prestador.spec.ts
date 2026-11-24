import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  ASIGNADA,
  AVISADA,
  ID_CASO,
  LISTA,
  PENDIENTE,
  POLITICA,
  PROPUESTA,
  PROPUESTA_AMPLIADA,
  SIN_UBICACION,
  SIN_VISITA,
  UBICADA_POR_ANALISTA,
} from '../../fixtures/asignacion';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { AsignacionPrestadorPagina } from '../../paginas/asignacion-prestador.pagina';

const RUTA = `/siniestros/${ID_CASO}/asignar-prestador`;

/**
 * Asignación del prestador más cercano (HU-W2.3-01). Cognito y el API Gateway se simulan con `page.route` y las teselas
 * de OpenStreetMap se sirven en blanco (sin red); la sesión es la de un analista de operaciones. La distancia, la
 * elegibilidad y el sugerido los certifica el backend: aquí se verifica que el portal los muestra y envía lo correcto.
 */
test.describe('Asignación del prestador más cercano (HU-W2.3-01)', () => {
  test.beforeEach(async ({ page }) => {
    await simularCognito(page);
  });

  test('desde O6 abre la asignación con las coordenadas de la app (CA-1)', async ({ page }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    await asignacion.simularGateway({ lecturas: [LISTA], politica: POLITICA });
    await asignacion.abrirComo(`/siniestros/${ID_CASO}/evaluar`);

    await page.getByRole('link', { name: 'Asignar prestador' }).click();

    await expect(page).toHaveURL(RUTA);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Asignar prestador · SIN-2026-01655' }),
    ).toBeVisible();
    await expect(page.getByText('4,6771 N · 74,0483 O')).toBeVisible();
    await expect(page.getByText('Capturadas desde la app · precisión 8 m')).toBeVisible();
    await expect(asignacion.mapa().locator('.mapa-asignacion__marcador--incidente')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Siniestro SIN-2026-01655' })).toHaveAttribute(
      'href',
      `/siniestros/${ID_CASO}/evaluar`,
    );
    await verificarAccesibilidad(page);
  });

  test('sin coordenadas, ubica el incidente con el pin y la dirección (CA-1)', async ({ page }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    const trafico = await asignacion.simularGateway({
      lecturas: [SIN_UBICACION],
      politica: POLITICA,
      trasUbicar: UBICADA_POR_ANALISTA,
    });
    await asignacion.abrirComo(RUTA);

    await expect(page.getByRole('heading', { name: 'Ubicación del incidente' })).toBeVisible();
    await expect(page.getByText('Haz clic en el mapa para ubicar el incidente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar prestador' })).toHaveCount(0);
    await verificarAccesibilidad(page);

    await asignacion.mapa().click({ position: { x: 300, y: 140 } });
    await expect(page.getByLabel('Latitud')).toHaveValue(/^4\.\d{6}$/);
    await expect(asignacion.mapa().locator('.mapa-asignacion__marcador--incidente')).toBeVisible();

    // La alternativa por teclado: corregir las coordenadas en los campos.
    await page.getByLabel('Latitud').fill('91');
    await page.getByLabel('Dirección').fill('Carrera 15 # 93-40, apto 402, Bogotá');
    await page.getByRole('button', { name: 'Guardar ubicación' }).click();
    await expect(page.getByText('La latitud va de −90 a 90.')).toBeVisible();
    expect(trafico.ubicaciones).toEqual([]);

    await page.getByLabel('Latitud').fill('4.6771');
    await page.getByLabel('Longitud').fill('-74.0483');
    await page.getByRole('button', { name: 'Guardar ubicación' }).click();

    expect(trafico.ubicaciones).toEqual([
      { address: 'Carrera 15 # 93-40, apto 402, Bogotá', latitude: 4.6771, longitude: -74.0483 },
    ]);
    await expect(page.getByText(/Registradas por Andrés Ruiz/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar prestador' })).toBeVisible();
  });

  test('busca y sugiere el más cercano; solo los elegibles se asignan (CA-2, CA-3)', async ({
    page,
  }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    const trafico = await asignacion.simularGateway({
      lecturas: [LISTA],
      politica: POLITICA,
      trasBuscar: () => PROPUESTA,
    });
    await asignacion.abrirComo(RUTA);

    await page.getByRole('button', { name: 'Buscar prestador' }).click();

    expect(trafico.busquedas).toEqual([null]);
    await expect(
      page.getByRole('heading', { name: 'Prestadores con la especialidad requerida (plomería)' }),
    ).toBeVisible();
    const sugerido = page.getByRole('row', { name: /Servicios Hogar Norte/ });
    await expect(sugerido).toContainText('2,3 km');
    await expect(sugerido).toContainText('Disponible hoy');
    await expect(sugerido).toContainText('Sugerido');
    await expect(
      page.getByRole('button', { name: 'Asignar a Servicios Hogar Norte' }),
    ).toBeEnabled();
    await expect(page.getByRole('row', { name: /Reparaciones Chapinero/ })).toContainText(
      'Disponible mañana',
    );
    await expect(
      page.getByRole('button', { name: 'Asignar a Reparaciones Chapinero' }),
    ).toBeDisabled();
    await expect(page.getByRole('row', { name: /Técnicos Unidos/ })).toContainText(
      'Fuera del radio',
    );
    await expect(page.getByRole('button', { name: 'Asignar a Técnicos Unidos' })).toBeDisabled();
    await expect(asignacion.mapa().locator('.mapa-asignacion__marcador--candidato')).toHaveCount(3);
    await expect(asignacion.mapa().locator('.mapa-asignacion__radio')).toHaveCount(1);
    await expect(page.getByText('Radio de búsqueda 5 km')).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/asignacion/o7-propuesta.png', fullPage: true });
  });

  test('amplía el radio desde el siguiente de la política y registra el intento (CA-4)', async ({
    page,
  }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    const trafico = await asignacion.simularGateway({
      lecturas: [PROPUESTA],
      politica: POLITICA,
      trasBuscar: () => PROPUESTA_AMPLIADA,
    });
    await asignacion.abrirComo(RUTA);

    await page.getByRole('button', { name: 'Ampliar radio de búsqueda' }).click();

    expect(trafico.busquedas).toEqual([{ from_radius_km: 10 }]);
    await expect(page.getByRole('button', { name: 'Asignar a Técnicos Unidos' })).toBeEnabled();
    await expect(page.getByRole('region', { name: 'Registro de intentos' })).toContainText(
      '10 km · 2 prestadores disponibles',
    );
    await expect(page.getByText('Radio de búsqueda 10 km')).toBeVisible();
  });

  test('asigna el sugerido tras confirmar y sigue el aviso al prestador (CA-5)', async ({
    page,
  }) => {
    await page.clock.install();
    const asignacion = new AsignacionPrestadorPagina(page);
    const trafico = await asignacion.simularGateway({
      lecturas: [PROPUESTA],
      politica: POLITICA,
      trasAsignar: ASIGNADA,
    });
    await asignacion.abrirComo(RUTA);

    await page.getByRole('button', { name: 'Asignar prestador sugerido' }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: '¿Asignar a Servicios Hogar Norte?' }),
    ).toBeVisible();
    await verificarAccesibilidad(page);
    await asignacion.confirmarAsignacion();

    expect(trafico.asignaciones).toEqual([
      { provider_id: 'prv-servicios-hogar-norte', search_seq: 1 },
    ]);
    await expect(page.getByRole('heading', { name: 'Prestador asignado' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'despachos@hogarnorte.example.com' }),
    ).toHaveAttribute('href', 'mailto:despachos@hogarnorte.example.com');
    await expect(page.getByText(/por Andrés Ruiz/)).toBeVisible();
    await expect(page.getByText('Enviando la asignación al prestador…')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);

    // El backend envía el correo; la página vuelve a leer el caso cada 5 s mientras está pendiente.
    await asignacion.simularGateway({ lecturas: [AVISADA], politica: POLITICA });
    await page.clock.runFor(5_000);
    await expect(page.getByText(/Aviso enviado al prestador/)).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/asignacion/o7-asignado.png', fullPage: true });
  });

  test('O7b: pendiente de asignación con el motivo y los intentos; reintenta y actualiza (CA-6)', async ({
    page,
  }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    const trafico = await asignacion.simularGateway({
      lecturas: [PENDIENTE, PENDIENTE, PROPUESTA],
      politica: POLITICA,
      trasBuscar: () => PENDIENTE,
    });
    await asignacion.abrirComo(RUTA);

    await expect(page.getByText('Pendiente de asignación', { exact: true })).toBeVisible();
    await expect(page.getByText('No se encontró un prestador disponible')).toBeVisible();
    await expect(page.getByText(/Se buscó en 5, 10 y 20 km/)).toBeVisible();
    await expect(page.getByText(/se repetirá automáticamente cada 5 minutos/)).toBeVisible();
    await expect(page.getByText(/20 km \(máximo\) · sin prestadores disponibles/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ampliar radio de búsqueda' })).toBeDisabled();
    await expect(page.getByText('Ya se buscó en el radio máximo')).toBeVisible();
    await expect(page.getByRole('row', { name: /Servicios Hogar Norte/ })).toContainText(
      'No disponible · en otro caso',
    );
    for (const boton of await page.getByRole('button', { name: /^Asignar a/ }).all()) {
      await expect(boton).toBeDisabled();
    }
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/asignacion/o7b-pendiente.png', fullPage: true });

    await page.getByRole('button', { name: 'Reintentar búsqueda' }).click();
    expect(trafico.busquedas).toEqual([null]);

    // El reintento automático del backend encontró un elegible: «Actualizar estado» lo trae.
    await asignacion.simularGateway({ lecturas: [PROPUESTA], politica: POLITICA });
    await page.getByRole('button', { name: 'Actualizar estado' }).click();
    await expect(page.getByRole('button', { name: 'Asignar prestador sugerido' })).toBeVisible();
  });

  test('conflictos al asignar: el prestador dejó de estar disponible u otro analista se adelantó', async ({
    page,
  }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    await asignacion.simularGateway({
      lecturas: [PROPUESTA, PROPUESTA_AMPLIADA],
      politica: POLITICA,
      trasAsignar: { status: 409, error: 'provider_unavailable' },
    });
    await asignacion.abrirComo(RUTA);

    await page.getByRole('button', { name: 'Asignar a Servicios Hogar Norte' }).click();
    await asignacion.confirmarAsignacion();

    await expect(page.getByRole('alert')).toContainText(
      'El prestador ya no está disponible. Busca de nuevo.',
    );
    await expect(page.getByRole('button', { name: 'Asignar a Técnicos Unidos' })).toBeEnabled();

    await asignacion.simularGateway({
      lecturas: [ASIGNADA],
      politica: POLITICA,
      trasAsignar: { status: 409, error: 'assignment_exists' },
    });
    await page.getByRole('button', { name: 'Asignar a Técnicos Unidos' }).click();
    await asignacion.confirmarAsignacion();
    await expect(page.getByRole('alert')).toContainText(
      'Otro analista ya asignó un prestador a este caso.',
    );
    await expect(page.getByRole('heading', { name: 'Prestador asignado' })).toBeVisible();
  });

  test('administra la disponibilidad de los prestadores (CA-2)', async ({ page }) => {
    const asignacion = new AsignacionPrestadorPagina(page);
    const trafico = await asignacion.simularGateway({ lecturas: [PROPUESTA], politica: POLITICA });
    await asignacion.abrirComo(RUTA);

    await page.getByRole('link', { name: 'Administrar prestadores' }).click();
    await expect(page).toHaveURL('/siniestros/prestadores');
    await expect(page.getByRole('heading', { level: 1, name: 'Prestadores' })).toBeVisible();
    await expect(page.getByRole('rowheader')).toHaveCount(4);
    await verificarAccesibilidad(page);

    await page.getByLabel('Especialidad').selectOption('plumbing');
    await expect(page).toHaveURL('/siniestros/prestadores?especialidad=plumbing');
    await expect(page.getByRole('rowheader')).toHaveCount(3);
    expect(trafico.consultasPrestadores.at(-1)).toBe('?specialty=plumbing');

    await page
      .getByRole('button', { name: 'Cambiar disponibilidad de Servicios Hogar Norte' })
      .click();
    await page.getByLabel('Hasta (opcional)').fill('2099-12-31');
    await verificarAccesibilidad(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    expect(trafico.disponibilidades.at(-1)).toEqual({
      id: 'prv-servicios-hogar-norte',
      cuerpo: { availability: 'unavailable', unavailable_until: '2099-12-31' },
    });
    await expect(page.getByRole('status')).toContainText(
      'Se actualizó la disponibilidad de Servicios Hogar Norte.',
    );

    await page.getByRole('button', { name: 'Liberar a Técnicos Unidos' }).click();
    await expect(page.getByRole('dialog')).toContainText('Está asignado a un caso');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    expect(trafico.disponibilidades.at(-1)).toEqual({
      id: 'prv-tecnicos-unidos',
      cuerpo: { availability: 'available' },
    });
    await expect(page.getByRole('row', { name: /Técnicos Unidos/ })).toContainText('Disponible');

    // Recargar conserva el filtro.
    await page.reload();
    await expect(page.getByLabel('Especialidad')).toHaveValue('plumbing');
  });

  test.describe('roles', () => {
    for (const rol of ['asegurado', 'asesor'] as const) {
      test(`el rol ${rol} no entra a la asignación ni a los prestadores`, async ({ page }) => {
        const asignacion = new AsignacionPrestadorPagina(page);
        await asignacion.simularGateway({ lecturas: [PROPUESTA], politica: POLITICA });
        await asignacion.abrirComo(RUTA, rol);
        await expect(page).toHaveURL('/acceso/no-autorizado');

        await page.goto('/siniestros/prestadores');
        await expect(page).toHaveURL('/acceso/no-autorizado');
      });
    }

    test('un 403 del gateway lleva a «acceso no autorizado»', async ({ page }) => {
      const asignacion = new AsignacionPrestadorPagina(page);
      await asignacion.simularGateway({
        lecturas: [{ status: 403, error: 'forbidden' }],
        politica: POLITICA,
      });
      await asignacion.abrirComo(RUTA);

      await expect(page).toHaveURL('/acceso/no-autorizado');
    });
  });

  test.describe('resiliencia', () => {
    test('503 al leer la asignación → «Reintentar»', async ({ page }) => {
      const asignacion = new AsignacionPrestadorPagina(page);
      await asignacion.simularGateway({
        lecturas: [{ status: 503, error: 'claims_unavailable' }, PROPUESTA],
        politica: POLITICA,
      });
      await asignacion.abrirComo(RUTA);

      await expect(
        page.getByRole('heading', { name: 'No pudimos cargar la asignación' }),
      ).toBeVisible();
      await verificarAccesibilidad(page);
      await page.getByRole('button', { name: 'Reintentar' }).click();
      await expect(page.getByRole('button', { name: 'Asignar prestador sugerido' })).toBeVisible();
    });

    test('sin política, «Ampliar radio» queda deshabilitado y se puede asignar', async ({
      page,
    }) => {
      const asignacion = new AsignacionPrestadorPagina(page);
      await asignacion.simularGateway({
        lecturas: [PROPUESTA],
        politica: { status: 503, error: 'claims_unavailable' },
      });
      await asignacion.abrirComo(RUTA);

      await expect(page.getByRole('button', { name: 'Ampliar radio de búsqueda' })).toBeDisabled();
      await expect(page.getByText('No pudimos leer los radios de búsqueda')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Asignar prestador sugerido' })).toBeEnabled();
    });

    test('sin teselas del mapa, la página sigue usable', async ({ page }) => {
      const asignacion = new AsignacionPrestadorPagina(page);
      await asignacion.simularGateway({
        lecturas: [PROPUESTA],
        politica: POLITICA,
        sinTeselas: true,
      });
      await asignacion.abrirComo(RUTA);

      await expect(asignacion.mapa()).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Asignar a Servicios Hogar Norte' }),
      ).toBeEnabled();
    });

    test('hurto: no requiere visita', async ({ page }) => {
      const asignacion = new AsignacionPrestadorPagina(page);
      await asignacion.simularGateway({ lecturas: [SIN_VISITA], politica: POLITICA });
      await asignacion.abrirComo(RUTA);

      await expect(page.getByText('Este siniestro no requiere visita en sitio')).toBeVisible();
      await expect(page.getByRole('button', { name: /Buscar|Asignar/ })).toHaveCount(0);
      await verificarAccesibilidad(page);
    });

    test('caso inexistente → «No encontramos este siniestro»', async ({ page }) => {
      const asignacion = new AsignacionPrestadorPagina(page);
      await asignacion.simularGateway({
        lecturas: [{ status: 404, error: 'claim_not_found' }],
        politica: POLITICA,
      });
      await asignacion.abrirComo(RUTA);

      await expect(
        page.getByRole('heading', { name: 'No encontramos este siniestro' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Volver a casos en evaluación' })).toBeVisible();
    });
  });
});
