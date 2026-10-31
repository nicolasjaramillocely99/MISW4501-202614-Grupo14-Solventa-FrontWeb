import {
  PaginaTriageDto,
  PoliticaTriageDto,
  TriageSiniestroDto,
} from '@core/api/siniestros/triage.modelos';

/**
 * Datos de prueba de la prioridad automática del siniestro con la forma del contrato de HU-W2.2-01
 * (`docs/contratos/HU-W2.2-01-api.md` del backend, política `triage-policy-v1`). Los identificadores, montos y fechas
 * son los de las respuestas capturadas en ese contrato.
 */

export const ID_CASO_TRIAGE = 'c6dd0d52-73b3-495e-8fb2-291f8bf6214e';
export const ID_CASO_TRIAGE_2 = 'c762e410-b71c-4536-8951-f130504290fe';
export const ID_CASO_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

const OBJETIVO_INMEDIATO = { kind: 'immediate', business_days: null, resolution_business_days: 2 } as const;
const OBJETIVO_5 = { kind: 'business_days', business_days: 5, resolution_business_days: 5 } as const;
const OBJETIVO_10 = { kind: 'business_days', business_days: 10, resolution_business_days: 10 } as const;

/** Vista `operations`: daño por agua radicado con $ 4.800.000 (Triage 2) y recalculado a Triage 1 al subir el monto. */
export const TRIAGE_OPERACIONES_DTO: TriageSiniestroDto = {
  view: 'operations',
  claim_id: ID_CASO_TRIAGE,
  state: 'assessed',
  current: {
    level: 1,
    severity: 'medium',
    amount_band: 'high',
    estimated_amount_minor: 4000000000,
    currency: 'COP',
    incident_type: 'water_damage',
    coverage: 'water_damage',
    policy_version: 'triage-policy-v1',
    target: OBJETIVO_INMEDIATO,
    assessed_at: '2026-10-31T04:20:38.278329Z',
  },
  history: [
    {
      level: 1,
      previous_level: 2,
      severity: 'medium',
      amount_band: 'high',
      estimated_amount_minor: 4000000000,
      incident_type: 'water_damage',
      causes: ['estimated_amount_changed'],
      actor: 'system',
      policy_version: 'triage-policy-v1',
      assessed_at: '2026-10-31T04:20:38.278329Z',
    },
    {
      level: 2,
      previous_level: null,
      severity: 'medium',
      amount_band: 'low',
      estimated_amount_minor: 480000000,
      incident_type: 'water_damage',
      causes: ['entered_evaluation'],
      actor: 'system',
      policy_version: 'triage-policy-v1',
      assessed_at: '2026-10-31T04:20:28.282377Z',
    },
  ],
};

/** Vista `operations` de un caso que aún no tiene nivel. */
export const TRIAGE_OPERACIONES_PENDIENTE_DTO: TriageSiniestroDto = {
  view: 'operations',
  claim_id: ID_CASO_TRIAGE,
  state: 'pending',
  current: null,
  history: [],
};

/** Vista `insured` con nivel (Triage 3, 10 días hábiles). */
export const TRIAGE_ASEGURADO_DTO: TriageSiniestroDto = {
  view: 'insured',
  claim_id: '8cde7aff-a3ed-4e19-8b9a-ba25f33d6b6a',
  state: 'assessed',
  level: 3,
  estimated_resolution_business_days: 10,
  assessed_at: '2026-10-31T04:20:36.276289Z',
};

/** Vista `insured` segundos después de radicar. */
export const TRIAGE_ASEGURADO_PENDIENTE_DTO: TriageSiniestroDto = {
  view: 'insured',
  claim_id: 'c3ada1e6-6394-43c7-a678-ae7a86f41898',
  state: 'pending',
  level: null,
  estimated_resolution_business_days: null,
  assessed_at: null,
};

/** Lote de tres ids: dos con nivel y uno que no existe. */
export const LOTE_TRIAGE_DTO: PaginaTriageDto = {
  items: [
    {
      claim_id: ID_CASO_TRIAGE,
      state: 'assessed',
      level: 1,
      severity: 'medium',
      amount_band: 'high',
      target: OBJETIVO_INMEDIATO,
      assessed_at: '2026-10-31T04:20:38.278329Z',
    },
    {
      claim_id: ID_CASO_TRIAGE_2,
      state: 'assessed',
      level: 1,
      severity: 'high',
      amount_band: 'unknown',
      target: OBJETIVO_INMEDIATO,
      assessed_at: '2026-10-31T04:20:30.281473Z',
    },
    {
      claim_id: ID_CASO_INEXISTENTE,
      state: 'not_found',
      level: null,
      severity: null,
      amount_band: null,
      target: null,
      assessed_at: null,
    },
  ],
};

/** Política vigente `triage-policy-v1`. */
export const POLITICA_TRIAGE_DTO: PoliticaTriageDto = {
  version: 'triage-policy-v1',
  currency: 'COP',
  amount_thresholds: { low_below_minor: 500000000, high_above_minor: 3000000000 },
  severity: [
    { line: 'auto', incident_type: 'collision', severity: 'medium' },
    { line: 'auto', incident_type: 'theft', severity: 'high' },
    { line: 'auto', incident_type: 'third_party_damage', severity: 'high' },
    { line: 'auto', incident_type: 'glass', severity: 'low' },
    { line: 'auto', incident_type: 'other', severity: 'medium' },
    { line: 'home', incident_type: 'water_damage', severity: 'medium' },
  ],
  targets: [
    { level: 1, target: OBJETIVO_INMEDIATO },
    { level: 2, target: OBJETIVO_5 },
    { level: 3, target: OBJETIVO_10 },
  ],
};
