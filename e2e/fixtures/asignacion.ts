/**
 * Datos de las E2E de la asignación del prestador más cercano (HU-W2.3-01) con la forma de
 * `services/claims/api/openapi.yaml` v0.11.0 del backend y los datos del mockup (O7 y O7b): SIN-2026-01655, daño por agua
 * en 4,6771 N · 74,0483 O. Se reemplazan por respuestas capturadas del binario cuando el backend cierre su Fase E.
 */
import { ID_CASO } from './evaluacion';

export { ID_CASO };

/** Mañana en Bogotá (la zona de las E2E), `YYYY-MM-DD`: «Disponible mañana» se calcula contra el día del navegador. */
export const MANANA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
  new Date(Date.now() + 86_400_000),
);

const ANALISTA = { email: 'andres.ruiz@solventa.example', name: 'Andrés Ruiz' };

export const POLITICA = {
  version: 'assignment-policy-v1',
  radii_km: [5, 10, 20],
  initial_radius_km: 5,
  max_radius_km: 20,
  specialties: [
    { line: 'auto', incident_type: 'collision', specialty: 'vehicle_assessment' },
    { line: 'auto', incident_type: 'theft', specialty: null },
    { line: 'home', incident_type: 'water_damage', specialty: 'plumbing' },
  ],
  retry_interval_seconds: 300,
};

const UBICACION_APP = {
  source: 'app',
  latitude: 4.6771,
  longitude: -74.0483,
  accuracy_m: 8,
  address: null,
  recorded_by: null,
  recorded_at: '2026-09-06T14:52:10Z',
};

/** Caso con las coordenadas de la app, sin búsqueda. */
export const LISTA = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01655',
  claim_status: 'in_evaluation',
  incident_type: 'water_damage',
  line: 'home',
  state: 'ready',
  specialty: 'plumbing',
  policy_version: 'assignment-policy-v1',
  location: UBICACION_APP,
  last_search: null,
  assignment: null,
};

const CANDIDATOS = [
  {
    provider_id: 'prv-servicios-hogar-norte',
    name: 'Servicios Hogar Norte',
    specialties: ['plumbing', 'damp_proofing'],
    distance_km: 2.3,
    availability: 'available',
    unavailable_until: null,
    eligibility: 'eligible',
    suggested: true,
  },
  {
    provider_id: 'prv-reparaciones-chapinero',
    name: 'Reparaciones Chapinero',
    specialties: ['plumbing'],
    distance_km: 3.8,
    availability: 'unavailable',
    unavailable_until: MANANA,
    eligibility: 'unavailable',
    suggested: false,
  },
  {
    provider_id: 'prv-tecnicos-unidos',
    name: 'Técnicos Unidos',
    specialties: ['plumbing', 'damp_proofing', 'painting'],
    distance_km: 6.1,
    availability: 'available',
    unavailable_until: null,
    eligibility: 'out_of_radius',
    suggested: false,
  },
];

const BUSQUEDA = {
  seq: 1,
  trigger: 'analyst',
  searched_by: ANALISTA,
  specialty: 'plumbing',
  location: { source: 'app', latitude: 4.6771, longitude: -74.0483 },
  from_radius_km: 5,
  outcome: 'found',
  radius_km: 5,
  reason: null,
  policy_version: 'assignment-policy-v1',
  searched_at: '2026-09-06T15:14:02Z',
  attempts: [{ radius_km: 5, eligible_count: 1, attempted_at: '2026-09-06T15:14:02Z' }],
  candidates: CANDIDATOS,
};

/** O7: elegibles en 5 km. */
export const PROPUESTA = { ...LISTA, state: 'proposed', last_search: BUSQUEDA };

/** «Ampliar radio» desde 10 km: «Técnicos Unidos» ya entra y es el único elegible además del sugerido. */
export const PROPUESTA_AMPLIADA = {
  ...PROPUESTA,
  last_search: {
    ...BUSQUEDA,
    seq: 2,
    from_radius_km: 10,
    radius_km: 10,
    attempts: [{ radius_km: 10, eligible_count: 2, attempted_at: '2026-09-06T15:20:00Z' }],
    candidates: CANDIDATOS.map((c) =>
      c.eligibility === 'out_of_radius' ? { ...c, eligibility: 'eligible' } : c,
    ),
  },
};

/** O7b: nadie disponible hasta 20 km. */
export const PENDIENTE = {
  ...LISTA,
  state: 'pending_assignment',
  last_search: {
    ...BUSQUEDA,
    seq: 2,
    outcome: 'exhausted',
    radius_km: 20,
    reason: 'no_eligible_provider_within_max_radius',
    searched_at: '2026-09-06T16:42:00Z',
    attempts: [
      { radius_km: 5, eligible_count: 0, attempted_at: '2026-09-06T16:40:00Z' },
      { radius_km: 10, eligible_count: 0, attempted_at: '2026-09-06T16:41:00Z' },
      { radius_km: 20, eligible_count: 0, attempted_at: '2026-09-06T16:42:00Z' },
    ],
    candidates: [
      { ...CANDIDATOS[0], availability: 'busy', eligibility: 'unavailable', suggested: false },
      { ...CANDIDATOS[1], unavailable_until: '2026-09-22' },
    ],
  },
};

const ASIGNACION = {
  provider: {
    id: 'prv-servicios-hogar-norte',
    name: 'Servicios Hogar Norte',
    contact_email: 'despachos@hogarnorte.example.com',
    contact_phone: '+576015550102',
  },
  assigned_by: ANALISTA,
  assigned_at: '2026-09-06T15:15:31Z',
  distance_km: 2.3,
  search_seq: 1,
  location_shared: {
    source: 'app',
    latitude: 4.6771,
    longitude: -74.0483,
    accuracy_m: 8,
    address: null,
  },
  policy_version: 'assignment-policy-v1',
  notice: { status: 'pending', attempts: 0, sent_at: null },
};

/** Prestador confirmado; el correo aún no sale. */
export const ASIGNADA = { ...PROPUESTA, state: 'assigned', assignment: ASIGNACION };
export const AVISADA = {
  ...ASIGNADA,
  assignment: {
    ...ASIGNACION,
    notice: { status: 'sent', attempts: 1, sent_at: '2026-09-06T15:16:02Z' },
  },
};

/** Caso web sin coordenadas: el analista registra la dirección y el pin (CA-1). */
export const SIN_UBICACION = { ...LISTA, state: 'location_missing', location: null };
export const UBICADA_POR_ANALISTA = {
  ...LISTA,
  location: {
    source: 'analyst',
    latitude: 4.6771,
    longitude: -74.0483,
    accuracy_m: null,
    address: 'Carrera 15 # 93-40, apto 402, Bogotá',
    recorded_by: ANALISTA,
    recorded_at: '2026-09-06T15:10:44Z',
  },
};

/** Hurto: sin visita. */
export const SIN_VISITA = {
  ...LISTA,
  incident_type: 'theft',
  line: 'auto',
  state: 'not_required',
  specialty: null,
};

const PRESTADOR = {
  id: 'prv-servicios-hogar-norte',
  name: 'Servicios Hogar Norte',
  specialties: ['plumbing', 'damp_proofing'],
  latitude: 4.6912,
  longitude: -74.0391,
  address: 'Calle 106 # 18-35, Bogotá',
  contact_email: 'despachos@hogarnorte.example.com',
  contact_phone: '+576015550102',
  availability: 'available',
  unavailable_until: null,
  busy_claim_id: null,
  updated_by: 'reference-data',
  updated_at: '2026-11-07T00:00:00Z',
};

/** El registro: los tres del mockup cerca del incidente y uno de peritaje vehicular. */
export const PRESTADORES = [
  PRESTADOR,
  {
    ...PRESTADOR,
    id: 'prv-reparaciones-chapinero',
    name: 'Reparaciones Chapinero',
    specialties: ['plumbing'],
    latitude: 4.6452,
    longitude: -74.0602,
    address: 'Carrera 7 # 63-20, Bogotá',
    contact_email: 'agenda@repchapinero.example.com',
    contact_phone: null,
    availability: 'unavailable',
    unavailable_until: '2026-09-07',
  },
  {
    ...PRESTADOR,
    id: 'prv-tecnicos-unidos',
    name: 'Técnicos Unidos',
    specialties: ['plumbing', 'damp_proofing', 'painting'],
    latitude: 4.7302,
    longitude: -74.0421,
    address: 'Calle 140 # 11-45, Bogotá',
    contact_email: 'servicio@tecnicosunidos.example.com',
    availability: 'busy',
    busy_claim_id: '0b5c2d9e-3a41-4f6e-9c1d-7e2f8a9b0c11',
    updated_by: 'andres.ruiz@solventa.example',
  },
  {
    ...PRESTADOR,
    id: 'prv-peritos-norte',
    name: 'Peritos del Norte',
    specialties: ['vehicle_assessment'],
    latitude: 4.7012,
    longitude: -74.0501,
    address: 'Autopista Norte # 122-30, Bogotá',
    contact_email: 'citas@peritosnorte.example.com',
  },
];

/** Tesela PNG transparente de 1 × 1: las E2E no salen a OpenStreetMap. */
export const TESELA_VACIA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
