import {
  AsignacionSiniestroDto,
  BusquedaPrestadorDto,
  PaginaAsignacionesDto,
  PoliticaAsignacionDto,
  PrestadorDto,
} from '@core/api/siniestros/asignacion.modelos';

import { ID_EVALUADO } from './evaluacion-pruebas';

/**
 * Respuestas de la asignación del prestador (HU-W2.3-01) con la forma de `docs/contratos/HU-W2.3-01-api.md` del backend
 * (`openapi.yaml` v0.11.0), con los datos del mockup: SIN-2026-01655, daño por agua en Bogotá. Se reemplazan por las
 * respuestas capturadas del binario cuando el backend cierre su Fase E.
 */

export const ANALISTA_DTO = { email: 'andres.ruiz@solventa.example', name: 'Andrés Ruiz' };

export const POLITICA_ASIGNACION_DTO: PoliticaAsignacionDto = {
  version: 'assignment-policy-v1',
  radii_km: [5, 10, 20],
  initial_radius_km: 5,
  max_radius_km: 20,
  specialties: [
    { line: 'auto', incident_type: 'collision', specialty: 'vehicle_assessment' },
    { line: 'auto', incident_type: 'theft', specialty: null },
    { line: 'auto', incident_type: 'third_party_damage', specialty: 'vehicle_assessment' },
    { line: 'auto', incident_type: 'glass', specialty: 'auto_glass' },
    { line: 'auto', incident_type: 'other', specialty: 'vehicle_assessment' },
    { line: 'home', incident_type: 'water_damage', specialty: 'plumbing' },
  ],
  retry_interval_seconds: 300,
};

const UBICACION_APP = {
  source: 'app' as const,
  latitude: 4.6771,
  longitude: -74.0483,
  accuracy_m: 8,
  address: null,
  recorded_by: null,
  recorded_at: '2026-09-06T14:52:10Z',
};

/** Caso con coordenadas de la app y sin búsqueda. */
export const ASIGNACION_LISTA_DTO: AsignacionSiniestroDto = {
  claim_id: ID_EVALUADO,
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

export const BUSQUEDA_ENCONTRADA_DTO: BusquedaPrestadorDto = {
  seq: 1,
  trigger: 'analyst',
  searched_by: ANALISTA_DTO,
  specialty: 'plumbing',
  location: { source: 'app', latitude: 4.6771, longitude: -74.0483 },
  from_radius_km: 5,
  outcome: 'found',
  radius_km: 5,
  reason: null,
  policy_version: 'assignment-policy-v1',
  searched_at: '2026-09-06T15:14:02Z',
  attempts: [{ radius_km: 5, eligible_count: 1, attempted_at: '2026-09-06T15:14:02Z' }],
  candidates: [
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
      unavailable_until: '2026-09-07',
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
  ],
};

/** O7: la búsqueda encontró elegibles en 5 km. */
export const ASIGNACION_PROPUESTA_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_LISTA_DTO,
  state: 'proposed',
  last_search: BUSQUEDA_ENCONTRADA_DTO,
};

/** O7b: ningún elegible hasta 20 km. */
export const ASIGNACION_PENDIENTE_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_LISTA_DTO,
  state: 'pending_assignment',
  last_search: {
    ...BUSQUEDA_ENCONTRADA_DTO,
    seq: 2,
    outcome: 'exhausted',
    radius_km: 20,
    reason: 'no_eligible_provider_within_max_radius',
    searched_at: '2026-09-06T16:42:00Z',
    attempts: [
      { radius_km: 5, eligible_count: 0, attempted_at: '2026-09-06T16:42:00Z' },
      { radius_km: 10, eligible_count: 0, attempted_at: '2026-09-06T16:42:00Z' },
      { radius_km: 20, eligible_count: 0, attempted_at: '2026-09-06T16:42:00Z' },
    ],
    candidates: [
      {
        provider_id: 'prv-servicios-hogar-norte',
        name: 'Servicios Hogar Norte',
        specialties: ['plumbing', 'damp_proofing'],
        distance_km: 2.3,
        availability: 'busy',
        unavailable_until: null,
        eligibility: 'unavailable',
        suggested: false,
      },
      {
        provider_id: 'prv-reparaciones-chapinero',
        name: 'Reparaciones Chapinero',
        specialties: ['plumbing'],
        distance_km: 3.8,
        availability: 'unavailable',
        unavailable_until: '2026-09-22',
        eligibility: 'unavailable',
        suggested: false,
      },
    ],
  },
};

const ASIGNACION_CONFIRMADA: NonNullable<AsignacionSiniestroDto['assignment']> = {
  provider: {
    id: 'prv-servicios-hogar-norte',
    name: 'Servicios Hogar Norte',
    contact_email: 'despachos@hogarnorte.example.com',
    contact_phone: '+576015550102',
  },
  assigned_by: ANALISTA_DTO,
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

/** Prestador confirmado; el correo al prestador aún no sale. */
export const ASIGNACION_ASIGNADA_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_PROPUESTA_DTO,
  state: 'assigned',
  assignment: ASIGNACION_CONFIRMADA,
};

export const ASIGNACION_AVISADA_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_ASIGNADA_DTO,
  assignment: {
    ...ASIGNACION_CONFIRMADA,
    notice: { status: 'sent', attempts: 1, sent_at: '2026-09-06T15:16:02Z' },
  },
};

/** Caso web sin coordenadas: el analista registra la dirección y el pin (CA-1). */
export const ASIGNACION_SIN_UBICACION_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_LISTA_DTO,
  state: 'location_missing',
  location: null,
};

export const ASIGNACION_UBICADA_POR_ANALISTA_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_LISTA_DTO,
  location: {
    source: 'analyst',
    latitude: 4.6771,
    longitude: -74.0483,
    accuracy_m: null,
    address: 'Carrera 15 # 93-40, apto 402, Bogotá',
    recorded_by: ANALISTA_DTO,
    recorded_at: '2026-09-06T15:10:44Z',
  },
};

/** Hurto: no requiere visita. */
export const ASIGNACION_SIN_VISITA_DTO: AsignacionSiniestroDto = {
  ...ASIGNACION_LISTA_DTO,
  incident_type: 'theft',
  line: 'auto',
  state: 'not_required',
  specialty: null,
};

export const LOTE_ASIGNACIONES_DTO: PaginaAsignacionesDto = {
  items: [
    {
      claim_id: ID_EVALUADO,
      state: 'assigned',
      specialty: 'plumbing',
      provider_name: 'Servicios Hogar Norte',
      distance_km: 2.3,
      assigned_at: '2026-09-06T15:15:31Z',
      reason: null,
    },
    {
      claim_id: '0b5c2d9e-3a41-4f6e-9c1d-7e2f8a9b0c11',
      state: 'pending_assignment',
      specialty: 'vehicle_assessment',
      provider_name: null,
      distance_km: null,
      assigned_at: null,
      reason: 'no_eligible_provider_within_max_radius',
    },
    {
      claim_id: '5d7e1f20-8b3c-4a9d-b2e4-6f1a0c3d9e88',
      state: 'not_found',
      specialty: null,
      provider_name: null,
      distance_km: null,
      assigned_at: null,
      reason: null,
    },
  ],
};

export const PRESTADOR_DTO: PrestadorDto = {
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

/** Los tres prestadores del mockup, con coordenadas cerca del incidente (4,6771 N · 74,0483 O). */
export const PRESTADORES_DTO: PrestadorDto[] = [
  PRESTADOR_DTO,
  {
    ...PRESTADOR_DTO,
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
    ...PRESTADOR_DTO,
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
    updated_at: '2026-11-07T10:00:00Z',
  },
];
