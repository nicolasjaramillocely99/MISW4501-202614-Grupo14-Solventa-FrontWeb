import { DesempenoApiDto } from '@core/api/socios/desempeno.modelos';

/**
 * Respuestas de `GET /v1/partner-performance` (contrato `HU-W3.2-03-api.md`) para las pruebas: la API degradada con un
 * incidente abierto y otro resuelto (mockup «API degradada e incidente abierto») y la API operativa sin incidentes.
 */
export const DESEMPENO_DEGRADADO_DTO: DesempenoApiDto = {
  period: '7d',
  from: '2026-09-10T05:00:00Z',
  to: '2026-09-17T03:30:00Z',
  status: 'degraded',
  availability: { percent: 99.96, objective_percent: 99.9, requests: 10000, server_errors: 4 },
  latency: { p95_ms: 1150, budget_ms: 400 },
  incidents: [
    {
      id: 'solventa-stg-slo-latency-post-offers-20260916T212000Z',
      kind: 'degraded',
      route: 'POST /v1/offers',
      started_at: '2026-09-16T21:20:00Z',
      ended_at: null,
      duration_seconds: 2520,
      resolved: false,
    },
    {
      id: 'solventa-stg-slo-errors-post-offers-20260908T081200Z',
      kind: 'unavailable',
      route: 'POST /v1/risk-profiles/resolve',
      started_at: '2026-09-08T08:12:00Z',
      ended_at: '2026-09-08T08:26:00Z',
      duration_seconds: 840,
      resolved: true,
    },
  ],
};

export const DESEMPENO_OPERATIVO_DTO: DesempenoApiDto = {
  period: '7d',
  from: '2026-09-10T05:00:00Z',
  to: '2026-09-17T03:30:00Z',
  status: 'operational',
  availability: { percent: 100, objective_percent: 99.9, requests: 8200, server_errors: 0 },
  latency: { p95_ms: 360, budget_ms: 400 },
  incidents: [],
};

export const DESEMPENO_NO_DISPONIBLE_DTO: DesempenoApiDto = {
  ...DESEMPENO_DEGRADADO_DTO,
  status: 'unavailable',
  availability: { percent: 97.5, objective_percent: 99.9, requests: 4000, server_errors: 100 },
};
