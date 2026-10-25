import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import {
  CASO_MOVIL,
  ID_CASO,
  OPCIONES_RADICACION,
  POLIZA_AUTOS,
  casoRadicado,
  documentoPdf,
  ejecutableRenombrado,
  enDias,
  filaDelCaso,
  fotoDemasiadoGrande,
  fotoJpg,
  isoDesdeLocalBogota,
  localBogota,
} from '../../fixtures/siniestros';
import { MisSiniestrosPagina } from '../../paginas/mis-siniestros.pagina';
import { GuionSiniestros, RadicacionSiniestroPagina } from '../../paginas/radicacion-siniestro.pagina';

/** El hecho ocurrió hace 6 días: dentro de la vigencia de la póliza de Autos. */
const HECHO_LOCAL = localBogota(enDias(-6));
const HECHO = isoDesdeLocalBogota(HECHO_LOCAL);
const LUGAR = 'Calle 80 con carrera 30, Bogotá';
const DESCRIPCION = 'Un vehículo particular golpeó la parte trasera en el semáforo.';
const POLIZA = 'Autos · AU-2025-118204 · KJT-482';
const COLISION = 'Colisión con daños al vehículo';

function guion(cambios: Partial<GuionSiniestros> = {}): GuionSiniestros {
  return {
    opciones: { estado: 200, cuerpo: OPCIONES_RADICACION },
    radicaciones: [{ estado: 201, cuerpo: casoRadicado(HECHO) }],
    detalle: { estado: 200, cuerpo: casoRadicado(HECHO) },
    listado: [{ estado: 200, cuerpo: { items: [filaDelCaso(HECHO), CASO_MOVIL], next_page_token: null } }],
    ...cambios,
  };
}

async function preparar(page: Page, cambios: Partial<GuionSiniestros> = {}) {
  await simularCognito(page);
  const radicacion = new RadicacionSiniestroPagina(page);
  const llamadas = await radicacion.simularGateway(guion(cambios));
  await radicacion.abrirComo('/siniestros/radicar');
  await expect(radicacion.titulo).toHaveText('Radicar un siniestro');
  return { radicacion, llamadas };
}

/** Diligencia la colisión y adjunta todo menos lo que se indique. */
async function diligenciarColision(radicacion: RadicacionSiniestroPagina, { sinCroquis = false } = {}) {
  await radicacion.elegir(POLIZA, COLISION);
  await radicacion.diligenciar(HECHO_LOCAL, LUGAR, DESCRIPCION);
  await radicacion.subir('Fotos del vehículo', [fotoJpg('1.jpg'), fotoJpg('2.jpg'), fotoJpg('3.jpg'), fotoJpg('4.jpg')]);
  await radicacion.subir('Documento del conductor', documentoPdf('cedula.pdf'));
  if (!sinCroquis) {
    await radicacion.subir('Informe de tránsito o croquis', documentoPdf('croquis.pdf'));
  }
}

/**
 * Radicación de un siniestro con soportes desde el portal del asegurado (HU-W2.1-01). Cognito y el API Gateway se
 * simulan con `page.route`; la sesión es la de un asegurado. Las vigencias se calculan desde hoy.
 */
test.describe('Radicación de siniestro con soportes (HU-W2.1-01)', () => {
  test('solo ofrece las pólizas activas propias y, al elegir el tipo, sus soportes obligatorios (CA-1)', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page);

    await expect(radicacion.poliza.getByRole('option')).toHaveText([
      'Elige una póliza',
      POLIZA,
      'Hogar · HG-2025-880231 · Calle 93 # 11-20, Bogotá',
    ]);
    await expect(radicacion.tipo).toBeDisabled();
    expect(llamadas.opciones).toBe(1);

    await radicacion.elegir(POLIZA, COLISION);

    await expect(radicacion.soportes.getByText('0 de 3 obligatorios adjuntos')).toBeVisible();
    await expect(radicacion.soporte('Fotos del vehículo (mínimo 4)').getByText('Falta')).toBeVisible();
    await expect(radicacion.soporte('Informe de tránsito o croquis').getByText('Falta')).toBeVisible();
    await expect(radicacion.soporte('Denuncia ante autoridad').getByText('No aplica', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Subir archivos de Denuncia ante autoridad')).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('sin el informe de tránsito no deja radicar y dice qué falta; el 422 marca la fila (CA-2)', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page, {
      radicaciones: [
        {
          estado: 422,
          cuerpo: {
            error: 'validation_failed',
            message: 'one or more fields are missing or invalid',
            fields: [
              { field: 'supports.traffic_report', code: 'missing' },
              { field: 'place', code: 'required' },
            ],
          },
        },
      ],
    });

    await diligenciarColision(radicacion, { sinCroquis: true });

    await expect(radicacion.radicar).toBeDisabled();
    await expect(radicacion.lateral.getByText('Falta 1 soporte obligatorio')).toBeVisible();
    await expect(
      radicacion.lateral.getByText('No es posible radicar hasta completar: Informe de tránsito o croquis.'),
    ).toBeVisible();
    await verificarAccesibilidad(page);

    // El backend manda: un 422 con el soporte y el lugar se muestra campo a campo.
    await radicacion.subir('Informe de tránsito o croquis', documentoPdf('croquis.pdf'));
    await radicacion.radicar.click();

    await expect(radicacion.lateral.getByText('No se pudo radicar')).toBeVisible();
    await expect(radicacion.soporte('Informe de tránsito o croquis').getByText('Falta adjuntar Informe de tránsito o croquis.')).toBeVisible();
    await expect(radicacion.lugar).toHaveAttribute('aria-invalid', 'true');
    await expect(radicacion.lugar).toHaveValue(LUGAR);
    expect(llamadas.radicaciones).toHaveLength(1);
    await verificarAccesibilidad(page);
  });

  test('con el hecho fuera de la vigencia no deja radicar; el tipo no cubierto llega con su motivo (CA-3)', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page, {
      radicaciones: [
        {
          estado: 422,
          cuerpo: {
            error: 'policy_not_eligible',
            message: 'the policy does not cover that incident type',
            reason: 'incident_not_covered',
            valid_from: POLIZA_AUTOS.valid_from,
            valid_to: POLIZA_AUTOS.valid_to,
          },
        },
      ],
    });
    await diligenciarColision(radicacion);

    await radicacion.fecha.fill(localBogota(enDias(-400)));

    await expect(radicacion.antesDeRadicar.getByText(/La fecha del hecho está fuera de la vigencia \(del/)).toBeVisible();
    await expect(radicacion.radicar).toBeDisabled();
    await verificarAccesibilidad(page);

    await radicacion.fecha.fill(HECHO_LOCAL);
    await expect(radicacion.antesDeRadicar.getByText('Fecha del hecho dentro de la vigencia.')).toBeVisible();
    await radicacion.radicar.click();

    await expect(radicacion.lateral.getByText('La póliza no cubre este tipo de siniestro')).toBeVisible();
    await expect(radicacion.lateral.getByText(/^Vigencia de la póliza: del /)).toBeVisible();
    expect(llamadas.radicaciones).toHaveLength(1);
    await verificarAccesibilidad(page);
  });

  test('radica con todos los soportes, confirma con el radicado y descarga el PDF (CA-4)', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page);
    await diligenciarColision(radicacion);
    await expect(radicacion.soportes.getByText('3 de 3 obligatorios adjuntos')).toBeVisible();
    expect(llamadas.soportes).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg', 'cedula.pdf', 'croquis.pdf']);

    await radicacion.radicar.click();

    await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');
    await expect(page.getByRole('status').filter({ hasText: 'Tu siniestro quedó radicado' })).toBeVisible();
    await expect(page.getByText('3 de 3 obligatorios · 6 archivos')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ver el estado/ })).toHaveCount(0);
    await expect(page).toHaveURL(`/siniestros/radicar?caso=${ID_CASO}`);
    const [{ cuerpo, clave }] = llamadas.radicaciones;
    expect(clave).toMatch(/^[0-9a-f-]{36}$/);
    expect(cuerpo).toEqual({
      policy_id: 'AU-2025-118204',
      incident_type: 'collision',
      occurred_at: HECHO,
      place: LUGAR,
      description: DESCRIPCION,
      supports: [
        { requirement_code: 'vehicle_photos', support_ids: [1, 2, 3, 4].map((n) => `sup-${String(n).padStart(32, '0')}`) },
        { requirement_code: 'driver_document', support_ids: [`sup-${'5'.padStart(32, '0')}`] },
        { requirement_code: 'traffic_report', support_ids: [`sup-${'6'.padStart(32, '0')}`] },
      ],
    });
    await verificarAccesibilidad(page);

    const [descarga] = await Promise.all([page.waitForEvent('download'), radicacion.descargar.click()]);
    expect(descarga.suggestedFilename()).toBe('radicado-SIN-2026-01712.pdf');
    expect(llamadas.recibos).toEqual([`/v1/claims/${ID_CASO}/filing-receipt`]);

    // Al recargar, la confirmación se vuelve a leer con GET /v1/claims/{id}.
    await page.reload();
    await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');
    expect(llamadas.detalles).toContain(`/v1/claims/${ID_CASO}`);
  });

  test('rechaza un archivo demasiado grande sin subirlo y uno renombrado por su contenido, sin perder lo diligenciado (CA-5)', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page, {
      soporte: (nombre) =>
        nombre === 'croquis-falso.pdf'
          ? { estado: 415, cuerpo: { error: 'unsupported_file_type', message: 'only JPEG, PNG or PDF files are accepted' } }
          : null,
    });
    await diligenciarColision(radicacion, { sinCroquis: true });

    await radicacion.subir('Fotos del vehículo', fotoDemasiadoGrande());
    await expect(radicacion.soporte('Fotos del vehículo (mínimo 4)').getByRole('alert')).toHaveText('El archivo supera 10 MB.');
    expect(llamadas.soportes).not.toContain('foto-enorme.jpg');

    await radicacion.subir('Informe de tránsito o croquis', ejecutableRenombrado());
    await expect(radicacion.soporte('Informe de tránsito o croquis').getByRole('alert')).toHaveText(
      'Formato no admitido para este soporte.',
    );
    await expect(radicacion.lugar).toHaveValue(LUGAR);
    await expect(radicacion.soporte('Fotos del vehículo (mínimo 4)').getByText('Adjunto · 4 archivos')).toBeVisible();
    await verificarAccesibilidad(page);

    await radicacion.subir('Informe de tránsito o croquis', documentoPdf('croquis.pdf'));
    await radicacion.radicar.click();

    await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');
  });

  test('tras radicar, «Mis siniestros» muestra el caso con su estado y conserva el filtro al cargar más (CA-6)', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page, {
      listado: [
        { estado: 200, cuerpo: { items: [filaDelCaso(HECHO), CASO_MOVIL], next_page_token: null } },
        { estado: 200, cuerpo: { items: [filaDelCaso(HECHO)], next_page_token: 'tok-2' } },
        { estado: 200, cuerpo: { items: [{ ...CASO_MOVIL, claim_id: 'c3', filing_number: 'SIN-2026-01410' }], next_page_token: null } },
      ],
    });
    await diligenciarColision(radicacion);
    await radicacion.radicar.click();
    await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');

    await radicacion.volver.click();

    const misSiniestros = new MisSiniestrosPagina(page);
    await expect(page).toHaveURL('/siniestros/mis-siniestros');
    await expect(misSiniestros.titulo).toHaveText('Mis siniestros');
    await expect(misSiniestros.fila('SIN-2026-01712')).toContainText('Autos · Colisión');
    await expect(misSiniestros.fila('SIN-2026-01712')).toContainText('Radicado');
    await expect(misSiniestros.fila('SIN-2026-01655')).toContainText('Radicado desde la app');
    await verificarAccesibilidad(page);

    await misSiniestros.poliza.selectOption('AU-2025-118204');
    await misSiniestros.cargarMas.click();

    await expect(misSiniestros.fila('SIN-2026-01410')).toBeVisible();
    expect(llamadas.listados).toEqual([
      'page_size=20',
      'policy_id=AU-2025-118204&page_size=20',
      'policy_id=AU-2025-118204&page_size=20&page_token=tok-2',
    ]);
  });

  test('si el servicio no responde al radicar, el reintento usa la misma Idempotency-Key', async ({ page }) => {
    const { radicacion, llamadas } = await preparar(page, {
      radicaciones: [
        { estado: 503, cuerpo: { error: 'policy_directory_unavailable', message: 'the policy directory did not respond' } },
        { estado: 201, cuerpo: casoRadicado(HECHO) },
      ],
    });
    await diligenciarColision(radicacion);
    await radicacion.radicar.click();

    await expect(radicacion.lateral.getByText('No pudimos completar la radicación')).toBeVisible();
    await verificarAccesibilidad(page);
    await radicacion.lateral.getByRole('button', { name: 'Reintentar' }).click();

    await expect(radicacion.titulo).toHaveText('Siniestro SIN-2026-01712');
    expect(llamadas.radicaciones).toHaveLength(2);
    expect(llamadas.radicaciones[1].clave).toBe(llamadas.radicaciones[0].clave);
  });

  test('si el core de pólizas no responde al abrir, ofrece reintentar', async ({ page }) => {
    await simularCognito(page);
    const radicacion = new RadicacionSiniestroPagina(page);
    const respuestas: GuionSiniestros = guion({
      opciones: { estado: 503, cuerpo: { error: 'policy_directory_unavailable', message: 'x' } },
    });
    await radicacion.simularGateway(respuestas);
    await radicacion.abrirComo('/siniestros/radicar');

    await expect(radicacion.titulo).toHaveText('No pudimos consultar tus pólizas');
    await verificarAccesibilidad(page);
    respuestas.opciones = { estado: 200, cuerpo: OPCIONES_RADICACION };
    await page.getByRole('button', { name: 'Reintentar' }).click();

    await expect(radicacion.titulo).toHaveText('Radicar un siniestro');
  });

  test('sin pólizas radicables muestra el estado vacío', async ({ page }) => {
    const { radicacion } = await preparar(page, {
      opciones: { estado: 200, cuerpo: { catalog_version: 'claim-catalog-v1', policies: [] } },
    });

    await expect(page.getByRole('heading', { name: 'No tienes pólizas activas para radicar' })).toBeVisible();
    await expect(radicacion.radicar).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('el asesor no entra a la radicación del asegurado', async ({ page }) => {
    await simularCognito(page);
    const radicacion = new RadicacionSiniestroPagina(page);
    const llamadas = await radicacion.simularGateway(guion());

    await radicacion.abrirComo('/siniestros/radicar', 'asesor');

    await expect(page).toHaveURL('/acceso/no-autorizado');
    expect(llamadas.opciones).toBe(0);
  });
});
