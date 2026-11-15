import { HttpErrorResponse, HttpParams } from '@angular/common/http';

import {
  Beneficiario,
  BeneficiarioDto,
  BeneficiarioOneroso,
  CambioCampo,
  OnerosoDto,
  TIPOS_CAMBIO,
  TipoCambio,
  mapearBeneficiario,
} from './solicitud-modificacion.modelos';

/**
 * Modelos de la aplicación controlada del endoso (HU-W1.4-02, pantallas O2, O3, O3b y O4), tipados según
 * `services/origination/api/openapi.yaml` 0.17.0 del backend y su contrato para el front (`HU-W1.4-02-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase). Reutiliza los tipos de la solicitud de HU-W1.4-01.
 */

/** Estado de la solicitud como lo ve el analista. Un valor que este cliente no conoce llega como `desconocido`. */
export type EstadoEndoso = 'radicada' | 'enRevision' | 'aplicada' | 'rechazada' | 'noAplicado' | 'desconocido';

/** Filtro «Estado» de la bandeja, en el idioma del contrato; `pending` es el de por defecto. */
export type EstadoFiltroEndoso = 'pending' | 'filed' | 'in_review' | 'applied' | 'rejected' | 'not_applied' | 'all';

export const ESTADOS_FILTRO_ENDOSO: readonly EstadoFiltroEndoso[] = [
  'pending',
  'filed',
  'in_review',
  'applied',
  'rejected',
  'not_applied',
  'all',
];

/** Códigos de las validaciones de negocio (decisión D-4 a). */
export type CodigoValidacion =
  | 'shares_total_100'
  | 'onerous_beneficiary_intact'
  | 'identity_documents_valid'
  | 'no_open_claim'
  | 'requester_is_holder'
  | 'insured_amount_within_limits'
  | 'personal_data_valid'
  | 'policy_in_force'
  | 'previous_values_current'
  | 'no_renewal_in_progress'
  | 'premium_recalculated';

/** «Cumple», «No cumple» o «No verificable». */
export type ResultadoValidacion = 'passed' | 'failed' | 'unverifiable';

export interface Validacion {
  /** El código del contrato; uno que este cliente no conoce se muestra con un texto genérico. */
  codigo: string;
  resultado: ResultadoValidacion;
  /** Los valores del texto (participaciones, verificaciones, siniestros en curso…). */
  parametros: Readonly<Record<string, string>>;
}

/** De dónde salen las validaciones del detalle. */
export type OrigenValidaciones = 'preview' | 'attempt' | 'none';

export interface TitularPoliza {
  nombre: string;
  documento: string;
}

/** La solicitud como la lee el analista: nunca el correo ni el `sub` del asegurado. */
export interface SolicitudEndoso {
  solicitudId: string;
  polizaId: string;
  tipo: TipoCambio;
  canal: string;
  radicadaEn: string;
  estadoGuardado: string;
  estado: EstadoEndoso;
  cambioEstadoEn: string;
  /** Una `not_applied` que el analista ya devolvió al asegurado. */
  devuelta: boolean;
  motivo: string | null;
  solicitante: string | null;
}

export interface FilaEndoso extends SolicitudEndoso {
  titular: TitularPoliza;
}

export interface IndicadoresEndosos {
  pendientes: number;
  /** Las pendientes radicadas hace más de 24 h. */
  vencidas: number;
  aplicadasHoy: number;
  /** Segundos de radicación a aplicación de las de hoy; `null` sin ninguna. */
  tiempoMedioSegundos: number | null;
  rechazadas7Dias: number;
  /** Código de la validación que más falló, `analyst_rejection` o `null`. */
  motivoFrecuente: string | null;
}

export interface PaginaEndosos {
  items: FilaEndoso[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
  indicadores: IndicadoresEndosos;
}

/** Filtro de la bandeja. `desde` es un día civil de Colombia `AAAA-MM-DD`; `null` es «sin filtro». */
export interface FiltroEndosos {
  tipo: TipoCambio | null;
  estado: EstadoFiltroEndoso;
  desde: string | null;
  /** Empieza en 1. */
  pagina: number;
  tamano: number;
}

export interface CambioPrima {
  anterior: number;
  /** `null` si el motor no pudo tarifar la nueva suma. */
  nueva: number | null;
  moneda: string;
  versionMotor: string | null;
}

export interface PolizaEndoso {
  polizaId: string;
  linea: string;
  titular: TitularPoliza;
  vigente: boolean;
  vigenciaDesde: string;
  vigenciaHasta: string;
  valorAsegurado: number;
  prima: number;
  moneda: string;
  oneroso: BeneficiarioOneroso | null;
  endososPrevios: { cantidad: number; ultimo: { endosoId: string; tipo: TipoCambio; aplicadoEn: string } | null };
}

export interface Autor {
  nombre: string;
  rol: string;
}

/** Lo que se decidió sobre la solicitud. */
export interface DecisionEndoso {
  resultado: 'applied' | 'not_applied' | 'rejected' | 'returned' | string;
  por: Autor | null;
  en: string;
  observaciones: string | null;
  endosoId: string | null;
  /** Códigos de las validaciones que no cumplieron. */
  fallidas: string[];
}

export interface DetalleEndoso {
  solicitud: SolicitudEndoso;
  cambios: CambioCampo[];
  prima: CambioPrima | null;
  poliza: PolizaEndoso;
  validaciones: Validacion[];
  origenValidaciones: OrigenValidaciones;
  decision: DecisionEndoso | null;
}

/** El resultado de «Aplicar endoso». */
export interface ResultadoAplicacion {
  resultado: 'applied' | 'not_applied';
  solicitud: SolicitudEndoso;
  endoso: { endosoId: string; version: number; aplicadoEn: string; por: Autor } | null;
  intento: { en: string; por: Autor; fallidas: string[] } | null;
  validaciones: Validacion[];
}

export interface EntradaHistorial {
  resultado: 'applied' | 'not_applied' | string;
  en: string;
  endosoId: string | null;
  solicitudId: string;
  tipo: TipoCambio;
  cambios: CambioCampo[];
  prima: { anterior: number; nueva: number; moneda: string } | null;
  fallidas: string[];
  por: Autor;
}

export interface HistorialEndosos {
  polizaId: string;
  titular: TitularPoliza;
  entradas: EntradaHistorial[];
}

/** Respuestas crudas del contrato (snake_case). */
export interface SolicitudEndosoDto {
  request_id: string;
  policy_id: string;
  change_type: string;
  channel: string;
  filed_at: string;
  status: string;
  status_changed_at: string;
  returned: boolean;
  decision_reason: string | null;
  requester_name: string | null;
}

export interface TitularDto {
  full_name: string;
  document_id: string;
}

export interface FilaEndosoDto extends SolicitudEndosoDto {
  holder: TitularDto;
}

export interface PaginaEndososDto {
  items: FilaEndosoDto[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  indicators: {
    pending: { count: number; overdue: number };
    applied_today: { count: number; mean_time_to_apply_seconds: number | null };
    rejected_last_7_days: { count: number; top_reason: string | null };
  };
}

export interface ValidacionDto {
  code: string;
  outcome: string;
  params: Record<string, string> | null;
}

export interface AutorDto {
  name: string;
  role: string;
}

export interface CambioCampoDto {
  field: string;
  previous: unknown;
  requested: unknown;
}

export interface DetalleEndosoDto {
  request: SolicitudEndosoDto;
  changes: CambioCampoDto[];
  premium: { previous: number; new: number | null; currency: string; rating_version: string | null } | null;
  policy: {
    policy_id: string;
    line: string;
    holder: TitularDto;
    in_force: boolean;
    coverage_start: string;
    coverage_end: string;
    insured_amount: number;
    premium: number;
    currency: string;
    onerous_beneficiary: OnerosoDto | null;
    endorsements: { count: number; last: { endorsement_id: string; change_type: string; applied_at: string } | null };
  };
  validations: ValidacionDto[];
  validations_source: string;
  decision: {
    outcome: string;
    by: AutorDto | null;
    at: string;
    observations: string | null;
    endorsement_id: string | null;
    failed: string[] | null;
  } | null;
}

export interface ResultadoAplicacionDto {
  outcome: string;
  request: SolicitudEndosoDto;
  endorsement: { endorsement_id: string; version: number; applied_at: string; by: AutorDto } | null;
  attempt: { at: string; by: AutorDto; failed: string[] | null } | null;
  validations: ValidacionDto[];
}

export interface HistorialEndososDto {
  policy_id: string;
  holder: TitularDto;
  entries: {
    outcome: string;
    at: string;
    endorsement_id: string | null;
    request_id: string;
    change_type: string;
    changes: CambioCampoDto[];
    premium: { previous: number; new: number; currency: string } | null;
    failed: string[] | null;
    by: AutorDto;
  }[];
}

function tipoDe(valor: string): TipoCambio {
  return (TIPOS_CAMBIO as readonly string[]).includes(valor) ? (valor as TipoCambio) : 'beneficiaries';
}

/** El estado como lo ve el analista: una `not_applied` sigue «No aplicado» se haya devuelto o no. */
export function estadoParaAnalista(estado: string): EstadoEndoso {
  switch (estado) {
    case 'filed':
      return 'radicada';
    case 'in_review':
      return 'enRevision';
    case 'applied':
      return 'aplicada';
    case 'rejected':
      return 'rechazada';
    case 'not_applied':
      return 'noAplicado';
    default:
      return 'desconocido';
  }
}

function mapearSolicitud(dto: SolicitudEndosoDto): SolicitudEndoso {
  return {
    solicitudId: dto.request_id,
    polizaId: dto.policy_id,
    tipo: tipoDe(dto.change_type),
    canal: dto.channel,
    radicadaEn: dto.filed_at,
    estadoGuardado: dto.status,
    estado: estadoParaAnalista(dto.status),
    cambioEstadoEn: dto.status_changed_at,
    devuelta: dto.returned,
    motivo: dto.decision_reason,
    solicitante: dto.requester_name,
  };
}

function mapearTitular(dto: TitularDto): TitularPoliza {
  return { nombre: dto.full_name, documento: dto.document_id };
}

function mapearValidacion(dto: ValidacionDto): Validacion {
  const resultado: ResultadoValidacion =
    dto.outcome === 'passed' || dto.outcome === 'failed' ? dto.outcome : 'unverifiable';
  return { codigo: dto.code, resultado, parametros: dto.params ?? {} };
}

function mapearAutor(dto: AutorDto): Autor {
  return { nombre: dto.name, rol: dto.role };
}

function valorDeCambio(valor: unknown): Beneficiario | number | string | null {
  if (typeof valor === 'number' || typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'object' && valor !== null && 'full_name' in valor) {
    return mapearBeneficiario(valor as BeneficiarioDto);
  }
  return null;
}

function mapearCambios(cambios: CambioCampoDto[]): CambioCampo[] {
  return cambios.map((c) => ({ campo: c.field, anterior: valorDeCambio(c.previous), nuevo: valorDeCambio(c.requested) }));
}

export function mapearPaginaEndosos(dto: PaginaEndososDto): PaginaEndosos {
  const ind = dto.indicators;
  return {
    items: dto.items.map((f) => ({ ...mapearSolicitud(f), titular: mapearTitular(f.holder) })),
    pagina: dto.page,
    tamano: dto.page_size,
    total: dto.total_items,
    totalPaginas: dto.total_pages,
    indicadores: {
      pendientes: ind.pending.count,
      vencidas: ind.pending.overdue,
      aplicadasHoy: ind.applied_today.count,
      tiempoMedioSegundos: ind.applied_today.mean_time_to_apply_seconds,
      rechazadas7Dias: ind.rejected_last_7_days.count,
      motivoFrecuente: ind.rejected_last_7_days.top_reason,
    },
  };
}

export function mapearDetalleEndoso(dto: DetalleEndosoDto): DetalleEndoso {
  const p = dto.policy;
  const origen = dto.validations_source;
  return {
    solicitud: mapearSolicitud(dto.request),
    cambios: mapearCambios(dto.changes),
    prima: dto.premium
      ? { anterior: dto.premium.previous, nueva: dto.premium.new, moneda: dto.premium.currency, versionMotor: dto.premium.rating_version }
      : null,
    poliza: {
      polizaId: p.policy_id,
      linea: p.line,
      titular: mapearTitular(p.holder),
      vigente: p.in_force,
      vigenciaDesde: p.coverage_start,
      vigenciaHasta: p.coverage_end,
      valorAsegurado: p.insured_amount,
      prima: p.premium,
      moneda: p.currency,
      oneroso: p.onerous_beneficiary
        ? { aliadoId: p.onerous_beneficiary.partner_id, nombre: p.onerous_beneficiary.name, base: p.onerous_beneficiary.basis }
        : null,
      endososPrevios: {
        cantidad: p.endorsements.count,
        ultimo: p.endorsements.last
          ? {
              endosoId: p.endorsements.last.endorsement_id,
              tipo: tipoDe(p.endorsements.last.change_type),
              aplicadoEn: p.endorsements.last.applied_at,
            }
          : null,
      },
    },
    validaciones: dto.validations.map(mapearValidacion),
    origenValidaciones: origen === 'preview' || origen === 'attempt' ? origen : 'none',
    decision: dto.decision
      ? {
          resultado: dto.decision.outcome,
          por: dto.decision.by ? mapearAutor(dto.decision.by) : null,
          en: dto.decision.at,
          observaciones: dto.decision.observations,
          endosoId: dto.decision.endorsement_id,
          fallidas: dto.decision.failed ?? [],
        }
      : null,
  };
}

export function mapearResultadoAplicacion(dto: ResultadoAplicacionDto): ResultadoAplicacion {
  return {
    resultado: dto.outcome === 'applied' ? 'applied' : 'not_applied',
    solicitud: mapearSolicitud(dto.request),
    endoso: dto.endorsement
      ? {
          endosoId: dto.endorsement.endorsement_id,
          version: dto.endorsement.version,
          aplicadoEn: dto.endorsement.applied_at,
          por: mapearAutor(dto.endorsement.by),
        }
      : null,
    intento: dto.attempt ? { en: dto.attempt.at, por: mapearAutor(dto.attempt.by), fallidas: dto.attempt.failed ?? [] } : null,
    validaciones: dto.validations.map(mapearValidacion),
  };
}

export function mapearSolicitudEndoso(dto: { request: SolicitudEndosoDto }): SolicitudEndoso {
  return mapearSolicitud(dto.request);
}

export function mapearHistorialEndosos(dto: HistorialEndososDto): HistorialEndosos {
  return {
    polizaId: dto.policy_id,
    titular: mapearTitular(dto.holder),
    entradas: dto.entries.map((e) => ({
      resultado: e.outcome,
      en: e.at,
      endosoId: e.endorsement_id,
      solicitudId: e.request_id,
      tipo: tipoDe(e.change_type),
      cambios: mapearCambios(e.changes),
      prima: e.premium ? { anterior: e.premium.previous, nueva: e.premium.new, moneda: e.premium.currency } : null,
      fallidas: e.failed ?? [],
      por: mapearAutor(e.by),
    })),
  };
}

/** Los parámetros de la bandeja: solo los que se filtran. */
export function aParametrosEndosos(filtro: FiltroEndosos): HttpParams {
  let parametros = new HttpParams()
    .set('status', filtro.estado)
    .set('page', String(filtro.pagina))
    .set('page_size', String(filtro.tamano));
  if (filtro.tipo) {
    parametros = parametros.set('change_type', filtro.tipo);
  }
  if (filtro.desde) {
    parametros = parametros.set('filed_from', filtro.desde);
  }
  return parametros;
}

/** Códigos estables del contrato. La pantalla decide por el código, nunca por `message`. */
export type CodigoErrorEndoso =
  | 'invalid_request'
  | 'validation_failed'
  | 'out_of_range'
  | 'unauthorized'
  | 'forbidden'
  | 'change_request_not_found'
  | 'policy_not_found'
  /** Otro analista decidió antes: `estadoActual` dice cómo quedó. */
  | 'request_already_decided'
  /** Solo una no aplicada sin devolver se devuelve. */
  | 'not_returnable'
  /** Otro endoso de la misma póliza se aplicó antes: no cambió nada y se puede reintentar. */
  | 'policy_changed'
  /** Las observaciones (10 a 500 caracteres) faltan. */
  | 'observations_required'
  /** Una validación no se pudo verificar: no cambió nada; `noVerificables` dice cuáles. */
  | 'validation_unverifiable'
  /** La base de originación no respondió: reintentar es seguro. */
  | 'endorsement_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'validation_failed',
  'out_of_range',
  'unauthorized',
  'forbidden',
  'change_request_not_found',
  'policy_not_found',
  'request_already_decided',
  'not_returnable',
  'policy_changed',
  'observations_required',
  'validation_unverifiable',
  'endorsement_unavailable',
];

/** Error de la revisión del endoso, con el código estable del contrato. */
export class ErrorEndoso extends Error {
  constructor(
    readonly codigo: CodigoErrorEndoso,
    /** Solo con `request_already_decided` y `not_returnable`: el estado guardado que dejó el otro analista. */
    readonly estadoActual: string | null = null,
    /** Solo con `validation_unverifiable`. */
    readonly noVerificables: string[] = [],
  ) {
    super(`Error del endoso: ${codigo}`);
    this.name = 'ErrorEndoso';
  }
}

/** Traduce un error HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorEndoso(error: unknown): ErrorEndoso {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorEndoso('endorsement_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const registro = cuerpo as Record<string, unknown>;
    const codigo = registro['error'];
    if (typeof codigo === 'string' && CODIGOS_ERROR.includes(codigo)) {
      const estado = registro['status'];
      const lista = registro['unverifiable'];
      return new ErrorEndoso(
        codigo as CodigoErrorEndoso,
        typeof estado === 'string' ? estado : null,
        Array.isArray(lista) ? lista.filter((c): c is string => typeof c === 'string') : [],
      );
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorEndoso('invalid_request');
    case 401:
      return new ErrorEndoso('unauthorized');
    case 403:
      return new ErrorEndoso('forbidden');
    case 404:
      return new ErrorEndoso('change_request_not_found');
    case 409:
      return new ErrorEndoso('request_already_decided');
    default:
      return new ErrorEndoso('endorsement_unavailable');
  }
}
