import { IntervencionDto, PasoRegistradoDto } from '@core/api/siniestros/intervencion.modelos';

import { ANALISTA_DTO } from './asignacion-pruebas';
import { ID_EVALUADO } from './evaluacion-pruebas';

/**
 * Respuestas del seguimiento de la intervención (HU-W2.3-02) con la forma de `docs/contratos/HU-W2.3-02-api.md` del
 * backend (`openapi.yaml` v0.19.0) y los datos del mockup O8: SIN-2026-01655, Servicios Hogar Norte.
 */

const INFORME = {
  cause: 'Filtración por tubería del piso superior',
  damage: 'Techo y muro de cocina · 6 m²',
  repair_cost_minor: 435_000_000,
  repair_days: 2,
  photos: 8,
};

const paso = (
  step: PasoRegistradoDto['step'],
  ocurrido: string,
  extra: Partial<PasoRegistradoDto> = {},
) => ({
  step,
  occurred_at: ocurrido,
  note: null,
  report: null,
  recorded_by: ANALISTA_DTO,
  recorded_at: ocurrido,
  ...extra,
});

/** El caso recién asignado: falta el primer avance. */
export const INTERVENCION_ASIGNADA_DTO: IntervencionDto = {
  claim_id: ID_EVALUADO,
  filing_number: 'SIN-2026-01655',
  claim_status: 'in_evaluation',
  incident_type: 'water_damage',
  policy_id: 'HG-2025-880231',
  place: 'Carrera 15 # 93-40, Bogotá',
  state: 'in_progress',
  assignment: {
    provider: {
      id: 'prv-servicios-hogar-norte',
      name: 'Servicios Hogar Norte',
      contact_email: 'despachos@hogarnorte.example.com',
      contact_phone: '+57 601 555 0102',
      distance_km: 2.3,
    },
    assigned_by: ANALISTA_DTO,
    assigned_at: '2026-09-06T15:15:00Z',
  },
  steps: [],
  next_step: 'accepted',
  report: null,
  closure: null,
  closable: false,
  missing: ['accepted', 'en_route', 'visit_done', 'repair_authorized', 'repair_executed'],
};

const PASOS_HASTA_LA_VISITA = [
  paso('accepted', '2026-09-06T15:40:00Z', { note: 'visita programada 15/09/2026 8:00 a 12:00' }),
  paso('en_route', '2026-09-15T12:50:00Z'),
  paso('visit_done', '2026-09-15T14:30:00Z', { report: INFORME }),
];

/** O8 del mockup: la visita reportada y la reparación por autorizar. */
export const INTERVENCION_EN_CURSO_DTO: IntervencionDto = {
  ...INTERVENCION_ASIGNADA_DTO,
  steps: PASOS_HASTA_LA_VISITA,
  next_step: 'repair_authorized',
  report: INFORME,
  missing: ['repair_authorized', 'repair_executed'],
};

/** El prestador informó la intervención finalizada: el caso se puede cerrar. */
export const INTERVENCION_TERMINADA_DTO: IntervencionDto = {
  ...INTERVENCION_EN_CURSO_DTO,
  state: 'ready_to_close',
  steps: [
    ...PASOS_HASTA_LA_VISITA,
    paso('repair_authorized', '2026-09-16T21:40:00Z'),
    paso('repair_executed', '2026-09-18T21:00:00Z'),
  ],
  next_step: null,
  closable: true,
  missing: [],
};

export const INTERVENCION_CERRADA_DTO: IntervencionDto = {
  ...INTERVENCION_TERMINADA_DTO,
  state: 'closed',
  closable: false,
  closure: {
    result: 'repaired',
    closed_at: '2026-09-18T22:00:00Z',
    notes: 'Asegurada conforme',
    closed_by: ANALISTA_DTO,
    recorded_at: '2026-09-18T22:01:00Z',
  },
};

export const INTERVENCION_SIN_PRESTADOR_DTO: IntervencionDto = {
  ...INTERVENCION_ASIGNADA_DTO,
  state: 'not_assigned',
  assignment: null,
  next_step: null,
  missing: [],
};
