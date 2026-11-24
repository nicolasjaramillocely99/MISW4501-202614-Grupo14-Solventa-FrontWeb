import { HttpErrorResponse } from '@angular/common/http';

import { EstadoSiniestro } from './siniestro.modelos';

/**
 * Modelos de la asignación del prestador más cercano (HU-W2.3-01, pantallas O7 y O7b, y la administración de
 * prestadores), tipados según `services/claims/api/openapi.yaml` del backend (v0.11.0) y
 * `docs/contratos/HU-W2.3-01-api.md`.
 *
 * El front no calcula distancias ni decide quién es elegible: pinta lo que el backend calculó con la política
 * `assignment-policy-v1` (provisional), que se lee de `GET /v1/claims/assignment-policy`. Los códigos que pueden crecer
 * con la política (especialidad, motivo, tipo de siniestro, línea) se tipan como `string`.
 */

export type EstadoAsignacion =
  | 'not_required'
  | 'not_applicable'
  | 'location_missing'
  | 'ready'
  | 'proposed'
  | 'pending_assignment'
  | 'assigned';

export type DisponibilidadPrestador = 'available' | 'unavailable' | 'busy';
export type ElegibilidadCandidato = 'eligible' | 'unavailable' | 'out_of_radius';
export type FuenteUbicacion = 'app' | 'analyst';

/** El analista de operaciones, tal como lo leyó el backend del token. Sin nombre en el token, `null`. */
export interface Actor {
  correo: string;
  nombre: string | null;
}

export interface UbicacionIncidente {
  fuente: FuenteUbicacion;
  latitud: number;
  longitud: number;
  /** Precisión de la captura del teléfono, en metros; `null` si la registró el analista. */
  precisionM: number | null;
  /** La dirección que escribió el analista; `null` si viene de la app. */
  direccion: string | null;
  registradaPor: Actor | null;
  registradaEn: string;
}

export interface Candidato {
  prestadorId: string;
  nombre: string;
  especialidades: string[];
  /** En línea recta, redondeada a 0,1 km por el backend. */
  distanciaKm: number;
  disponibilidad: DisponibilidadPrestador;
  noDisponibleHasta: string | null;
  /** Solo los `eligible` se asignan (P8 y P9 del backend). */
  elegibilidad: ElegibilidadCandidato;
  sugerido: boolean;
}

export interface IntentoBusqueda {
  radioKm: number;
  elegibles: number;
  intentadoEn: string;
}

export interface BusquedaPrestador {
  /** Número de la búsqueda en el caso: la asignación lo nombra (`search_seq`). */
  secuencia: number;
  disparo: 'analyst' | 'automatic_retry';
  /** `null` en el reintento automático. */
  buscadaPor: Actor | null;
  especialidad: string;
  ubicacion: { fuente: FuenteUbicacion; latitud: number; longitud: number };
  desdeRadioKm: number;
  resultado: 'found' | 'exhausted';
  /** El radio del último intento: donde encontró, o el máximo. */
  radioKm: number;
  motivo: string | null;
  versionPolitica: string;
  buscadaEn: string;
  intentos: IntentoBusqueda[];
  /** Los prestadores con la especialidad, del más cercano al más lejano (máximo 20), elegibles o no. */
  candidatos: Candidato[];
}

export interface UbicacionCompartida {
  fuente: FuenteUbicacion;
  latitud: number;
  longitud: number;
  precisionM: number | null;
  direccion: string | null;
}

export interface Asignacion {
  prestador: { id: string; nombre: string; correo: string; telefono: string | null };
  asignadaPor: Actor;
  asignadaEn: string;
  distanciaKm: number;
  secuenciaBusqueda: number;
  ubicacionCompartida: UbicacionCompartida;
  versionPolitica: string;
  /** El correo al prestador: `pending` mientras sale, `sent` cuando el proveedor de correo lo aceptó. */
  aviso: { estado: 'pending' | 'sent'; intentos: number; enviadoEn: string | null };
}

/** La asignación de un caso (`ClaimAssignment`): la lectura y la respuesta de las tres escrituras del caso. */
export interface AsignacionSiniestro {
  siniestroId: string;
  numeroRadicado: string;
  estadoSiniestro: EstadoSiniestro;
  tipoSiniestro: string;
  linea: string;
  estado: EstadoAsignacion;
  /** `null` si el tipo de siniestro no requiere visita. */
  especialidad: string | null;
  versionPolitica: string;
  ubicacion: UbicacionIncidente | null;
  ultimaBusqueda: BusquedaPrestador | null;
  asignacion: Asignacion | null;
}

/** Una fila del lote `GET /v1/claims/assignments`, en el orden pedido. */
export interface ResumenAsignacion {
  siniestroId: string;
  estado: EstadoAsignacion | 'not_found';
  especialidad: string | null;
  nombrePrestador: string | null;
  distanciaKm: number | null;
  asignadaEn: string | null;
  motivo: string | null;
}

export interface PoliticaAsignacion {
  version: string;
  /** Los radios de la búsqueda, en orden (5 → 10 → 20 km en la v1). */
  radiosKm: number[];
  radioInicialKm: number;
  radioMaximoKm: number;
  /** Especialidad por línea y tipo; `null` = sin visita (hurto). */
  especialidades: { linea: string; tipoSiniestro: string; especialidad: string | null }[];
  intervaloReintentoSegundos: number;
}

export interface Prestador {
  id: string;
  nombre: string;
  especialidades: string[];
  latitud: number;
  longitud: number;
  direccion: string;
  correo: string;
  telefono: string | null;
  disponibilidad: DisponibilidadPrestador;
  noDisponibleHasta: string | null;
  /** El caso al que está asignado mientras está `busy`. */
  ocupadoEnSiniestroId: string | null;
  /** Correo del analista que lo cambió por última vez, o `reference-data` para la carga inicial. */
  actualizadoPor: string;
  actualizadoEn: string;
}

export interface FiltroPrestadores {
  especialidad?: string;
  disponibilidad?: DisponibilidadPrestador;
}

/** Dirección + coordenadas del pin que puso el analista (sin coordenadas de la app, CA-1). */
export interface SolicitudUbicacion {
  direccion: string;
  latitud: number;
  longitud: number;
}

export interface SolicitudDisponibilidad {
  disponibilidad: 'available' | 'unavailable';
  /** Solo con `unavailable`, `YYYY-MM-DD`, hoy o después. Es informativa. */
  hasta?: string;
}

// --- DTO (snake_case, como el contrato) ---------------------------------------------------------------------------

export interface ActorDto {
  email: string;
  name: string | null;
}

export interface UbicacionIncidenteDto {
  source: FuenteUbicacion;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  address: string | null;
  recorded_by: ActorDto | null;
  recorded_at: string;
}

export interface CandidatoDto {
  provider_id: string;
  name: string;
  specialties: string[];
  distance_km: number;
  availability: DisponibilidadPrestador;
  unavailable_until: string | null;
  eligibility: ElegibilidadCandidato;
  suggested: boolean;
}

export interface BusquedaPrestadorDto {
  seq: number;
  trigger: 'analyst' | 'automatic_retry';
  searched_by: ActorDto | null;
  specialty: string;
  location: { source: FuenteUbicacion; latitude: number; longitude: number };
  from_radius_km: number;
  outcome: 'found' | 'exhausted';
  radius_km: number;
  reason: string | null;
  policy_version: string;
  searched_at: string;
  attempts: { radius_km: number; eligible_count: number; attempted_at: string }[];
  candidates: CandidatoDto[];
}

export interface AsignacionDto {
  provider: { id: string; name: string; contact_email: string; contact_phone: string | null };
  assigned_by: ActorDto;
  assigned_at: string;
  distance_km: number;
  search_seq: number;
  location_shared: {
    source: FuenteUbicacion;
    latitude: number;
    longitude: number;
    accuracy_m: number | null;
    address: string | null;
  };
  policy_version: string;
  notice: { status: 'pending' | 'sent'; attempts: number; sent_at: string | null };
}

export interface AsignacionSiniestroDto {
  claim_id: string;
  filing_number: string;
  claim_status: EstadoSiniestro;
  incident_type: string;
  line: string;
  state: EstadoAsignacion;
  specialty: string | null;
  policy_version: string;
  location: UbicacionIncidenteDto | null;
  last_search: BusquedaPrestadorDto | null;
  assignment: AsignacionDto | null;
}

export interface PaginaAsignacionesDto {
  items: {
    claim_id: string;
    state: EstadoAsignacion | 'not_found';
    specialty: string | null;
    provider_name: string | null;
    distance_km: number | null;
    assigned_at: string | null;
    reason: string | null;
  }[];
}

export interface PoliticaAsignacionDto {
  version: string;
  radii_km: number[];
  initial_radius_km: number;
  max_radius_km: number;
  specialties: { line: string; incident_type: string; specialty: string | null }[];
  retry_interval_seconds: number;
}

export interface PrestadorDto {
  id: string;
  name: string;
  specialties: string[];
  latitude: number;
  longitude: number;
  address: string;
  contact_email: string;
  contact_phone: string | null;
  availability: DisponibilidadPrestador;
  unavailable_until: string | null;
  busy_claim_id: string | null;
  updated_by: string;
  updated_at: string;
}

export interface ListaPrestadoresDto {
  items: PrestadorDto[];
}

// --- Mapeos --------------------------------------------------------------------------------------------------------

function mapearActor(dto: ActorDto): Actor {
  return { correo: dto.email, nombre: dto.name ?? null };
}

function mapearUbicacion(dto: UbicacionIncidenteDto): UbicacionIncidente {
  return {
    fuente: dto.source,
    latitud: dto.latitude,
    longitud: dto.longitude,
    precisionM: dto.accuracy_m ?? null,
    direccion: dto.address ?? null,
    registradaPor: dto.recorded_by ? mapearActor(dto.recorded_by) : null,
    registradaEn: dto.recorded_at,
  };
}

function mapearCandidato(dto: CandidatoDto): Candidato {
  return {
    prestadorId: dto.provider_id,
    nombre: dto.name,
    especialidades: [...dto.specialties],
    distanciaKm: dto.distance_km,
    disponibilidad: dto.availability,
    noDisponibleHasta: dto.unavailable_until ?? null,
    elegibilidad: dto.eligibility,
    sugerido: dto.suggested,
  };
}

function mapearBusqueda(dto: BusquedaPrestadorDto): BusquedaPrestador {
  return {
    secuencia: dto.seq,
    disparo: dto.trigger,
    buscadaPor: dto.searched_by ? mapearActor(dto.searched_by) : null,
    especialidad: dto.specialty,
    ubicacion: {
      fuente: dto.location.source,
      latitud: dto.location.latitude,
      longitud: dto.location.longitude,
    },
    desdeRadioKm: dto.from_radius_km,
    resultado: dto.outcome,
    radioKm: dto.radius_km,
    motivo: dto.reason ?? null,
    versionPolitica: dto.policy_version,
    buscadaEn: dto.searched_at,
    intentos: dto.attempts.map((intento) => ({
      radioKm: intento.radius_km,
      elegibles: intento.eligible_count,
      intentadoEn: intento.attempted_at,
    })),
    candidatos: dto.candidates.map(mapearCandidato),
  };
}

function mapearAsignacion(dto: AsignacionDto): Asignacion {
  return {
    prestador: {
      id: dto.provider.id,
      nombre: dto.provider.name,
      correo: dto.provider.contact_email,
      telefono: dto.provider.contact_phone ?? null,
    },
    asignadaPor: mapearActor(dto.assigned_by),
    asignadaEn: dto.assigned_at,
    distanciaKm: dto.distance_km,
    secuenciaBusqueda: dto.search_seq,
    ubicacionCompartida: {
      fuente: dto.location_shared.source,
      latitud: dto.location_shared.latitude,
      longitud: dto.location_shared.longitude,
      precisionM: dto.location_shared.accuracy_m ?? null,
      direccion: dto.location_shared.address ?? null,
    },
    versionPolitica: dto.policy_version,
    aviso: {
      estado: dto.notice.status,
      intentos: dto.notice.attempts,
      enviadoEn: dto.notice.sent_at ?? null,
    },
  };
}

export function mapearAsignacionSiniestro(dto: AsignacionSiniestroDto): AsignacionSiniestro {
  return {
    siniestroId: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estadoSiniestro: dto.claim_status,
    tipoSiniestro: dto.incident_type,
    linea: dto.line,
    estado: dto.state,
    especialidad: dto.specialty ?? null,
    versionPolitica: dto.policy_version,
    ubicacion: dto.location ? mapearUbicacion(dto.location) : null,
    ultimaBusqueda: dto.last_search ? mapearBusqueda(dto.last_search) : null,
    asignacion: dto.assignment ? mapearAsignacion(dto.assignment) : null,
  };
}

export function mapearPaginaAsignaciones(dto: PaginaAsignacionesDto): ResumenAsignacion[] {
  return dto.items.map((item) => ({
    siniestroId: item.claim_id,
    estado: item.state,
    especialidad: item.specialty ?? null,
    nombrePrestador: item.provider_name ?? null,
    distanciaKm: item.distance_km ?? null,
    asignadaEn: item.assigned_at ?? null,
    motivo: item.reason ?? null,
  }));
}

export function mapearPoliticaAsignacion(dto: PoliticaAsignacionDto): PoliticaAsignacion {
  return {
    version: dto.version,
    radiosKm: [...dto.radii_km],
    radioInicialKm: dto.initial_radius_km,
    radioMaximoKm: dto.max_radius_km,
    especialidades: dto.specialties.map((s) => ({
      linea: s.line,
      tipoSiniestro: s.incident_type,
      especialidad: s.specialty ?? null,
    })),
    intervaloReintentoSegundos: dto.retry_interval_seconds,
  };
}

export function mapearPrestador(dto: PrestadorDto): Prestador {
  return {
    id: dto.id,
    nombre: dto.name,
    especialidades: [...dto.specialties],
    latitud: dto.latitude,
    longitud: dto.longitude,
    direccion: dto.address,
    correo: dto.contact_email,
    telefono: dto.contact_phone ?? null,
    disponibilidad: dto.availability,
    noDisponibleHasta: dto.unavailable_until ?? null,
    ocupadoEnSiniestroId: dto.busy_claim_id ?? null,
    actualizadoPor: dto.updated_by,
    actualizadoEn: dto.updated_at,
  };
}

export function mapearListaPrestadores(dto: ListaPrestadoresDto): Prestador[] {
  return dto.items.map(mapearPrestador);
}

/** Cuerpo de `POST /v1/claims/{claim_id}/incident-location`. La dirección viaja sin espacios alrededor. */
export function aUbicacionDto(solicitud: SolicitudUbicacion): Record<string, unknown> {
  return {
    address: solicitud.direccion.trim(),
    latitude: solicitud.latitud,
    longitude: solicitud.longitud,
  };
}

/** Cuerpo de `POST /v1/claims/providers/{provider_id}/availability`. `unavailable_until` solo viaja si viene. */
export function aDisponibilidadDto(solicitud: SolicitudDisponibilidad): Record<string, unknown> {
  return solicitud.disponibilidad === 'unavailable' && solicitud.hasta
    ? { availability: 'unavailable', unavailable_until: solicitud.hasta }
    : { availability: solicitud.disponibilidad };
}

// --- Errores -------------------------------------------------------------------------------------------------------

/** Códigos estables de la asignación y de los prestadores (contrato, §2.8). */
export type CodigoErrorAsignacion =
  | 'invalid_request'
  | 'claim_not_found'
  | 'provider_not_found'
  | 'location_from_app'
  | 'assignment_exists'
  | 'claim_not_assignable'
  | 'provider_unavailable'
  | 'search_outdated'
  | 'location_missing'
  | 'provider_not_eligible'
  | 'validation_failed'
  | 'claims_unavailable';

const CODIGOS_ASIGNACION: readonly string[] = [
  'invalid_request',
  'claim_not_found',
  'provider_not_found',
  'location_from_app',
  'assignment_exists',
  'claim_not_assignable',
  'provider_unavailable',
  'search_outdated',
  'location_missing',
  'provider_not_eligible',
  'validation_failed',
  'claims_unavailable',
];

/** Un campo inválido de `validation_failed` (`required`, `invalid_format`, `out_of_range`). */
export interface CampoInvalido {
  campo: string;
  codigo: string;
}

export class ErrorAsignacion extends Error {
  constructor(
    readonly codigo: CodigoErrorAsignacion,
    readonly campos: readonly CampoInvalido[] = [],
  ) {
    super(`Error de la asignación: ${codigo}`);
    this.name = 'ErrorAsignacion';
  }
}

/**
 * Traduce un error HTTP al código del contrato, con los campos de `validation_failed`. Sin cuerpo reconocible se decide
 * por el estado: `400` → `invalid_request`, `404` → `claim_not_found` y lo demás (red, 5xx del API Gateway) →
 * `claims_unavailable`. El `401` y el `403` los resuelve el interceptor.
 */
export function traducirErrorAsignacion(error: unknown): ErrorAsignacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorAsignacion('claims_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_ASIGNACION.includes(codigo)) {
      return new ErrorAsignacion(codigo as CodigoErrorAsignacion, leerCampos(cuerpo));
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorAsignacion('invalid_request');
    case 404:
      return new ErrorAsignacion('claim_not_found');
    default:
      return new ErrorAsignacion('claims_unavailable');
  }
}

function leerCampos(cuerpo: object): CampoInvalido[] {
  const campos = (cuerpo as Record<string, unknown>)['fields'];
  if (!Array.isArray(campos)) {
    return [];
  }
  return campos
    .filter(
      (c): c is { field: string; code: string } =>
        typeof c === 'object' &&
        c !== null &&
        typeof c.field === 'string' &&
        typeof c.code === 'string',
    )
    .map((c) => ({ campo: c.field, codigo: c.code }));
}
