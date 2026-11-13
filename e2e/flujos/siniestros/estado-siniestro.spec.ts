import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { CASO_MOVIL, ID_CASO, casoRadicado, enDias, filaDelCaso } from '../../fixtures/siniestros';
import {
  EstadoSiniestroPagina,
  GuionEstado,
  ORIGEN_BUCKET,
} from '../../paginas/estado-siniestro.pagina';

/**
 * Consulta de estado del siniestro por el cliente (HU-W2.1-02, A7 y A8). Cognito y el API Gateway se simulan con
 * `page.route`; el refresco de cada minuto se acelera con `page.clock`.
 */

const HECHO = enDias(-3);
const RADICADO = enDias(-2);
const EN_EVALUACION = enDias(-1);
const SOPORTE = 'sup-0000000000000000000000000000000a';
const ID_DEVUELTO = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e93';

function caso(estado: string) {
  const base = casoRadicado(HECHO);
  return {
    ...base,
    status: estado,
    filed_at: RADICADO,
    last_changed_at: EN_EVALUACION,
    estimated_amount_minor: 480_000_000,
    supports: {
      ...base.supports,
      files: 1,
      items: [
        {
          requirement_code: 'traffic_report',
          label: 'Informe de tránsito o croquis',
          files: [
            {
              support_id: SOPORTE,
              file_name: 'croquis.pdf',
              content_type: 'application/pdf',
              byte_size: 482113,
            },
          ],
        },
      ],
    },
  };
}

function historial(estado: string, extra: Record<string, unknown> = {}) {
  const cambios = [
    { id: 1, status: 'active', previous_status: null, changed_at: RADICADO },
    { id: 2, status: 'in_evaluation', previous_status: 'active', changed_at: EN_EVALUACION },
  ];
  if (estado === 'paid') {
    cambios.push(
      { id: 3, status: 'approved', previous_status: 'in_evaluation', changed_at: enDias(0) },
      { id: 4, status: 'paid', previous_status: 'approved', changed_at: enDias(0) },
    );
  }
  return {
    claim_id: ID_CASO,
    filing_number: 'SIN-2026-01712',
    status: estado,
    last_changed_at: cambios[cambios.length - 1].changed_at,
    changes: cambios,
    reviews: [
      {
        seq: 1,
        outcome: 'approved',
        reviewed_by: 'juan@solventa.example',
        reviewer_name: 'Juan Ríos',
        reviewed_at: EN_EVALUACION,
        reason_code: null,
        message: null,
        supports: [],
        facts_to_correct: [],
      },
    ],
    last_return: null,
    resubmissions: [],
    requirements: [],
    decision: null,
    provider: { name: 'Taller Autos del Norte', distance_km: 2.3, assigned_at: EN_EVALUACION },
    stale: false,
    as_of: enDias(0),
    ...extra,
  };
}

function guion(): GuionEstado {
  return {
    listado: {
      items: [
        {
          ...filaDelCaso(HECHO),
          status: 'in_evaluation',
          filed_at: RADICADO,
          last_changed_at: EN_EVALUACION,
        },
        {
          ...CASO_MOVIL,
          claim_id: ID_DEVUELTO,
          filing_number: 'SIN-2026-01877',
          status: 'returned',
          last_changed_at: enDias(0),
        },
      ],
      next_page_token: null,
      summary: {
        in_progress: 2,
        by_status: { in_evaluation: 1, returned: 1 },
        paid_this_year: { claims: 1, amount_minor: 18_000_000, currency: 'COP' },
        pending_action: [{ claim_id: ID_DEVUELTO, filing_number: 'SIN-2026-01877' }],
        policies: [
          { policy_id: 'AU-2024-000777', line: null, product: null, insured_object: null },
          {
            policy_id: 'AU-2025-118204',
            line: 'auto',
            product: 'Autos',
            insured_object: 'KJT-482',
          },
        ],
      },
      stale: false,
      as_of: enDias(0),
    },
    caso: caso('in_evaluation'),
    historial: historial('in_evaluation'),
    triage: {
      view: 'insured',
      claim_id: ID_CASO,
      state: 'assessed',
      level: 2,
      estimated_resolution_business_days: 5,
      assessed_at: EN_EVALUACION,
    },
  };
}

test.describe('Consulta de estado del siniestro por el cliente (HU-W2.1-02)', () => {
  test('A7 muestra la etapa, el último cambio y los indicadores, y lleva a corregir o al detalle (CA-1)', async ({
    page,
  }) => {
    await simularCognito(page);
    const estado = new EstadoSiniestroPagina(page);
    await estado.simularGateway(guion());

    await estado.abrirComo('/siniestros/mis-siniestros');

    await expect(page.getByRole('heading', { level: 1, name: 'Mis siniestros' })).toBeVisible();
    const indicadores = page.getByRole('list', { name: 'Resumen de tus siniestros' });
    await expect(indicadores.getByRole('listitem').nth(0)).toContainText('2');
    await expect(indicadores.getByRole('listitem').nth(1)).toContainText('180.000 COP');
    await expect(
      indicadores.getByRole('link', { name: 'SIN-2026-01877 · corregir soportes' }),
    ).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Último cambio' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Corregir el siniestro SIN-2026-01877' }),
    ).toHaveAttribute('href', `/siniestros/${ID_DEVUELTO}/corregir`);
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/estado/a7.png', fullPage: true });

    await page.getByRole('link', { name: 'Ver detalle del siniestro SIN-2026-01712' }).click();
    await expect(page).toHaveURL(`/siniestros/${ID_CASO}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01712' }),
    ).toBeVisible();
  });

  test('A8 sigue cada etapa con la prioridad y el prestador, y descarga un soporte (CA-1)', async ({
    page,
    context,
  }) => {
    await simularCognito(page);
    const estado = new EstadoSiniestroPagina(page);
    const trafico = await estado.simularGateway(guion());

    await estado.abrirComo(`/siniestros/${ID_CASO}`);

    await expect(page.getByText(/Último cambio/)).toBeVisible();
    const actual = page.getByRole('listitem').filter({ has: page.getByText('Etapa actual') });
    await expect(actual).toContainText('En evaluación');
    await expect(actual).toContainText(
      'Prioridad Triage 2 · Tiempo estimado de resolución: 5 días hábiles',
    );
    await expect(actual).toContainText('Prestador asignado: Taller Autos del Norte (2.3 km)');
    await expect(estado.etapa('revision')).toContainText('Revisión del asesor: aprobada');
    await expect(page.getByText(/Taller Autos del Norte atenderá tu siniestro/)).toBeVisible();
    await verificarAccesibilidad(page);
    await page.screenshot({ path: 'test-results/estado/a8.png', fullPage: true });

    const lectura = context.waitForEvent('request', (r) => r.url().startsWith(ORIGEN_BUCKET));
    await page.getByRole('button', { name: 'Descargar croquis.pdf' }).click();
    expect((await lectura).url()).toContain(`${ORIGEN_BUCKET}/supports/sub-asegurado/${SOPORTE}`);
    expect(trafico.descargas).toEqual([SOPORTE]);
  });

  test('un cambio de etapa se ve en el siguiente minuto sin recargar (CA-2)', async ({ page }) => {
    await page.clock.install();
    await simularCognito(page);
    const estado = new EstadoSiniestroPagina(page);
    const g = guion();
    const trafico = await estado.simularGateway(g);
    await estado.abrirComo(`/siniestros/${ID_CASO}`);
    await expect(estado.etapa('evaluacion')).toHaveAttribute('aria-current', 'step');

    g.caso = caso('paid');
    g.historial = historial('paid', {
      decision: {
        outcome: 'approved',
        decided_at: enDias(0),
        amount_minor: 435_000_000,
        currency: 'COP',
        payout_status: 'confirmed',
        paid_at: enDias(0),
        rejection_reason: null,
      },
    });
    await page.clock.runFor(60_000);

    await expect(estado.etapa('pagado')).toHaveAttribute('aria-current', 'step');
    await expect(estado.etapa('aprobado')).toContainText(/Monto aprobado: \$\s?4\.350\.000 COP/);
    await expect(page.getByText('Pagado', { exact: true }).first()).toBeVisible();
    expect(trafico.historiales).toBeGreaterThanOrEqual(2);
    await verificarAccesibilidad(page);
  });

  test('los tres filtros de A7 consultan solos y combinados, y «Limpiar filtros» los quita', async ({
    page,
  }) => {
    await simularCognito(page);
    const estado = new EstadoSiniestroPagina(page);
    const g = guion();
    // Ningún caso está rechazado: con esa etapa no hay resultados.
    g.listadoPara = (filtros) =>
      filtros.get('status') === 'rejected' ? { ...g.listado, items: [] } : g.listado;
    const trafico = await estado.simularGateway(g);
    await estado.abrirComo('/siniestros/mis-siniestros');
    await expect(page.getByRole('status').filter({ hasText: '2 siniestros' })).toBeVisible();
    const consultas = () => trafico.listados.map((q) => new URLSearchParams(q));
    const ultima = () => consultas()[consultas().length - 1];

    const poliza = page.getByRole('combobox', { name: 'Póliza' });
    await expect(poliza.getByRole('option')).toHaveText([
      'Todas',
      'AU-2024-000777',
      'Autos · AU-2025-118204 · KJT-482',
    ]);

    await page.getByRole('combobox', { name: 'Etapa' }).selectOption('in_evaluation');
    await expect.poll(() => ultima().get('status')).toBe('in_evaluation');
    expect(ultima().has('policy_id')).toBe(false);

    await poliza.selectOption('AU-2024-000777');
    await expect.poll(() => ultima().get('policy_id')).toBe('AU-2024-000777');
    expect(ultima().get('status')).toBe('in_evaluation');

    await page.getByLabel('Desde').fill('2026-09-01');
    await expect.poll(() => ultima().get('from')).toBe('2026-09-01');
    expect(ultima().get('status')).toBe('in_evaluation');
    expect(ultima().get('policy_id')).toBe('AU-2024-000777');
    expect(ultima().has('page_token')).toBe(false);

    const antes = trafico.listados.length;
    await page.getByLabel('Desde').fill('2999-01-01');
    await expect(page.getByText('La fecha no puede ser futura.')).toBeVisible();
    await expect(page.getByLabel('Desde')).toHaveAttribute('aria-invalid', 'true');
    expect(trafico.listados.length).toBe(antes);

    await page.getByRole('combobox', { name: 'Etapa' }).selectOption('rejected');
    await expect(
      page.getByRole('heading', { name: 'No hay siniestros con estos filtros' }),
    ).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page.getByRole('status').filter({ hasText: '2 siniestros' })).toBeVisible();
    expect(trafico.listados[trafico.listados.length - 1]).toBe('page_size=20');
    await expect(page.getByRole('combobox', { name: 'Etapa' })).toHaveValue('');
    await expect(poliza).toHaveValue('');
    await expect(page.getByLabel('Desde')).toHaveValue('');
    await expect(page.getByText('La fecha no puede ser futura.')).toBeHidden();
  });

  test('A8 descarga el radicado y solo ofrece «Agregar soporte» en un caso devuelto', async ({
    page,
  }) => {
    await simularCognito(page);
    const estado = new EstadoSiniestroPagina(page);
    const g = guion();
    const recibos: string[] = [];
    await estado.simularGateway(g);
    await page.route('**/v1/claims/*/filing-receipt', (ruta) => {
      recibos.push(new URL(ruta.request().url()).pathname);
      return ruta.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.7\n'),
      });
    });
    await estado.abrirComo(`/siniestros/${ID_CASO}`);

    await expect(page.getByRole('link', { name: 'Agregar soporte' })).toHaveCount(0);
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar radicado' }).click();
    expect((await descarga).suggestedFilename()).toBe('radicado-SIN-2026-01712.pdf');
    expect(recibos).toEqual([`/v1/claims/${ID_CASO}/filing-receipt`]);

    g.caso = caso('returned');
    g.historial = historial('returned');
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await page.getByRole('link', { name: 'Agregar soporte' }).click();
    await expect(page).toHaveURL(`/siniestros/${ID_CASO}/corregir`);
  });

  test('«Radicar un siniestro» lleva a la radicación', async ({ page }) => {
    await simularCognito(page);
    const estado = new EstadoSiniestroPagina(page);
    await estado.simularGateway(guion());
    await estado.abrirComo('/siniestros/mis-siniestros');

    await page.getByRole('link', { name: 'Radicar un siniestro' }).click();

    await expect(page).toHaveURL('/siniestros/radicar');
  });

  test('el asesor no entra al estado del siniestro de un asegurado', async ({ page }) => {
    await simularCognito(page);
    await new EstadoSiniestroPagina(page).abrirComo(`/siniestros/${ID_CASO}`, 'asesor');

    await expect(page).toHaveURL('/acceso/no-autorizado');
  });
});
