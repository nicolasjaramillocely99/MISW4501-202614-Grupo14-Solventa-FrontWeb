import { HttpErrorResponse, HttpParams } from '@angular/common/http';

/**
 * Modelos del desempeño técnico de la API de socios (HU-W3.2-03, pantalla B3), tipados según
 * `services/partners/api/openapi.yaml` 0.3.0 del backend y su contrato para el front (`HU-W3.2-03-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase). Todo sale de las alarmas del SLO de la API de socios
 * en CloudWatch, la misma medida del SLO (CA-5).
 */

/** Periodo del tablero: hoy, últimos 7 días o últimos 30 días (días de Colombia hasta ahora). */
export type PeriodoDesempeno = 'today' | '7d' | '30d';

export const PERIODOS_DESEMPENO: readonly PeriodoDesempeno[] = ['today', '7d', '30d'];

/** El tablero abre con los últimos 7 días, como el prototipo (B3). */
export const PERIODO_INICIAL: PeriodoDesempeno = '7d';

/**
 * Estado actual de la API (CA-1): `operational` sin incidentes activos, `degraded` con uno que afecta el SLO,
 * `unavailable` con uno que impide atenderla. Un valor que este cliente no conoce llega como `desconocido`.
 */
export type EstadoApi = 'operational' | 'degraded' | 'unavailable' | 'desconocido';

/** Tipo de incidente: degradó la API o la dejó sin servicio. */
export type TipoIncidente = 'degraded' | 'unavailable' | 'desconocido';

/** Un incidente del periodo (CA-3). Las fechas son RFC 3339 en UTC. */
export interface IncidenteApi {
  id: string;
  tipo: TipoIncidente;
  /** Método y ruta afectada, p. ej. `POST /v1/offers`. */
  ruta: string;
  inicio: string;
  /** `null` mientras sigue abierto. */
  fin: string | null;
  duracionSegundos: number;
  resuelto: boolean;
}

/** Desempeño técnico de la API en el periodo. */
export interface DesempenoApi {
  periodo: PeriodoDesempeno;
  desde: string;
  hasta: string;
  estado: EstadoApi;
  disponibilidad: { porcentaje: number; objetivo: number; peticiones: number; errores: number };
  /** `p95Ms` es `null` sin peticiones en el periodo. */
  latencia: { p95Ms: number | null; presupuestoMs: number };
  /** El más reciente primero. Vacío: la integración operó sin interrupciones (CA-4). */
  incidentes: IncidenteApi[];
}

/** Respuestas crudas del contrato (snake_case). */
export interface IncidenteApiDto {
  id: string;
  kind: string;
  route: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  resolved: boolean;
}

export interface DesempenoApiDto {
  period: PeriodoDesempeno;
  from: string;
  to: string;
  status: string;
  availability: { percent: number; objective_percent: number; requests: number; server_errors: number };
  latency: { p95_ms: number | null; budget_ms: number };
  incidents: IncidenteApiDto[];
}

export function aParametrosDesempeno(periodo: PeriodoDesempeno): HttpParams {
  return new HttpParams().set('period', periodo);
}

function estadoDe(valor: string): EstadoApi {
  return valor === 'operational' || valor === 'degraded' || valor === 'unavailable' ? valor : 'desconocido';
}

function tipoDe(valor: string): TipoIncidente {
  return valor === 'degraded' || valor === 'unavailable' ? valor : 'desconocido';
}

export function mapearDesempeno(dto: DesempenoApiDto): DesempenoApi {
  return {
    periodo: dto.period,
    desde: dto.from,
    hasta: dto.to,
    estado: estadoDe(dto.status),
    disponibilidad: {
      porcentaje: dto.availability.percent,
      objetivo: dto.availability.objective_percent,
      peticiones: dto.availability.requests,
      errores: dto.availability.server_errors,
    },
    latencia: { p95Ms: dto.latency.p95_ms, presupuestoMs: dto.latency.budget_ms },
    incidentes: dto.incidents.map((i) => ({
      id: i.id,
      tipo: tipoDe(i.kind),
      ruta: i.route,
      inicio: i.started_at,
      fin: i.ended_at,
      duracionSegundos: i.duration_seconds,
      resuelto: i.resolved,
    })),
  };
}

/** Códigos estables del contrato. La pantalla decide por el código, nunca por `message`. */
export type CodigoErrorDesempeno =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  /** CloudWatch no respondió o no hay alarmas del SLO: reintentar es seguro, solo lee. */
  | 'telemetry_unavailable';

const CODIGOS_ERROR: readonly string[] = ['invalid_request', 'unauthorized', 'forbidden', 'telemetry_unavailable'];

/** Error del desempeño técnico, con el código estable del contrato. */
export class ErrorDesempeno extends Error {
  constructor(readonly codigo: CodigoErrorDesempeno) {
    super(`Error del desempeño técnico: ${codigo}`);
    this.name = 'ErrorDesempeno';
  }
}

/** Traduce un error HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorDesempeno(error: unknown): ErrorDesempeno {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorDesempeno('telemetry_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_ERROR.includes(codigo)) {
      return new ErrorDesempeno(codigo as CodigoErrorDesempeno);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorDesempeno('invalid_request');
    case 401:
      return new ErrorDesempeno('unauthorized');
    case 403:
      return new ErrorDesempeno('forbidden');
    default:
      return new ErrorDesempeno('telemetry_unavailable');
  }
}
