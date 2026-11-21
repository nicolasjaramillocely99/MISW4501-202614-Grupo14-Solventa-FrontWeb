import { PrestadorDto } from '@core/api/siniestros/asignacion.modelos';
import {
  BandejaAsistenciasDto,
  CandidatoAsistenciaDto,
  DespachoDto,
  DetalleAsistenciaDto,
  PoliticaAsistenciaDto,
  SolicitudAsistenciaDto,
  SugerenciaDto,
} from '@core/api/siniestros/asistencia.modelos';

/**
 * Respuestas de la bandeja de asistencias (HU-W2.3-03) copiadas de las **respuestas capturadas** del binario en Docker
 * que trae `docs/contratos/HU-W2.3-03-api.md` del backend (`openapi.yaml` v0.18.0): AST-2026-0001 con GPS en la
 * Autopista Norte (4,7712 N · 74,0452 O), AST-2026-0002 sin GPS que Diana Torres tomó de Andrés Ruiz y ubicó por voz en
 * la vía Cali–Palmira, y AST-2026-0003 de Hogar, cerrada desde `new`. Los demás estados se arman desde ellas.
 */

export const ANALISTA_DTO = { email: 'operaciones.local@example.com', name: 'Andrés Ruiz' };
export const ANALISTA_TURNO2_DTO = {
  email: 'operaciones.turno2.local@example.com',
  name: 'Diana Torres',
};

export const ID_CON_GPS = '184a52ab-8b1a-4715-ac8e-d124e121fe33';
export const ID_SIN_GPS = 'bc8adc67-47aa-47ed-bd0f-5a1466582d32';
export const ID_HOGAR = '9cef2741-03ec-4f85-a7df-8d75e9ecb6dc';
export const ID_DESPACHADA = '5f0e9a3c-2b7d-4c1e-9a8f-3d6b2c1e0f4a';
export const ID_VIAJE = '7a1c3e5b-9d2f-4b6a-8c0e-1f3a5c7e9b2d';

export const POLITICA_ASISTENCIA_DTO: PoliticaAsistenciaDto = {
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
  status: 'sent' as const,
  latitude: 4.7712,
  longitude: -74.0452,
  accuracy_m: 8,
  captured_at: '2026-11-21T16:16:04Z',
  unavailable_reason: null,
  place: 'Autopista Norte km 12, Bogotá',
  voice: null,
};

const SIN_UBICACION = {
  status: 'unavailable' as const,
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
    recorded_by: ANALISTA_TURNO2_DTO,
    recorded_at: '2026-11-21T16:16:11.513872Z',
  },
};

// --- Filas de la bandeja ------------------------------------------------------------------------------------------

export const SOLICITUD_CON_GPS_DTO: SolicitudAsistenciaDto = {
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

export const SOLICITUD_SIN_GPS_DTO: SolicitudAsistenciaDto = {
  request_id: ID_SIN_GPS,
  request_number: 'AST-2026-0002',
  status: 'new',
  requester_name: 'Carolina Pérez',
  policy: POLIZA_AUTO,
  location: SIN_UBICACION,
  requested_at: '2026-11-21T16:16:11.023796Z',
  handled_by: null,
  dispatched_at: null,
  closed_at: null,
};

/** AST-2026-0002 después de que Diana Torres la tomó y registró la ubicación por voz. */
export const SOLICITUD_EN_LLAMADA_DTO: SolicitudAsistenciaDto = {
  ...SOLICITUD_SIN_GPS_DTO,
  status: 'in_call',
  location: UBICACION_POR_VOZ,
  handled_by: ANALISTA_TURNO2_DTO,
};

export const SOLICITUD_DESPACHADA_DTO: SolicitudAsistenciaDto = {
  request_id: ID_DESPACHADA,
  request_number: 'AST-2026-0004',
  status: 'dispatched',
  requester_name: 'Diego Salazar Peña',
  policy: {
    policy_id: 'AU-2026-334501',
    line: 'auto',
    product: 'Autos',
    insured_object: 'MKL-903',
  },
  location: { ...UBICACION_APP, latitude: 4.7, longitude: -74.05, accuracy_m: 15, place: null },
  requested_at: '2026-11-21T15:20:00Z',
  handled_by: ANALISTA_DTO,
  dispatched_at: '2026-11-21T15:23:40Z',
  closed_at: null,
};

export const SOLICITUD_HOGAR_CERRADA_DTO: SolicitudAsistenciaDto = {
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
  requested_at: '2026-11-21T16:16:20.562879Z',
  handled_by: null,
  dispatched_at: null,
  closed_at: '2026-11-21T16:16:20.620241Z',
};

export const BANDEJA_DTO: BandejaAsistenciasDto = {
  summary: {
    new_count: 2,
    in_call_count: 1,
    dispatched_today: 6,
    mean_dispatch_seconds_today: 220,
    dispatch_target_seconds: 300,
  },
  items: [
    SOLICITUD_HOGAR_CERRADA_DTO,
    SOLICITUD_EN_LLAMADA_DTO,
    SOLICITUD_CON_GPS_DTO,
    {
      ...SOLICITUD_SIN_GPS_DTO,
      request_id: '2d4f6a8c-0e1b-4d3f-a5c7-9e1b3d5f7a9c',
      request_number: 'AST-2026-0005',
    },
    SOLICITUD_DESPACHADA_DTO,
  ],
};

/** La bandeja capturada al empezar el e2e del backend: dos nuevas y ningún despacho hoy. */
export const BANDEJA_SIN_DESPACHOS_DTO: BandejaAsistenciasDto = {
  summary: {
    new_count: 2,
    in_call_count: 0,
    dispatched_today: 0,
    mean_dispatch_seconds_today: null,
    dispatch_target_seconds: 300,
  },
  items: [SOLICITUD_SIN_GPS_DTO, SOLICITUD_CON_GPS_DTO],
};

export const BANDEJA_VACIA_DTO: BandejaAsistenciasDto = {
  summary: {
    new_count: 0,
    in_call_count: 0,
    dispatched_today: 0,
    mean_dispatch_seconds_today: null,
    dispatch_target_seconds: 300,
  },
  items: [],
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

export const SUGERENCIA_NO_APLICA_DTO: SugerenciaDto = { state: 'not_applicable', ...SIN_BUSQUEDA };
export const SUGERENCIA_SIN_NECESIDAD_DTO: SugerenciaDto = {
  state: 'need_missing',
  ...SIN_BUSQUEDA,
};
export const SUGERENCIA_SIN_UBICACION_DTO: SugerenciaDto = {
  state: 'location_missing',
  ...SIN_BUSQUEDA,
};

const candidato = (
  provider_id: string,
  name: string,
  specialties: string[],
  distance_km: number,
  eta_minutes: number,
  eligibility: CandidatoAsistenciaDto['eligibility'],
  suggested = false,
): CandidatoAsistenciaDto => ({
  provider_id,
  name,
  specialties,
  distance_km,
  availability: 'available',
  unavailable_until: null,
  eligibility,
  suggested,
  eta_minutes,
  dispatched_today: 0,
});

/** La sugerencia capturada de AST-2026-0001 con «grúa»: dos elegibles a 5 km y dos fuera del radio (uno en Palmira). */
export const SUGERENCIA_ENCONTRADA_DTO: SugerenciaDto = {
  state: 'found',
  specialty: 'towing',
  location_source: 'app',
  from_radius_km: 5,
  radius_km: 5,
  reason: null,
  policy_version: 'assignment-policy-v1',
  attempts: [{ radius_km: 5, eligible_count: 2, attempted_at: '2026-11-21T16:16:11.311729385Z' }],
  candidates: [
    candidato(
      'prv-gruas-autopista-norte',
      'Grúas Autopista Norte',
      ['towing'],
      0.9,
      12,
      'eligible',
      true,
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

/** La sugerencia capturada de AST-2026-0002 desde el pin por voz en la vía Cali–Palmira. */
export const SUGERENCIA_POR_VOZ_DTO: SugerenciaDto = {
  state: 'found',
  specialty: 'towing',
  location_source: 'voice',
  from_radius_km: 5,
  radius_km: 5,
  reason: null,
  policy_version: 'assignment-policy-v1',
  attempts: [{ radius_km: 5, eligible_count: 1, attempted_at: '2026-11-21T16:16:11.516142552Z' }],
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
    candidato(
      'prv-auxilio-vial-norte',
      'Auxilio Vial Norte',
      ['roadside_assistance', 'towing'],
      298.3,
      607,
      'out_of_radius',
    ),
    candidato(
      'prv-gruas-autopista-norte',
      'Grúas Autopista Norte',
      ['towing'],
      299.8,
      610,
      'out_of_radius',
    ),
  ],
};

/** Nadie elegible a 20 km o menos: un prestador no disponible hasta mañana y uno lejano. */
export const SUGERENCIA_AGOTADA_DTO: SugerenciaDto = {
  state: 'exhausted',
  specialty: 'towing',
  location_source: 'app',
  from_radius_km: 5,
  radius_km: 20,
  reason: 'no_eligible_provider_within_max_radius',
  policy_version: 'assignment-policy-v1',
  attempts: [
    { radius_km: 5, eligible_count: 0, attempted_at: '2026-11-21T16:16:11.3Z' },
    { radius_km: 10, eligible_count: 0, attempted_at: '2026-11-21T16:16:11.31Z' },
    { radius_km: 20, eligible_count: 0, attempted_at: '2026-11-21T16:16:11.32Z' },
  ],
  candidates: [
    {
      ...candidato(
        'prv-gruas-autopista-norte',
        'Grúas Autopista Norte',
        ['towing'],
        0.9,
        12,
        'unavailable',
      ),
      availability: 'unavailable',
      unavailable_until: '2026-11-22',
    },
    candidato('prv-gruas-del-valle', 'Grúas del Valle', ['towing'], 297.6, 606, 'out_of_radius'),
  ],
};

// --- Detalles -----------------------------------------------------------------------------------------------------

const ATENDIDA = {
  action: 'attended',
  by: ANALISTA_DTO,
  at: '2026-11-21T16:16:11.220159Z',
  detail: null,
};
const NECESIDAD_GRUA = {
  action: 'need_recorded',
  by: ANALISTA_DTO,
  at: '2026-11-21T16:16:11.309446Z',
  detail: { need: 'towing' },
};

/** AST-2026-0001 recién llegada: sin atender ni necesidad. */
export const DETALLE_NUEVA_DTO: DetalleAsistenciaDto = {
  ...SOLICITUD_CON_GPS_DTO,
  need: null,
  suggestion: SUGERENCIA_SIN_NECESIDAD_DTO,
  dispatch: null,
  closure: null,
  history: [],
};

/** AST-2026-0001 atendida por Andrés Ruiz, todavía sin necesidad. */
export const DETALLE_ATENDIDA_DTO: DetalleAsistenciaDto = {
  ...DETALLE_NUEVA_DTO,
  status: 'in_call',
  handled_by: ANALISTA_DTO,
  history: [ATENDIDA],
};

/** La respuesta capturada de §2.3/§2.5: en llamada, con «grúa» y la sugerencia encontrada. */
export const DETALLE_CON_SUGERENCIA_DTO: DetalleAsistenciaDto = {
  ...DETALLE_ATENDIDA_DTO,
  need: {
    code: 'towing',
    specialty: 'towing',
    recorded_by: ANALISTA_DTO,
    recorded_at: '2026-11-21T16:16:11.309446Z',
  },
  suggestion: SUGERENCIA_ENCONTRADA_DTO,
  history: [ATENDIDA, NECESIDAD_GRUA],
};

export const DETALLE_AGOTADA_DTO: DetalleAsistenciaDto = {
  ...DETALLE_CON_SUGERENCIA_DTO,
  suggestion: SUGERENCIA_AGOTADA_DTO,
};

/** AST-2026-0002 sin GPS, nueva: falta la ubicación (tiene prioridad sobre la necesidad). */
export const DETALLE_SIN_GPS_DTO: DetalleAsistenciaDto = {
  ...SOLICITUD_SIN_GPS_DTO,
  need: null,
  suggestion: SUGERENCIA_SIN_UBICACION_DTO,
  dispatch: null,
  closure: null,
  history: [],
};

/** La respuesta capturada de §2.6: Diana la tomó, registró «grúa» y la ubicación por voz. */
export const DETALLE_UBICADA_POR_VOZ_DTO: DetalleAsistenciaDto = {
  ...SOLICITUD_EN_LLAMADA_DTO,
  need: {
    code: 'towing',
    specialty: 'towing',
    recorded_by: ANALISTA_TURNO2_DTO,
    recorded_at: '2026-11-21T16:16:11.454012Z',
  },
  suggestion: SUGERENCIA_POR_VOZ_DTO,
  dispatch: null,
  closure: null,
  history: [
    { action: 'attended', by: ANALISTA_DTO, at: '2026-11-21T16:16:11.389133Z', detail: null },
    {
      action: 'taken_over',
      by: ANALISTA_TURNO2_DTO,
      at: '2026-11-21T16:16:11.416756Z',
      detail: { from: 'operaciones.local@example.com' },
    },
    {
      action: 'need_recorded',
      by: ANALISTA_TURNO2_DTO,
      at: '2026-11-21T16:16:11.454012Z',
      detail: { need: 'towing' },
    },
    {
      action: 'voice_location_recorded',
      by: ANALISTA_TURNO2_DTO,
      at: '2026-11-21T16:16:11.513872Z',
      detail: null,
    },
  ],
};

const DESPACHO_DTO: DespachoDto = {
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
  dispatched_by: ANALISTA_DTO,
  dispatched_at: '2026-11-21T16:16:11.606015Z',
  policy_versions: { assistance: 'assistance-policy-v1', assignment: 'assignment-policy-v1' },
  notice: { status: 'pending', attempts: 0, sent_at: null },
};

/** La respuesta capturada de §2.7: despachada al sugerido, con el correo todavía pendiente. */
export const DETALLE_DESPACHADA_DTO: DetalleAsistenciaDto = {
  ...DETALLE_CON_SUGERENCIA_DTO,
  status: 'dispatched',
  dispatched_at: '2026-11-21T16:16:11.606015Z',
  suggestion: SUGERENCIA_NO_APLICA_DTO,
  dispatch: DESPACHO_DTO,
  history: [
    ATENDIDA,
    NECESIDAD_GRUA,
    {
      action: 'dispatched',
      by: ANALISTA_DTO,
      at: '2026-11-21T16:16:11.606015Z',
      detail: { provider_id: 'prv-gruas-autopista-norte' },
    },
  ],
};

export const DETALLE_AVISADA_DTO: DetalleAsistenciaDto = {
  ...DETALLE_DESPACHADA_DTO,
  dispatch: {
    ...DESPACHO_DTO,
    notice: { status: 'sent', attempts: 1, sent_at: '2026-11-21T16:16:12.4Z' },
  },
};

/** La respuesta capturada de §2.8: AST-2026-0003 de Hogar, cerrada desde `new` sin atenderla. */
export const DETALLE_CERRADA_DTO: DetalleAsistenciaDto = {
  ...SOLICITUD_HOGAR_CERRADA_DTO,
  need: null,
  suggestion: SUGERENCIA_NO_APLICA_DTO,
  dispatch: null,
  closure: {
    reason: 'resolved_by_phone',
    note: null,
    closed_by: ANALISTA_DTO,
    closed_at: '2026-11-21T16:16:20.620241Z',
  },
  history: [
    {
      action: 'closed',
      by: ANALISTA_DTO,
      at: '2026-11-21T16:16:20.620241Z',
      detail: { reason: 'resolved_by_phone' },
    },
  ],
};

/** Una póliza de Viaje en llamada: la política no le da necesidades. */
export const DETALLE_VIAJE_DTO: DetalleAsistenciaDto = {
  ...DETALLE_ATENDIDA_DTO,
  request_id: ID_VIAJE,
  request_number: 'AST-2026-0006',
  policy: {
    policy_id: 'VJ-2026-110233',
    line: 'travel',
    product: 'Viajes',
    insured_object: 'Bogotá–Lima',
  },
};

/** Variante de un detalle sin repetir todo el objeto. */
export function detalleCon(
  base: DetalleAsistenciaDto,
  cambios: Partial<DetalleAsistenciaDto>,
): DetalleAsistenciaDto {
  return { ...base, ...cambios };
}

// --- Registro de prestadores (semilla `0015`) -----------------------------------------------------------------------

const prestador = (
  id: string,
  name: string,
  specialties: string[],
  latitude: number,
  longitude: number,
): PrestadorDto => ({
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

export const PRESTADORES_ASISTENCIA_DTO: { items: PrestadorDto[] } = {
  items: [
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
  ],
};
