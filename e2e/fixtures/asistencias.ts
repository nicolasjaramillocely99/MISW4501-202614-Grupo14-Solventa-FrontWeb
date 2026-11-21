/**
 * Datos de las E2E de la atención de solicitudes de asistencia (HU-W2.3-03) con la forma de
 * `services/claims/api/openapi.yaml` v0.18.0 del backend, copiados de las respuestas capturadas de
 * `docs/contratos/HU-W2.3-03-api.md`: AST-2026-0001 con GPS en la Autopista Norte, AST-2026-0002 sin GPS en la vía
 * Cali–Palmira y AST-2026-0003 de Hogar. El analista es el de `sesion-por-rol.ts` (Andrés Ruiz), para que el portal lo
 * reconozca como quien atiende; Diana Torres es el segundo analista (`taken_over`).
 */
import { TESELA_VACIA } from './asignacion';

export { TESELA_VACIA };

type Cuerpo = Record<string, unknown>;

export const ANALISTA = { email: 'andres.ruiz@solventa.co', name: 'Andrés Ruiz' };
export const OTRA_ANALISTA = { email: 'diana.torres@solventa.co', name: 'Diana Torres' };

export const ID_CON_GPS = '184a52ab-8b1a-4715-ac8e-d124e121fe33';
export const ID_SIN_GPS = 'bc8adc67-47aa-47ed-bd0f-5a1466582d32';
export const ID_HOGAR = '9cef2741-03ec-4f85-a7df-8d75e9ecb6dc';
export const ID_VIAJE = '7a1c3e5b-9d2f-4b6a-8c0e-1f3a5c7e9b2d';
export const ID_NUEVA_LLEGADA = '2d4f6a8c-0e1b-4d3f-a5c7-9e1b3d5f7a9c';
export const ID_EN_LLAMADA = '5f0e9a3c-2b7d-4c1e-9a8f-3d6b2c1e0f4a';

export const POLITICA = {
  version: 'assistance-policy-v1',
  needs: [
    { line: 'auto', code: 'towing', specialty: 'towing' },
    { line: 'auto', code: 'battery', specialty: 'roadside_assistance' },
    { line: 'auto', code: 'flat_tire', specialty: 'roadside_assistance' },
    { line: 'auto', code: 'fuel', specialty: 'roadside_assistance' },
    { line: 'auto', code: 'vehicle_lockout', specialty: 'roadside_assistance' },
    { line: 'home', code: 'plumbing_emergency', specialty: 'plumbing' },
  ],
  radii_km: [5, 10, 20],
  assignment_policy_version: 'assignment-policy-v1',
  eta: { preparation_minutes: 10, average_speed_kmh: 30 },
  close_reasons: [
    'resolved_by_phone',
    'duplicate',
    'cancelled_by_insured',
    'not_covered',
    'no_provider_available',
    'other',
  ],
  dispatch_target_seconds: 300,
};

const POLIZA_AUTO = {
  policy_id: 'AU-2026-868766',
  line: 'auto',
  product: 'Autos',
  insured_object: 'IZJ-766',
};

const UBICACION_APP = {
  status: 'sent',
  latitude: 4.7712,
  longitude: -74.0452,
  accuracy_m: 8,
  captured_at: '2026-11-21T16:16:04Z',
  unavailable_reason: null,
  place: 'Autopista Norte km 12, Bogotá',
  voice: null,
};

const SIN_UBICACION = {
  status: 'unavailable',
  latitude: null,
  longitude: null,
  accuracy_m: null,
  captured_at: null,
  unavailable_reason: 'no_fix',
  place: null,
  voice: null,
};

const UBICACION_POR_VOZ = {
  ...SIN_UBICACION,
  voice: {
    address: 'Vía Cali–Palmira km 4',
    latitude: 3.4921,
    longitude: -76.4203,
    recorded_by: ANALISTA,
    recorded_at: '2026-11-21T16:16:11.513872Z',
  },
};

// --- Bandeja ------------------------------------------------------------------------------------------------------

export const FILA_CON_GPS = {
  request_id: ID_CON_GPS,
  request_number: 'AST-2026-0001',
  status: 'new',
  requester_name: 'Carolina Pérez',
  policy: POLIZA_AUTO,
  location: UBICACION_APP,
  requested_at: '2026-11-21T16:16:10.985834Z',
  handled_by: null,
  dispatched_at: null,
  closed_at: null,
};

export const FILA_SIN_GPS = {
  ...FILA_CON_GPS,
  request_id: ID_SIN_GPS,
  request_number: 'AST-2026-0002',
  location: SIN_UBICACION,
  requested_at: '2026-11-21T16:16:11.023796Z',
};

/** Una solicitud de Cali que Diana Torres atiende y ya ubicó por voz. */
export const FILA_EN_LLAMADA = {
  ...FILA_SIN_GPS,
  request_id: ID_EN_LLAMADA,
  request_number: 'AST-2026-0004',
  status: 'in_call',
  location: {
    ...UBICACION_POR_VOZ,
    voice: { ...UBICACION_POR_VOZ.voice, recorded_by: OTRA_ANALISTA },
  },
  handled_by: OTRA_ANALISTA,
  requested_at: '2026-11-21T16:10:00Z',
};

export const FILA_HOGAR_CERRADA = {
  request_id: ID_HOGAR,
  request_number: 'AST-2026-0003',
  status: 'closed',
  requester_name: 'Carolina Pérez',
  policy: {
    policy_id: 'HG-2026-266966',
    line: 'home',
    product: 'Hogar',
    insured_object: 'Calle 26 # 47-47, Bogotá',
  },
  location: { ...SIN_UBICACION, unavailable_reason: 'permission_denied' },
  requested_at: '2026-11-21T16:00:20Z',
  handled_by: null,
  dispatched_at: null,
  closed_at: '2026-11-21T16:01:20Z',
};

const RESUMEN = {
  new_count: 2,
  in_call_count: 1,
  dispatched_today: 6,
  mean_dispatch_seconds_today: 220,
  dispatch_target_seconds: 300,
};

export const BANDEJA = {
  summary: RESUMEN,
  items: [FILA_SIN_GPS, FILA_CON_GPS, FILA_EN_LLAMADA, FILA_HOGAR_CERRADA],
};

/** La bandeja medio minuto después: llegó AST-2026-0005 desde la app. */
export const BANDEJA_CON_NUEVA = {
  summary: { ...RESUMEN, new_count: 3 },
  items: [
    {
      ...FILA_CON_GPS,
      request_id: ID_NUEVA_LLEGADA,
      request_number: 'AST-2026-0005',
      requester_name: 'Diego Salazar Peña',
      location: { ...UBICACION_APP, latitude: 4.6822, longitude: -74.0452, place: null },
      requested_at: '2026-11-21T16:20:00Z',
    },
    ...BANDEJA.items,
  ],
};

// --- Sugerencias --------------------------------------------------------------------------------------------------

const SIN_BUSQUEDA = {
  specialty: null,
  location_source: null,
  from_radius_km: null,
  radius_km: null,
  reason: null,
  policy_version: 'assignment-policy-v1',
  attempts: [],
  candidates: [],
};

const candidato = (
  provider_id: string,
  name: string,
  specialties: string[],
  distance_km: number,
  eta_minutes: number,
  eligibility: string,
  suggested = false,
  dispatched_today = 0,
) => ({
  provider_id,
  name,
  specialties,
  distance_km,
  availability: 'available',
  unavailable_until: null,
  eligibility,
  suggested,
  eta_minutes,
  dispatched_today,
});

export const SUGERENCIA_ENCONTRADA = {
  state: 'found',
  specialty: 'towing',
  location_source: 'app',
  from_radius_km: 5,
  radius_km: 5,
  reason: null,
  policy_version: 'assignment-policy-v1',
  attempts: [{ radius_km: 5, eligible_count: 2, attempted_at: '2026-11-21T16:16:11.3Z' }],
  candidates: [
    candidato(
      'prv-gruas-autopista-norte',
      'Grúas Autopista Norte',
      ['towing'],
      0.9,
      12,
      'eligible',
      true,
      2,
    ),
    candidato(
      'prv-auxilio-vial-norte',
      'Auxilio Vial Norte',
      ['roadside_assistance', 'towing'],
      2.2,
      15,
      'eligible',
    ),
    candidato('prv-gruas-calle-80', 'Grúas Calle 80', ['towing'], 9.9, 30, 'out_of_radius'),
    candidato(
      'prv-gruas-del-valle',
      'Grúas del Valle',
      ['towing', 'roadside_assistance'],
      297.6,
      606,
      'out_of_radius',
    ),
  ],
};

/** Tras el `422 provider_not_eligible`: el sugerido se ocupó y ahora sugiere Auxilio Vial Norte. */
export const SUGERENCIA_ACTUALIZADA = {
  ...SUGERENCIA_ENCONTRADA,
  attempts: [{ radius_km: 5, eligible_count: 1, attempted_at: '2026-11-21T16:17:00Z' }],
  candidates: [
    {
      ...SUGERENCIA_ENCONTRADA.candidates[0],
      eligibility: 'unavailable',
      availability: 'unavailable',
      suggested: false,
    },
    { ...SUGERENCIA_ENCONTRADA.candidates[1], suggested: true },
    ...SUGERENCIA_ENCONTRADA.candidates.slice(2),
  ],
};

export const SUGERENCIA_POR_VOZ = {
  ...SUGERENCIA_ENCONTRADA,
  location_source: 'voice',
  attempts: [{ radius_km: 5, eligible_count: 1, attempted_at: '2026-11-21T16:16:11.5Z' }],
  candidates: [
    candidato(
      'prv-gruas-del-valle',
      'Grúas del Valle',
      ['towing', 'roadside_assistance'],
      1.9,
      14,
      'eligible',
      true,
    ),
    candidato('prv-gruas-calle-80', 'Grúas Calle 80', ['towing'], 294.8, 600, 'out_of_radius'),
  ],
};

export const SUGERENCIA_AGOTADA = {
  ...SUGERENCIA_ENCONTRADA,
  state: 'exhausted',
  radius_km: 20,
  reason: 'no_eligible_provider_within_max_radius',
  attempts: [
    { radius_km: 5, eligible_count: 0, attempted_at: '2026-11-21T16:16:11.3Z' },
    { radius_km: 10, eligible_count: 0, attempted_at: '2026-11-21T16:16:11.31Z' },
    { radius_km: 20, eligible_count: 0, attempted_at: '2026-11-21T16:16:11.32Z' },
  ],
  candidates: [
    candidato('prv-gruas-del-valle', 'Grúas del Valle', ['towing'], 297.6, 606, 'out_of_radius'),
  ],
};

// --- Detalles -----------------------------------------------------------------------------------------------------

const ATENDIDA = { action: 'attended', by: ANALISTA, at: '2026-11-21T16:16:11Z', detail: null };
const NECESIDAD_GRUA = {
  action: 'need_recorded',
  by: ANALISTA,
  at: '2026-11-21T16:16:40Z',
  detail: { need: 'towing' },
};
const NECESIDAD = {
  code: 'towing',
  specialty: 'towing',
  recorded_by: ANALISTA,
  recorded_at: '2026-11-21T16:16:40Z',
};

export const NUEVA: Cuerpo = {
  ...FILA_CON_GPS,
  need: null,
  suggestion: { state: 'need_missing', ...SIN_BUSQUEDA },
  dispatch: null,
  closure: null,
  history: [],
};

export const ATENDIDA_SIN_NECESIDAD: Cuerpo = {
  ...NUEVA,
  status: 'in_call',
  handled_by: ANALISTA,
  history: [ATENDIDA],
};

export const CON_SUGERENCIA: Cuerpo = {
  ...ATENDIDA_SIN_NECESIDAD,
  need: NECESIDAD,
  suggestion: SUGERENCIA_ENCONTRADA,
  history: [ATENDIDA, NECESIDAD_GRUA],
};

export const CON_SUGERENCIA_ACTUALIZADA: Cuerpo = {
  ...CON_SUGERENCIA,
  suggestion: SUGERENCIA_ACTUALIZADA,
};

export const AGOTADA: Cuerpo = { ...CON_SUGERENCIA, suggestion: SUGERENCIA_AGOTADA };

const DESPACHO = {
  provider: {
    id: 'prv-gruas-autopista-norte',
    name: 'Grúas Autopista Norte',
    contact_email: 'despachos@gruasautopistanorte.example.com',
    contact_phone: '+576015550301',
  },
  need: 'towing',
  specialty: 'towing',
  distance_km: 0.9,
  eta_minutes: 12,
  location_shared: {
    source: 'app',
    latitude: 4.7712,
    longitude: -74.0452,
    accuracy_m: 8,
    address: null,
    place: 'Autopista Norte km 12, Bogotá',
  },
  suggested_provider_id: 'prv-gruas-autopista-norte',
  dispatched_by: ANALISTA,
  dispatched_at: '2026-11-21T16:17:30Z',
  policy_versions: { assistance: 'assistance-policy-v1', assignment: 'assignment-policy-v1' },
  notice: { status: 'pending', attempts: 0, sent_at: null },
};

export const DESPACHADA: Cuerpo = {
  ...CON_SUGERENCIA,
  status: 'dispatched',
  dispatched_at: '2026-11-21T16:17:30Z',
  suggestion: { state: 'not_applicable', ...SIN_BUSQUEDA },
  dispatch: DESPACHO,
  history: [
    ATENDIDA,
    NECESIDAD_GRUA,
    {
      action: 'dispatched',
      by: ANALISTA,
      at: '2026-11-21T16:17:30Z',
      detail: { provider_id: 'prv-gruas-autopista-norte' },
    },
  ],
};

export const AVISADA: Cuerpo = {
  ...DESPACHADA,
  dispatch: {
    ...DESPACHO,
    notice: { status: 'sent', attempts: 1, sent_at: '2026-11-21T16:17:35Z' },
  },
};

/** Otro analista la despachó mientras Andrés tenía el diálogo abierto (`409 assistance_not_open`). */
export const DESPACHADA_POR_OTRA: Cuerpo = {
  ...AVISADA,
  handled_by: OTRA_ANALISTA,
  dispatch: {
    ...DESPACHO,
    provider: { ...DESPACHO.provider, id: 'prv-auxilio-vial-norte', name: 'Auxilio Vial Norte' },
    distance_km: 2.2,
    eta_minutes: 15,
    dispatched_by: OTRA_ANALISTA,
    notice: { status: 'sent', attempts: 1, sent_at: '2026-11-21T16:17:35Z' },
  },
  history: [
    ATENDIDA,
    NECESIDAD_GRUA,
    {
      action: 'taken_over',
      by: OTRA_ANALISTA,
      at: '2026-11-21T16:17:00Z',
      detail: { from: ANALISTA.email },
    },
    {
      action: 'dispatched',
      by: OTRA_ANALISTA,
      at: '2026-11-21T16:17:30Z',
      detail: { provider_id: 'prv-auxilio-vial-norte' },
    },
  ],
};

export const CERRADA_OTRO: Cuerpo = {
  ...CON_SUGERENCIA,
  status: 'closed',
  closed_at: '2026-11-21T16:18:00Z',
  suggestion: { state: 'not_applicable', ...SIN_BUSQUEDA },
  closure: {
    reason: 'other',
    note: 'El asegurado consiguió quien le pasara corriente',
    closed_by: ANALISTA,
    closed_at: '2026-11-21T16:18:00Z',
  },
  history: [
    ATENDIDA,
    NECESIDAD_GRUA,
    { action: 'closed', by: ANALISTA, at: '2026-11-21T16:18:00Z', detail: { reason: 'other' } },
  ],
};

/** AST-2026-0002 atendida por Andrés, sin GPS ni ubicación por voz: la ubicación tiene prioridad. */
export const SIN_GPS_EN_LLAMADA: Cuerpo = {
  ...FILA_SIN_GPS,
  status: 'in_call',
  handled_by: ANALISTA,
  need: NECESIDAD,
  suggestion: { state: 'location_missing', ...SIN_BUSQUEDA },
  dispatch: null,
  closure: null,
  history: [ATENDIDA, NECESIDAD_GRUA],
};

export const UBICADA_POR_VOZ: Cuerpo = {
  ...SIN_GPS_EN_LLAMADA,
  location: UBICACION_POR_VOZ,
  suggestion: SUGERENCIA_POR_VOZ,
  history: [
    ATENDIDA,
    NECESIDAD_GRUA,
    { action: 'voice_location_recorded', by: ANALISTA, at: '2026-11-21T16:16:11.5Z', detail: null },
  ],
};

export const HOGAR_NUEVA: Cuerpo = {
  ...FILA_HOGAR_CERRADA,
  status: 'new',
  closed_at: null,
  need: null,
  suggestion: { state: 'location_missing', ...SIN_BUSQUEDA },
  dispatch: null,
  closure: null,
  history: [],
};

export const HOGAR_CERRADA: Cuerpo = {
  ...FILA_HOGAR_CERRADA,
  need: null,
  suggestion: { state: 'not_applicable', ...SIN_BUSQUEDA },
  dispatch: null,
  closure: {
    reason: 'resolved_by_phone',
    note: null,
    closed_by: ANALISTA,
    closed_at: '2026-11-21T16:01:20Z',
  },
  history: [
    {
      action: 'closed',
      by: ANALISTA,
      at: '2026-11-21T16:01:20Z',
      detail: { reason: 'resolved_by_phone' },
    },
  ],
};

export const VIAJE: Cuerpo = {
  ...ATENDIDA_SIN_NECESIDAD,
  request_id: ID_VIAJE,
  request_number: 'AST-2026-0006',
  policy: {
    policy_id: 'VJ-2026-110233',
    line: 'travel',
    product: 'Viajes',
    insured_object: 'Bogotá–Lima',
  },
};

// --- Registro de prestadores (semilla `0015`) -----------------------------------------------------------------------

const prestador = (
  id: string,
  name: string,
  specialties: string[],
  latitude: number,
  longitude: number,
) => ({
  id,
  name,
  specialties,
  latitude,
  longitude,
  address: 'Bogotá',
  contact_email: `despachos@${id}.example.com`,
  contact_phone: null,
  availability: 'available',
  unavailable_until: null,
  busy_claim_id: null,
  updated_by: 'reference-data',
  updated_at: '2026-11-15T00:00:00Z',
});

export const PRESTADORES_ASISTENCIA = [
  prestador(
    'prv-auxilio-vial-norte',
    'Auxilio Vial Norte',
    ['roadside_assistance', 'towing'],
    4.7514,
    -74.0452,
  ),
  prestador('prv-gruas-autopista-norte', 'Grúas Autopista Norte', ['towing'], 4.7793, -74.0452),
  prestador('prv-gruas-calle-80', 'Grúas Calle 80', ['towing'], 4.6822, -74.0452),
  prestador(
    'prv-gruas-del-valle',
    'Grúas del Valle',
    ['towing', 'roadside_assistance'],
    3.506,
    -76.41,
  ),
];
