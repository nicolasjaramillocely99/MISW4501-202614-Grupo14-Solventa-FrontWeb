/**
 * Datos de las E2E del seguimiento de la intervención y del cierre del caso (HU-W2.3-02) con la forma de
 * `services/claims/api/openapi.yaml` v0.19.0 del backend y los datos del mockup O8: SIN-2026-01655, Servicios Hogar Norte.
 */
import { ID_CASO } from './evaluacion';

export { ID_CASO };

const ANALISTA = { email: 'andres.ruiz@solventa.example', name: 'Andrés Ruiz' };

const INFORME = {
  cause: 'Filtración por tubería del piso superior',
  damage: 'Techo y muro de cocina · 6 m²',
  repair_cost_minor: 435_000_000,
  repair_days: 2,
  photos: 8,
};

const paso = (step: string, ocurrido: string, extra: Record<string, unknown> = {}) => ({
  step,
  occurred_at: ocurrido,
  note: null,
  report: null,
  recorded_by: ANALISTA,
  recorded_at: ocurrido,
  ...extra,
});

const BASE = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01655',
  claim_status: 'in_evaluation',
  incident_type: 'water_damage',
  policy_id: 'HG-2025-880231',
  place: 'Carrera 15 # 93-40, Bogotá',
  assignment: {
    provider: {
      id: 'prv-servicios-hogar-norte',
      name: 'Servicios Hogar Norte',
      contact_email: 'despachos@hogarnorte.example.com',
      contact_phone: '+57 601 555 0102',
      distance_km: 2.3,
    },
    assigned_by: ANALISTA,
    assigned_at: '2026-09-06T15:15:00Z',
  },
  closure: null,
};

const HASTA_EN_CAMINO = [
  paso('accepted', '2026-09-06T15:40:00Z', { note: 'visita programada 15/09/2026 8:00 a 12:00' }),
  paso('en_route', '2026-09-15T12:50:00Z'),
];
const HASTA_LA_VISITA = [
  ...HASTA_EN_CAMINO,
  paso('visit_done', '2026-09-15T14:30:00Z', { report: INFORME }),
];

/** El prestador va en camino: falta la visita. */
export const EN_CAMINO = {
  ...BASE,
  state: 'in_progress',
  steps: HASTA_EN_CAMINO,
  next_step: 'visit_done',
  report: null,
  closable: false,
  missing: ['visit_done', 'repair_authorized', 'repair_executed'],
};

/** O8 del mockup: la visita reportada, la reparación por autorizar. */
export const VISITA_REPORTADA = {
  ...EN_CAMINO,
  steps: HASTA_LA_VISITA,
  next_step: 'repair_authorized',
  report: INFORME,
  missing: ['repair_authorized', 'repair_executed'],
};

export const TERMINADA = {
  ...VISITA_REPORTADA,
  state: 'ready_to_close',
  steps: [
    ...HASTA_LA_VISITA,
    paso('repair_authorized', '2026-09-16T21:40:00Z'),
    paso('repair_executed', '2026-09-18T21:00:00Z'),
  ],
  next_step: null,
  closable: true,
  missing: [],
};

export const CERRADA = {
  ...TERMINADA,
  state: 'closed',
  closable: false,
  closure: {
    result: 'repaired',
    closed_at: '2026-09-18T22:00:00Z',
    notes: 'Asegurada conforme',
    closed_by: ANALISTA,
    recorded_at: '2026-09-18T22:01:00Z',
  },
};
