import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import {
  CASO_MOVIL,
  ID_CASO,
  OPCIONES_RADICACION,
  casoRadicado,
  documentoPdf,
  enDias,
  filaDelCaso,
  fotoJpg,
  isoDesdeLocalBogota,
  localBogota,
} from '../../fixtures/siniestros';
import {
  GuionTriage,
  ID_CASO_ALTO,
  ID_CASO_HURTO,
  ID_CASO_INEXISTENTE,
  ID_CASO_PENDIENTE,
  LOTE_TRES,
  filaLote,
  filaLoteSinNivel,
  simularTriage,
  triageAsegurado,
  triageAseguradoSinNivel,
  triageOperaciones,
  triageOperacionesSinNivel,
} from '../../fixtures/triage';
import { ColaSiniestrosPagina } from '../../paginas/cola-siniestros.pagina';
import { DetalleSiniestroPagina } from '../../paginas/detalle-siniestro.pagina';
import { MisSiniestrosPagina } from '../../paginas/mis-siniestros.pagina';
import { PrioridadSiniestroPagina } from '../../paginas/prioridad-siniestro.pagina';
import { GuionSiniestros, RadicacionSiniestroPagina } from '../../paginas/radicacion-siniestro.pagina';

const HECHO_LOCAL = localBogota(enDias(-6));
const HECHO = isoDesdeLocalBogota(HECHO_LOCAL);
const POLIZA = 'Autos · AU-2025-118204 · KJT-482';
const COLISION = 'Colisión con daños al vehículo';

function guionRadicacion(cambios: Partial<GuionSiniestros> = {}): GuionSiniestros {
  return {
    opciones: { estado: 200, cuerpo: OPCIONES_RADICACION },
    radicaciones: [{ estado: 201, cuerpo: casoRadicado(HECHO) }],
    detalle: { estado: 200, cuerpo: { ...casoRadicado(HECHO), estimated_amount_minor: 480000000 } },
    listado: [{ estado: 200, cuerpo: { items: [filaDelCaso(HECHO), CASO_MOVIL], next_page_token: null } }],
    ...cambios,
  };
}

/** Sesión simulada, gateway de la radicación y del triage, y la ruta abierta con el rol dado. */
async function prepararAsegurado(page: Page, triage: GuionTriage, ruta = '/siniestros/mis-siniestros', cambios: Partial<GuionSiniestros> = {}) {
  await simularCognito(page);
  const radicacion = new RadicacionSiniestroPagina(page);
  const llamadasRadicacion = await radicacion.simularGateway(guionRadicacion(cambios));
  const llamadasTriage = await simularTriage(page, triage);
  await radicacion.abrirComo(ruta, 'asegurado');
  return { radicacion, llamadasRadicacion, llamadasTriage };
}

async function prepararAnalista(page: Page, triage: GuionTriage, ruta = '/siniestros/cola') {
  await simularCognito(page);
  const llamadas = await simularTriage(page, triage);
  const cola = new ColaSiniestrosPagina(page);
  await cola.abrirComo(ruta, 'operaciones');
  return { cola, llamadas };
}

/**
 * Prioridad automática del siniestro (HU-W2.2-01): el monto estimado al radicar, el detalle del asegurado con su
 * prioridad, la cola y el detalle del analista. Cognito y el API Gateway se simulan con `page.route`; el cálculo y su
 * plazo los certifica el backend. El sondeo de `pending` se acelera con `page.clock`.
 */
test.describe('Prioridad automática del siniestro (HU-W2.2-01)', () => {
  test.describe('monto estimado al radicar (CA-2, F4)', () => {
    async function diligenciar(radicacion: RadicacionSiniestroPagina) {
      await radicacion.elegir(POLIZA, COLISION);
      await radicacion.diligenciar(HECHO_LOCAL, 'Calle 80 con carrera 30, Bogotá', 'Un vehículo particular golpeó la parte trasera.');
      await radicacion.subir('Fotos del vehículo', [fotoJpg('1.jpg'), fotoJpg('2.jpg'), fotoJpg('3.jpg'), fotoJpg('4.jpg')]);
      await radicacion.subir('Documento del conductor', documentoPdf('cedula.pdf'));
      await radicacion.subir('Informe de tránsito o croquis', documentoPdf('croquis.pdf'));
    }

    test('radica con «4.800.000» y el POST lleva exactamente estimated_amount_minor: 480000000', async ({ page }) => {
      const { radicacion, llamadasRadicacion } = await prepararAsegurado(page, {}, '/siniestros/radicar');
      await diligenciar(radicacion);

      await radicacion.monto.fill('4.800.000');
      await expect(page.getByText(/Se enviará como \$\s4\.800\.000 COP/)).toBeVisible();
      await verificarAccesibilidad(page);
      await radicacion.radicar.click();

      await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');
      expect(llamadasRadicacion.radicaciones).toHaveLength(1);
      expect(llamadasRadicacion.radicaciones[0].cuerpo).toMatchObject({ estimated_amount_minor: 480000000 });
    });

    test('sin monto el cuerpo no lleva el campo (regresión de HU-W2.1-01)', async ({ page }) => {
      const { radicacion, llamadasRadicacion } = await prepararAsegurado(page, {}, '/siniestros/radicar');
      await diligenciar(radicacion);

      await expect(radicacion.radicar).toBeEnabled();
      await radicacion.radicar.click();

      await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');
      expect(Object.keys(llamadasRadicacion.radicaciones[0].cuerpo as object)).not.toContain('estimated_amount_minor');
    });

    test('un monto con decimales deshabilita «Radicar siniestro» y el aviso lo dice', async ({ page }) => {
      const { radicacion } = await prepararAsegurado(page, {}, '/siniestros/radicar');
      await diligenciar(radicacion);

      await radicacion.monto.fill('4.800.000,50');
      await radicacion.monto.blur();

      await expect(radicacion.radicar).toBeDisabled();
      await expect(radicacion.monto).toHaveAttribute('aria-invalid', 'true');
      await expect(radicacion.lateral.getByText(/Monto estimado \(opcional\)/)).toBeVisible();
      await verificarAccesibilidad(page);
    });

    test('un 422 validation_failed del campo lo marca sin perder lo diligenciado', async ({ page }) => {
      const { radicacion } = await prepararAsegurado(page, {}, '/siniestros/radicar', {
        radicaciones: [
          {
            estado: 422,
            cuerpo: {
              error: 'validation_failed',
              message: 'x',
              fields: [{ field: 'estimated_amount_minor', code: 'out_of_range' }],
            },
          },
        ],
      });
      await diligenciar(radicacion);
      await radicacion.monto.fill('4.800.000');

      await radicacion.radicar.click();

      await expect(page.getByText('El monto debe estar entre 1 y 100.000.000.000 de pesos.')).toBeVisible();
      await expect(radicacion.monto).toHaveValue('4.800.000');
      await expect(radicacion.lugar).toHaveValue('Calle 80 con carrera 30, Bogotá');
    });
  });

  test.describe('detalle del asegurado (CA-1, CA-4)', () => {
    test('de «Mis siniestros» a «Ver detalle»: «Calculando prioridad…» y luego el nivel y el tiempo estimado', async ({ page }) => {
      await page.clock.install();
      const { llamadasTriage } = await prepararAsegurado(page, {
        triage: [
          { estado: 200, cuerpo: triageAseguradoSinNivel(ID_CASO) },
          { estado: 200, cuerpo: triageAsegurado(ID_CASO) },
        ],
      });
      const misSiniestros = new MisSiniestrosPagina(page);
      await expect(misSiniestros.titulo).toHaveText('Mis siniestros');

      await page.getByRole('link', { name: 'Ver detalle del siniestro SIN-2026-01712' }).click();
      const detalle = new DetalleSiniestroPagina(page);

      await expect(detalle.titulo).toContainText('Siniestro SIN-2026-01712');
      await expect(detalle.etapas.getByText('Calculando prioridad…')).toBeVisible();
      await verificarAccesibilidad(page);

      await page.clock.runFor(5_000);

      await expect(detalle.etapas.getByText('Prioridad Triage 2')).toBeVisible();
      await expect(detalle.etapas.getByText('Tiempo estimado de resolución: 5 días hábiles')).toBeVisible();
      await expect(detalle.etapas.getByText('Calculando prioridad…')).toHaveCount(0);
      await expect(detalle.dato('Monto estimado')).toContainText('4.800.000 COP');
      await expect(page.getByText(/severidad|monto (alto|medio|bajo)/i)).toHaveCount(0);
      expect(llamadasTriage.triages).toEqual([ID_CASO, ID_CASO]);
      await verificarAccesibilidad(page);
    });

    test('con not_applicable no aparece el bloque de prioridad', async ({ page }) => {
      await prepararAsegurado(page, { triage: { estado: 200, cuerpo: triageAseguradoSinNivel(ID_CASO, 'not_applicable') } }, `/siniestros/${ID_CASO}`);
      const detalle = new DetalleSiniestroPagina(page);

      await expect(detalle.titulo).toContainText('Siniestro SIN-2026-01712');

      await expect(page.getByText(/Prioridad Triage|Calculando prioridad/)).toHaveCount(0);
    });

    test('un caso sin monto declarado muestra «—» en «Monto estimado»', async ({ page }) => {
      await prepararAsegurado(page, { triage: { estado: 200, cuerpo: triageAsegurado(ID_CASO) } }, `/siniestros/${ID_CASO}`, {
        detalle: { estado: 200, cuerpo: casoRadicado(HECHO) },
      });
      const detalle = new DetalleSiniestroPagina(page);

      await expect(detalle.dato('Monto estimado')).toHaveText('—');
    });
  });

  test.describe('cola del analista (CA-4, CA-5)', () => {
    test('muestra la regla y los objetivos por nivel desde la política simulada', async ({ page }) => {
      const { cola, llamadas } = await prepararAnalista(page, {});

      await expect(cola.titulo).toHaveText('Cola de siniestros');
      await expect(cola.regla).toContainText(/monto bajo, menos de \$\s5\.000\.000 COP; monto alto, más de \$\s30\.000\.000 COP/);
      const tarjetas = cola.indicadores.getByRole('listitem');
      await expect(tarjetas).toHaveText(['Triage 1Atención inmediata', 'Triage 2Objetivo: 5 días hábiles', 'Triage 3Objetivo: 10 días hábiles']);
      expect(llamadas.politica).toBe(1);
      await verificarAccesibilidad(page);
    });

    test('busca tres ids con una sola petición de claim_id repetido y pinta nivel, severidad, banda y objetivo', async ({ page }) => {
      await page.clock.install();
      const { cola, llamadas } = await prepararAnalista(page, {
        lote: [
          { estado: 200, cuerpo: { items: LOTE_TRES } },
          { estado: 200, cuerpo: { items: [filaLote(ID_CASO_PENDIENTE, 2, 'low', 'medium')] } },
        ],
      });

      await cola.buscarIds([ID_CASO_ALTO, ID_CASO_PENDIENTE, ID_CASO_INEXISTENTE]);

      expect(llamadas.lotes).toEqual([[ID_CASO_ALTO, ID_CASO_PENDIENTE, ID_CASO_INEXISTENTE]]);
      const alto = cola.fila(ID_CASO_ALTO);
      await expect(alto).toContainText('Triage 1');
      await expect(alto).toContainText('media');
      await expect(alto).toContainText('monto alto');
      await expect(alto).toContainText('Atención inmediata');
      await expect(cola.fila(ID_CASO_PENDIENTE)).toContainText('Calculando prioridad…');
      await expect(page.getByText('No encontramos 1 caso con los identificadores buscados.')).toBeVisible();
      await expect(cola.fila(ID_CASO_INEXISTENTE)).toHaveCount(0);
      await verificarAccesibilidad(page);

      await page.clock.runFor(5_000);

      await expect(cola.fila(ID_CASO_PENDIENTE)).toContainText('Triage 2');
      await expect(cola.fila(ID_CASO_PENDIENTE)).toContainText('Objetivo: 5 días hábiles');
      expect(llamadas.lotes).toEqual([
        [ID_CASO_ALTO, ID_CASO_PENDIENTE, ID_CASO_INEXISTENTE],
        [ID_CASO_PENDIENTE],
      ]);
      await verificarAccesibilidad(page);
    });

    test('recargar la página conserva la consulta con ?casos=', async ({ page }) => {
      const { cola, llamadas } = await prepararAnalista(page, { lote: { estado: 200, cuerpo: { items: [filaLote(ID_CASO_HURTO, 1, 'high', 'unknown')] } } });
      await cola.buscarIds([ID_CASO_HURTO]);
      await expect(cola.fila(ID_CASO_HURTO)).toContainText('sin monto declarado');
      await expect(page).toHaveURL(new RegExp(`casos=${ID_CASO_HURTO}`));

      await page.reload();

      await expect(cola.fila(ID_CASO_HURTO)).toContainText('Triage 1');
      await expect(cola.campo).toHaveValue(ID_CASO_HURTO);
      expect(llamadas.lotes).toEqual([[ID_CASO_HURTO], [ID_CASO_HURTO]]);
    });

    test('valida la búsqueda: id inválido, 51 ids y repetidos', async ({ page }) => {
      const { cola, llamadas } = await prepararAnalista(page, { lote: { estado: 200, cuerpo: { items: [filaLote(ID_CASO_HURTO, 1, 'high', 'unknown')] } } });

      await cola.buscar.click();
      await expect(cola.errorCampo).toContainText('Escribe al menos un identificador de caso.');

      await cola.campo.fill(`${ID_CASO_HURTO} ../x`);
      await cola.buscar.click();
      await expect(cola.errorCampo).toContainText('Estos identificadores no son válidos: ../x.');
      await verificarAccesibilidad(page);

      const muchos = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
      await cola.campo.fill(muchos.join(' '));
      await cola.buscar.click();
      await expect(cola.errorCampo).toContainText('Pegaste 51 identificadores; el máximo es 50.');
      expect(llamadas.lotes).toHaveLength(0);

      await cola.campo.fill(`${ID_CASO_HURTO} ${ID_CASO_HURTO}`);
      await cola.buscar.click();
      await expect(page.getByText('Se quitó 1 identificador repetido.')).toBeVisible();
      expect(llamadas.lotes).toEqual([[ID_CASO_HURTO]]);
    });
  });

  test.describe('prioridad del analista (CA-3, CA-4)', () => {
    test('«Ver prioridad» abre la tarjeta y el historial con el recálculo y su causa', async ({ page }) => {
      const { cola } = await prepararAnalista(page, {
        lote: { estado: 200, cuerpo: { items: [filaLote(ID_CASO_ALTO, 1, 'medium', 'high')] } },
      });
      await cola.buscarIds([ID_CASO_ALTO]);

      await page.getByRole('link', { name: `Ver prioridad del caso ${ID_CASO_ALTO}` }).click();
      const prioridad = new PrioridadSiniestroPagina(page);

      await expect(prioridad.titulo).toHaveText(`Siniestro ${ID_CASO_ALTO}`);
      await expect(prioridad.tarjeta).toContainText('Triage 1 · severidad media · monto alto');
      await expect(prioridad.dato('Monto estimado')).toContainText('40.000.000 COP');
      await expect(prioridad.dato('Tipo de siniestro')).toHaveText('Daño por agua');
      await expect(prioridad.dato('Objetivo de atención')).toHaveText('Atención inmediata');
      const filas = prioridad.historial.getByRole('listitem');
      await expect(filas).toHaveCount(2);
      await expect(filas.nth(0)).toContainText('Prioridad recalculada: Triage 2 → Triage 1 · Cambió el monto estimado');
      await expect(filas.nth(1)).toContainText('Triage 2 asignado · automático');
      await expect(filas.nth(0)).toContainText(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/);
      await expect(filas.nth(1)).toContainText(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/);
      await verificarAccesibilidad(page);

      await prioridad.migas.click();
      await expect(cola.fila(ID_CASO_ALTO)).toBeVisible();
    });
  });

  test.describe('roles y accesos (CA-4)', () => {
    test('el asegurado no entra a la cola ni a la prioridad del analista', async ({ page }) => {
      await simularCognito(page);
      await simularTriage(page);
      const cola = new ColaSiniestrosPagina(page);

      await cola.abrirComo('/siniestros/cola', 'asegurado');
      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
      await verificarAccesibilidad(page);

      await page.goto(`/siniestros/cola/${ID_CASO}`);
      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
    });

    test('el analista es llevado a «no autorizado» al abrir el detalle del asegurado', async ({ page }) => {
      await simularCognito(page);
      await simularTriage(page);
      const cola = new ColaSiniestrosPagina(page);

      await cola.abrirComo(`/siniestros/${ID_CASO}`, 'operaciones');

      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
    });

    test('el asesor no entra a la cola ni al detalle', async ({ page }) => {
      await simularCognito(page);
      await simularTriage(page);
      const cola = new ColaSiniestrosPagina(page);

      await cola.abrirComo('/siniestros/cola', 'asesor');
      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);

      await page.goto(`/siniestros/${ID_CASO}`);
      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
    });

    test('un 403 del gateway en la prioridad de un caso lleva a «no autorizado»', async ({ page }) => {
      await prepararAsegurado(
        page,
        { triage: { estado: 403, cuerpo: { error: 'forbidden', message: 'x' } } },
        `/siniestros/${ID_CASO}`,
      );

      await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
    });
  });

  test.describe('resiliencia', () => {
    test('un 503 del lote muestra el error y «Reintentar» consulta de nuevo', async ({ page }) => {
      const { cola, llamadas } = await prepararAnalista(page, {
        lote: [
          { estado: 503, cuerpo: { error: 'claims_unavailable', message: 'x' } },
          { estado: 200, cuerpo: { items: [filaLote(ID_CASO_HURTO, 1, 'high', 'unknown')] } },
        ],
      });
      await cola.buscarIds([ID_CASO_HURTO]);

      await expect(page.getByRole('heading', { name: 'No pudimos consultar la prioridad' })).toBeVisible();
      await verificarAccesibilidad(page);
      await page.getByRole('button', { name: 'Reintentar' }).click();

      await expect(cola.fila(ID_CASO_HURTO)).toContainText('Triage 1');
      expect(llamadas.lotes).toHaveLength(2);
    });

    test('un 503 de la política deja los indicadores con error y la búsqueda sigue funcionando', async ({ page }) => {
      const { cola } = await prepararAnalista(page, {
        politica: { estado: 503, cuerpo: { error: 'claims_unavailable', message: 'x' } },
        lote: { estado: 200, cuerpo: { items: [filaLote(ID_CASO_HURTO, 1, 'high', 'unknown')] } },
      });

      await expect(cola.indicadores.getByText('No pudimos consultar el objetivo de cada nivel.')).toBeVisible();
      await verificarAccesibilidad(page);
      await cola.buscarIds([ID_CASO_HURTO]);

      await expect(cola.fila(ID_CASO_HURTO)).toContainText('Triage 1');
    });

    test('un caso que nunca sale de pending termina en «La prioridad aún no está disponible»', async ({ page }) => {
      await page.clock.install();
      const { cola } = await prepararAnalista(page, {
        lote: { estado: 200, cuerpo: { items: [filaLoteSinNivel(ID_CASO_PENDIENTE, 'pending')] } },
      });
      await cola.buscarIds([ID_CASO_PENDIENTE]);
      await expect(cola.fila(ID_CASO_PENDIENTE)).toContainText('Calculando prioridad…');

      await page.clock.runFor(95_000);

      await expect(page.getByText('La prioridad aún no está disponible')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Actualizar' })).toBeVisible();
      await verificarAccesibilidad(page);
    });

    test('el detalle del analista con pending sondea hasta tener nivel y con not_applicable dice «Sin prioridad»', async ({ page }) => {
      await page.clock.install();
      await simularCognito(page);
      await simularTriage(page, {
        triage: [
          { estado: 200, cuerpo: triageOperacionesSinNivel('pending') },
          { estado: 200, cuerpo: triageOperaciones(ID_CASO_PENDIENTE) },
        ],
      });
      const prioridad = new PrioridadSiniestroPagina(page);
      await prioridad.abrirComo(`/siniestros/cola/${ID_CASO_PENDIENTE}`);
      await expect(prioridad.tarjeta.getByText('Calculando prioridad…')).toBeVisible();
      await expect(prioridad.historial).toHaveCount(0);

      await page.clock.runFor(5_000);

      await expect(prioridad.tarjeta).toContainText('Triage 1 · severidad media · monto alto');
      await expect(prioridad.historial).toBeVisible();
    });

    test('un caso que no entró a evaluación dice «Sin prioridad»', async ({ page }) => {
      await simularCognito(page);
      await simularTriage(page, { triage: { estado: 200, cuerpo: triageOperacionesSinNivel('not_applicable') } });
      const prioridad = new PrioridadSiniestroPagina(page);

      await prioridad.abrirComo(`/siniestros/cola/${ID_CASO_PENDIENTE}`);

      await expect(prioridad.tarjeta.getByText('Sin prioridad', { exact: true })).toBeVisible();
      await verificarAccesibilidad(page);
    });

    test('un enlace directo a un caso inexistente dice «No encontramos este siniestro»', async ({ page }) => {
      await simularCognito(page);
      await simularTriage(page, { triage: { estado: 404, cuerpo: { error: 'claim_not_found', message: 'x' } } });
      const prioridad = new PrioridadSiniestroPagina(page);

      await prioridad.abrirComo(`/siniestros/cola/${ID_CASO_INEXISTENTE}`);

      await expect(page.getByRole('heading', { name: 'No encontramos este siniestro' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Volver a la cola' })).toBeVisible();
      await verificarAccesibilidad(page);
    });
  });
});
