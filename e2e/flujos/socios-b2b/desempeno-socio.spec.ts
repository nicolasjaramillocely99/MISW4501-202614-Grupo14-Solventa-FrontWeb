import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { DesempenoSocioPagina } from '../../paginas/desempeno-socio.pagina';

/**
 * Desempeño técnico de la API del socio (HU-W3.2-03): B3 operativo, degradado con un incidente abierto y no disponible.
 * Cognito y el API Gateway se simulan con `page.route`; la sesión es la del socio «Banco Aliado». El reloj del navegador
 * queda en el 16/09/2026, 22:30 de Colombia.
 */
const OPERATIVO = {
  period: '7d',
  from: '2026-09-10T05:00:00Z',
  to: '2026-09-17T03:30:00Z',
  status: 'operational',
  availability: { percent: 99.96, objective_percent: 99.9, requests: 10000, server_errors: 4 },
  latency: { p95_ms: 360, budget_ms: 400 },
  incidents: [],
};

const DEGRADADO = {
  ...OPERATIVO,
  period: '30d',
  from: '2026-08-18T05:00:00Z',
  status: 'degraded',
  latency: { p95_ms: 1150, budget_ms: 400 },
  incidents: [
    {
      id: 'inc-1',
      kind: 'degraded',
      route: 'POST /v1/offers',
      started_at: '2026-09-16T21:20:00Z',
      ended_at: null,
      duration_seconds: 2520,
      resolved: false,
    },
    {
      id: 'inc-2',
      kind: 'degraded',
      route: 'POST /v1/offers',
      started_at: '2026-09-08T08:12:00Z',
      ended_at: '2026-09-08T08:26:00Z',
      duration_seconds: 840,
      resolved: true,
    },
  ],
};

const NO_DISPONIBLE = {
  ...OPERATIVO,
  period: 'today',
  from: '2026-09-16T05:00:00Z',
  status: 'unavailable',
  availability: { percent: 97.5, objective_percent: 99.9, requests: 4000, server_errors: 100 },
  incidents: [
    {
      id: 'inc-3',
      kind: 'unavailable',
      route: 'POST /v1/risk-profiles/resolve',
      started_at: '2026-09-17T03:10:00Z',
      ended_at: null,
      duration_seconds: 1200,
      resolved: false,
    },
  ],
};

test.describe('Desempeño técnico de la API del socio (HU-W3.2-03)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-17T03:30:00Z') });
    await simularCognito(page);
  });

  test('operativo, sin incidentes en los últimos 7 días (CA-1, CA-4)', async ({ page }) => {
    const desempeno = new DesempenoSocioPagina(page);
    const periodos = await desempeno.simular({ '7d': OPERATIVO });

    await desempeno.abrirComoSocio();

    await expect(desempeno.titulo).toHaveText('Desempeño técnico de la API');
    await expect(desempeno.estado).toContainText('Operativo');
    await expect(desempeno.disponibilidad).toContainText('99,96 %');
    await expect(desempeno.disponibilidad).toContainText('Objetivo ≥ 99,9 %');
    await expect(desempeno.p95).toContainText('360 ms');
    await expect(desempeno.p95).toContainText('Presupuesto 400 ms');
    await expect(desempeno.sinIncidentes).toHaveText('La integración operó sin interrupciones en el período.');
    await verificarAccesibilidad(page);
    expect(periodos).toEqual(['7d']);
  });

  test('degradado con un incidente abierto, al elegir los últimos 30 días (CA-1, CA-2, CA-3)', async ({ page }) => {
    const desempeno = new DesempenoSocioPagina(page);
    await desempeno.simular({ '7d': OPERATIVO, '30d': DEGRADADO });
    await desempeno.abrirComoSocio();
    await expect(desempeno.estado).toContainText('Operativo');

    await desempeno.periodo('Últimos 30 días').click();

    await expect(desempeno.estado).toContainText('Degradado');
    await expect(desempeno.estado).toHaveClass(/estado--degraded/);
    await expect(desempeno.estado).toContainText('Incidente abierto en POST /v1/offers desde el 16/09/2026 16:20');
    await expect(desempeno.p95).toContainText('1.150 ms');
    await expect(desempeno.p95).toContainText('sobre el presupuesto');
    await expect(desempeno.incidentes).toHaveCount(2);
    await expect(desempeno.incidentes.first()).toContainText('En curso');
    await expect(desempeno.incidentes.first()).toContainText('Inicio 16/09/2026 16:20 · en curso hace 42 min');
    await expect(desempeno.incidentes.nth(1)).toContainText('Resuelto');
    await expect(desempeno.incidentes.nth(1)).toContainText('Inicio 08/09/2026 03:12 · duración 14 min');
    await verificarAccesibilidad(page);
  });

  test('no disponible hoy, resaltado distinto del degradado (CA-2)', async ({ page }) => {
    const desempeno = new DesempenoSocioPagina(page);
    await desempeno.simular({ '7d': OPERATIVO, today: NO_DISPONIBLE });
    await desempeno.abrirComoSocio();

    await desempeno.periodo('Hoy').click();

    await expect(desempeno.estado).toContainText('No disponible');
    await expect(desempeno.estado).toHaveClass(/estado--unavailable/);
    await expect(desempeno.disponibilidad).toContainText('97,5 %');
    await expect(desempeno.disponibilidad).toContainText('por debajo del objetivo');
    await expect(desempeno.incidentes).toHaveCount(1);
    await expect(desempeno.incidentes.first()).toContainText('No disponible · POST /v1/risk-profiles/resolve');
    await verificarAccesibilidad(page);
  });
});
