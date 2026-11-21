import { HttpErrorResponse } from '@angular/common/http';

import { Actor, ActorDto, CampoInvalido, Candidato, CandidatoDto } from './asignacion.modelos';

/**
 * Modelos de la atención de solicitudes de asistencia entrantes (HU-W2.3-03, pantallas O9 y O9b), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.18.0) y `docs/contratos/HU-W2.3-03-api.md`.
 *
 * La solicitud la registra la app del asegurado (HU-M2.3-01); el analista de operaciones la atiende, elige la necesidad,
 * registra la ubicación que le dictan si no hay GPS, despacha un prestador o la cierra con un motivo. El front **no
 * calcula** distancias, elegibilidad ni llegada estimada: pinta lo que el backend calculó con `assistance-policy-v1` y
 * `assignment-policy-v1` (provisionales), que se leen de `GET /v1/claims/assistance-policy`. Los códigos que pueden crecer
 * con la política (necesidad, especialidad, motivo, línea, acción) se tipan como `string`.
 */

export type EstadoAsistencia = 'new' | 'in_call' | 'dispatched' | 'closed';
export type EstadoSugerencia =
  'need_missing' | 'location_missing' | 'found' | 'exhausted' | 'not_applicable';

/** La póliza tal como la describió el core al registrar la solicitud. */
export interface PolizaAsistencia {
  polizaId: string;
  linea: string;
  producto: string;
  /** La placa del vehículo, la dirección del inmueble… */
  objetoAsegurado: string;
}

/** La dirección y el pin que registró el analista para una solicitud sin GPS (la vigente es la última). */
export interface UbicacionPorVoz {
  direccion: string;
  latitud: number;
  longitud: number;
  registradaPor: Actor;
  registradaEn: string;
}

/** La ubicación que envió la app. Con `estado: 'sent'` trae coordenadas; con `unavailable`, el motivo. */
export interface UbicacionSolicitud {
  estado: 'sent' | 'unavailable';
  latitud: number | null;
  longitud: number | null;
  precisionM: number | null;
  capturadaEn: string | null;
  /** `permission_denied`, `location_disabled` o `no_fix` con `unavailable`. */
  motivoSinUbicacion: string | null;
  /** La dirección legible que obtuvo el teléfono, si la tuvo. */
  lugar: string | null;
  voz: UbicacionPorVoz | null;
}

/** Una fila de la bandeja (`AssistanceInboxItem`). */
export interface SolicitudAsistencia {
  solicitudId: string;
  numero: string;
  estado: EstadoAsistencia;
  /** `null` si el token del asegurado no traía nombre. */
  solicitante: string | null;
  poliza: PolizaAsistencia;
  ubicacion: UbicacionSolicitud;
  solicitadaEn: string;
  /** El último analista que la atendió o la tomó. */
  atendidaPor: Actor | null;
  despachadaEn: string | null;
  cerradaEn: string | null;
}

/** Indicadores de la bandeja; no dependen de los filtros. «Hoy» es el día de Colombia. */
export interface ResumenBandeja {
  nuevas: number;
  enLlamada: number;
  despachadasHoy: number;
  /** `null` si hoy no hubo despachos. */
  tiempoMedioDespachoSegundos: number | null;
  objetivoDespachoSegundos: number;
}

export interface BandejaAsistencias {
  resumen: ResumenBandeja;
  solicitudes: SolicitudAsistencia[];
}

/** Un candidato de HU-W2.3-01 con la llegada estimada y los despachos de hoy (informativo: despachar no lo ocupa). */
export interface CandidatoAsistencia extends Candidato {
  llegadaMinutos: number;
  despachadosHoy: number;
}

export interface IntentoSugerencia {
  radioKm: number;
  elegibles: number;
  intentadoEn: string;
}

/**
 * La sugerencia, calculada en cada lectura (no se guarda). Solo `found` y `exhausted` traen búsqueda; los candidatos
 * son **todos** los prestadores con la especialidad, del más cercano al más lejano, cada uno con su elegibilidad.
 */
export interface Sugerencia {
  estado: EstadoSugerencia;
  especialidad: string | null;
  fuenteUbicacion: 'app' | 'voice' | null;
  desdeRadioKm: number | null;
  radioKm: number | null;
  motivo: string | null;
  versionPolitica: string;
  intentos: IntentoSugerencia[];
  candidatos: CandidatoAsistencia[];
}

export interface NecesidadRegistrada {
  codigo: string;
  especialidad: string;
  registradaPor: Actor;
  registradaEn: string;
}

export interface UbicacionCompartidaAsistencia {
  fuente: 'app' | 'voice';
  latitud: number;
  longitud: number;
  precisionM: number | null;
  /** La dirección por voz; `null` si la ubicación vino del teléfono. */
  direccion: string | null;
  lugar: string | null;
}

export interface Despacho {
  prestador: { id: string; nombre: string; correo: string; telefono: string | null };
  necesidad: string;
  especialidad: string;
  distanciaKm: number;
  llegadaMinutos: number;
  ubicacionCompartida: UbicacionCompartidaAsistencia;
  /** El que sugería el sistema al despachar; puede ser distinto del despachado. */
  prestadorSugeridoId: string | null;
  despachadaPor: Actor;
  despachadaEn: string;
  versionesPolitica: { asistencia: string; asignacion: string };
  /** El correo al prestador: `pending` mientras sale, `sent` cuando el proveedor de correo lo aceptó. */
  aviso: { estado: 'pending' | 'sent'; intentos: number; enviadoEn: string | null };
}

export interface Cierre {
  motivo: string;
  nota: string | null;
  cerradaPor: Actor;
  cerradaEn: string;
}

/** Una decisión del historial (CA-5). `detalle` según la acción: `need`, `provider_id`, `reason` o `from`. */
export interface AccionHistorial {
  accion: string;
  por: Actor;
  en: string;
  detalle: Readonly<Record<string, string>> | null;
}

/** El detalle de una solicitud (`AssistanceCase`): la lectura y la respuesta de todas las escrituras. */
export interface DetalleAsistencia extends SolicitudAsistencia {
  necesidad: NecesidadRegistrada | null;
  sugerencia: Sugerencia;
  despacho: Despacho | null;
  cierre: Cierre | null;
  /** Del más antiguo al más reciente. */
  historial: AccionHistorial[];
}

export interface PoliticaAsistencia {
  version: string;
  /** Las necesidades de cada línea, con la especialidad del registro de prestadores que les corresponde. */
  necesidades: { linea: string; codigo: string; especialidad: string }[];
  radiosKm: number[];
  versionPoliticaAsignacion: string;
  llegada: { alistamientoMinutos: number; velocidadMediaKmh: number };
  motivosCierre: string[];
  objetivoDespachoSegundos: number;
}

export interface FiltroBandeja {
  estados?: readonly EstadoAsistencia[];
  /** 1–100; el backend usa 50 si no viene. */
  limite?: number;
}

export interface SolicitudCierre {
  motivo: string;
  /** Obligatoria con `other`; 3–500 caracteres. */
  nota?: string;
}

// --- DTO (snake_case, como el contrato) ---------------------------------------------------------------------------

export interface UbicacionSolicitudDto {
  status: 'sent' | 'unavailable';
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  captured_at: string | null;
  unavailable_reason: string | null;
  place: string | null;
  voice: {
    address: string;
    latitude: number;
    longitude: number;
    recorded_by: ActorDto;
    recorded_at: string;
  } | null;
}

export interface SolicitudAsistenciaDto {
  request_id: string;
  request_number: string;
  status: EstadoAsistencia;
  requester_name: string | null;
  policy: { policy_id: string; line: string; product: string; insured_object: string };
  location: UbicacionSolicitudDto;
  requested_at: string;
  handled_by: ActorDto | null;
  dispatched_at: string | null;
  closed_at: string | null;
}

export interface BandejaAsistenciasDto {
  summary: {
    new_count: number;
    in_call_count: number;
    dispatched_today: number;
    mean_dispatch_seconds_today: number | null;
    dispatch_target_seconds: number;
  };
  items: SolicitudAsistenciaDto[];
}

export interface CandidatoAsistenciaDto extends CandidatoDto {
  eta_minutes: number;
  dispatched_today: number;
}

export interface SugerenciaDto {
  state: EstadoSugerencia;
  specialty: string | null;
  location_source: 'app' | 'voice' | null;
  from_radius_km: number | null;
  radius_km: number | null;
  reason: string | null;
  policy_version: string;
  attempts: { radius_km: number; eligible_count: number; attempted_at: string }[];
  candidates: CandidatoAsistenciaDto[];
}

export interface DespachoDto {
  provider: { id: string; name: string; contact_email: string; contact_phone: string | null };
  need: string;
  specialty: string;
  distance_km: number;
  eta_minutes: number;
  location_shared: {
    source: 'app' | 'voice';
    latitude: number;
    longitude: number;
    accuracy_m: number | null;
    address: string | null;
    place: string | null;
  };
  suggested_provider_id: string | null;
  dispatched_by: ActorDto;
  dispatched_at: string;
  policy_versions: { assistance: string; assignment: string };
  notice: { status: 'pending' | 'sent'; attempts: number; sent_at: string | null };
}

export interface DetalleAsistenciaDto extends SolicitudAsistenciaDto {
  need: { code: string; specialty: string; recorded_by: ActorDto; recorded_at: string } | null;
  suggestion: SugerenciaDto;
  dispatch: DespachoDto | null;
  closure: { reason: string; note: string | null; closed_by: ActorDto; closed_at: string } | null;
  history: { action: string; by: ActorDto; at: string; detail: Record<string, string> | null }[];
}

export interface PoliticaAsistenciaDto {
  version: string;
  needs: { line: string; code: string; specialty: string }[];
  radii_km: number[];
  assignment_policy_version: string;
  eta: { preparation_minutes: number; average_speed_kmh: number };
  close_reasons: string[];
  dispatch_target_seconds: number;
}

// --- Mapeos --------------------------------------------------------------------------------------------------------

function mapearActor(dto: ActorDto): Actor {
  return { correo: dto.email, nombre: dto.name ?? null };
}

function mapearUbicacion(dto: UbicacionSolicitudDto): UbicacionSolicitud {
  return {
    estado: dto.status,
    latitud: dto.latitude ?? null,
    longitud: dto.longitude ?? null,
    precisionM: dto.accuracy_m ?? null,
    capturadaEn: dto.captured_at ?? null,
    motivoSinUbicacion: dto.unavailable_reason ?? null,
    lugar: dto.place ?? null,
    voz: dto.voice
      ? {
          direccion: dto.voice.address,
          latitud: dto.voice.latitude,
          longitud: dto.voice.longitude,
          registradaPor: mapearActor(dto.voice.recorded_by),
          registradaEn: dto.voice.recorded_at,
        }
      : null,
  };
}

function mapearSolicitud(dto: SolicitudAsistenciaDto): SolicitudAsistencia {
  return {
    solicitudId: dto.request_id,
    numero: dto.request_number,
    estado: dto.status,
    solicitante: dto.requester_name ?? null,
    poliza: {
      polizaId: dto.policy.policy_id,
      linea: dto.policy.line,
      producto: dto.policy.product,
      objetoAsegurado: dto.policy.insured_object,
    },
    ubicacion: mapearUbicacion(dto.location),
    solicitadaEn: dto.requested_at,
    atendidaPor: dto.handled_by ? mapearActor(dto.handled_by) : null,
    despachadaEn: dto.dispatched_at ?? null,
    cerradaEn: dto.closed_at ?? null,
  };
}

function mapearCandidato(dto: CandidatoAsistenciaDto): CandidatoAsistencia {
  return {
    prestadorId: dto.provider_id,
    nombre: dto.name,
    especialidades: [...dto.specialties],
    distanciaKm: dto.distance_km,
    disponibilidad: dto.availability,
    noDisponibleHasta: dto.unavailable_until ?? null,
    elegibilidad: dto.eligibility,
    sugerido: dto.suggested,
    llegadaMinutos: dto.eta_minutes,
    despachadosHoy: dto.dispatched_today,
  };
}

function mapearSugerencia(dto: SugerenciaDto): Sugerencia {
  return {
    estado: dto.state,
    especialidad: dto.specialty ?? null,
    fuenteUbicacion: dto.location_source ?? null,
    desdeRadioKm: dto.from_radius_km ?? null,
    radioKm: dto.radius_km ?? null,
    motivo: dto.reason ?? null,
    versionPolitica: dto.policy_version,
    intentos: dto.attempts.map((intento) => ({
      radioKm: intento.radius_km,
      elegibles: intento.eligible_count,
      intentadoEn: intento.attempted_at,
    })),
    candidatos: dto.candidates.map(mapearCandidato),
  };
}

function mapearDespacho(dto: DespachoDto): Despacho {
  return {
    prestador: {
      id: dto.provider.id,
      nombre: dto.provider.name,
      correo: dto.provider.contact_email,
      telefono: dto.provider.contact_phone ?? null,
    },
    necesidad: dto.need,
    especialidad: dto.specialty,
    distanciaKm: dto.distance_km,
    llegadaMinutos: dto.eta_minutes,
    ubicacionCompartida: {
      fuente: dto.location_shared.source,
      latitud: dto.location_shared.latitude,
      longitud: dto.location_shared.longitude,
      precisionM: dto.location_shared.accuracy_m ?? null,
      direccion: dto.location_shared.address ?? null,
      lugar: dto.location_shared.place ?? null,
    },
    prestadorSugeridoId: dto.suggested_provider_id ?? null,
    despachadaPor: mapearActor(dto.dispatched_by),
    despachadaEn: dto.dispatched_at,
    versionesPolitica: {
      asistencia: dto.policy_versions.assistance,
      asignacion: dto.policy_versions.assignment,
    },
    aviso: {
      estado: dto.notice.status,
      intentos: dto.notice.attempts,
      enviadoEn: dto.notice.sent_at ?? null,
    },
  };
}

export function mapearBandeja(dto: BandejaAsistenciasDto): BandejaAsistencias {
  return {
    resumen: {
      nuevas: dto.summary.new_count,
      enLlamada: dto.summary.in_call_count,
      despachadasHoy: dto.summary.dispatched_today,
      tiempoMedioDespachoSegundos: dto.summary.mean_dispatch_seconds_today ?? null,
      objetivoDespachoSegundos: dto.summary.dispatch_target_seconds,
    },
    solicitudes: dto.items.map(mapearSolicitud),
  };
}

export function mapearDetalleAsistencia(dto: DetalleAsistenciaDto): DetalleAsistencia {
  return {
    ...mapearSolicitud(dto),
    necesidad: dto.need
      ? {
          codigo: dto.need.code,
          especialidad: dto.need.specialty,
          registradaPor: mapearActor(dto.need.recorded_by),
          registradaEn: dto.need.recorded_at,
        }
      : null,
    sugerencia: mapearSugerencia(dto.suggestion),
    despacho: dto.dispatch ? mapearDespacho(dto.dispatch) : null,
    cierre: dto.closure
      ? {
          motivo: dto.closure.reason,
          nota: dto.closure.note ?? null,
          cerradaPor: mapearActor(dto.closure.closed_by),
          cerradaEn: dto.closure.closed_at,
        }
      : null,
    historial: dto.history.map((accion) => ({
      accion: accion.action,
      por: mapearActor(accion.by),
      en: accion.at,
      detalle: accion.detail ? { ...accion.detail } : null,
    })),
  };
}

export function mapearPoliticaAsistencia(dto: PoliticaAsistenciaDto): PoliticaAsistencia {
  return {
    version: dto.version,
    necesidades: dto.needs.map((n) => ({
      linea: n.line,
      codigo: n.code,
      especialidad: n.specialty,
    })),
    radiosKm: [...dto.radii_km],
    versionPoliticaAsignacion: dto.assignment_policy_version,
    llegada: {
      alistamientoMinutos: dto.eta.preparation_minutes,
      velocidadMediaKmh: dto.eta.average_speed_kmh,
    },
    motivosCierre: [...dto.close_reasons],
    objetivoDespachoSegundos: dto.dispatch_target_seconds,
  };
}

/** Cuerpo de `POST …/{request_id}/close`. La nota viaja sin espacios alrededor y solo si tiene texto. */
export function aCierreDto(solicitud: SolicitudCierre): Record<string, unknown> {
  const nota = solicitud.nota?.trim();
  return nota ? { reason: solicitud.motivo, note: nota } : { reason: solicitud.motivo };
}

// --- Errores -------------------------------------------------------------------------------------------------------

/** Códigos estables de la bandeja de asistencias (contrato, §2.10). */
export type CodigoErrorAsistencia =
  | 'invalid_request'
  | 'assistance_request_not_found'
  | 'assistance_not_open'
  | 'assistance_not_attended'
  | 'location_from_app'
  | 'need_not_for_line'
  | 'need_missing'
  | 'location_missing'
  | 'provider_not_eligible'
  | 'validation_failed'
  | 'assistance_unavailable';

const CODIGOS_ASISTENCIA: readonly string[] = [
  'invalid_request',
  'assistance_request_not_found',
  'assistance_not_open',
  'assistance_not_attended',
  'location_from_app',
  'need_not_for_line',
  'need_missing',
  'location_missing',
  'provider_not_eligible',
  'validation_failed',
  'assistance_unavailable',
];

export class ErrorAsistencia extends Error {
  constructor(
    readonly codigo: CodigoErrorAsistencia,
    readonly campos: readonly CampoInvalido[] = [],
  ) {
    super(`Error de la asistencia: ${codigo}`);
    this.name = 'ErrorAsistencia';
  }
}

/**
 * Traduce un error HTTP al código del contrato, con los campos de `validation_failed` (el `422` puede ser un `Error` o
 * un `FieldValidationError`). Sin cuerpo reconocible se decide por el estado: `400` → `invalid_request`, `404` →
 * `assistance_request_not_found` y lo demás (red, 5xx del API Gateway) → `assistance_unavailable`. El `401` y el `403`
 * los resuelve el interceptor.
 */
export function traducirErrorAsistencia(error: unknown): ErrorAsistencia {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorAsistencia('assistance_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_ASISTENCIA.includes(codigo)) {
      return new ErrorAsistencia(codigo as CodigoErrorAsistencia, leerCampos(cuerpo));
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorAsistencia('invalid_request');
    case 404:
      return new ErrorAsistencia('assistance_request_not_found');
    default:
      return new ErrorAsistencia('assistance_unavailable');
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
