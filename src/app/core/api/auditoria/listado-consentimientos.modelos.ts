import { HttpErrorResponse, HttpParams } from '@angular/common/http';

import { CodigoFuente, FuenteConsentimiento, VigenciaFuente } from './consentimiento.modelos';
import { EntidadConsentimiento, EstadoAviso, EstadoConsentimiento } from './revocacion.modelos';

/**
 * Modelos del listado de consentimientos del portal de cumplimiento (HU-W4.2-01), tipados según
 * `services/audit/api/openapi.yaml` 0.6.0 del backend y su contrato para el front (`HU-W4.2-01-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/** Estados por los que se puede filtrar: uno por valor de la API (decisión D-6 a). */
export type EstadoFiltroConsentimiento = 'active' | 'revoked' | 'partially_revoked' | 'expired';

export const ESTADOS_FILTRO: readonly EstadoFiltroConsentimiento[] = ['active', 'revoked', 'partially_revoked', 'expired'];

/** Filtro del listado. Las fechas son días civiles de Colombia en formato `AAAA-MM-DD`; `null` es «sin filtro». */
export interface FiltroConsentimientos {
  estado: EstadoFiltroConsentimiento | null;
  desde: string | null;
  hasta: string | null;
  entidad: string | null;
  /** Identificador exacto, documento exacto o parte del nombre del titular. */
  cliente: string | null;
  /** Empieza en 1. */
  pagina: number;
  tamano: number;
}

/** Revocación que terminó el consentimiento, en la fila del listado. */
export interface RevocacionResumen {
  efectivaEn: string;
  /** `mobile_app` o `compliance_portal`; texto libre. */
  canal: string;
  estadoAviso: EstadoAviso;
}

/** Una fila del listado (CA-1). */
export interface ResumenConsentimiento {
  consentimientoId: string;
  titular: { nombreCompleto: string; documentoEnmascarado: string };
  otorgadoEn: string;
  venceEn: string;
  /** Cuándo dejó de estar vigente (revocado o vencido); `null` mientras lo esté. */
  finalizadoEn: string | null;
  estado: EstadoConsentimiento;
  revocacion: RevocacionResumen | null;
  canalOtorgamiento: string;
  alcance: FuenteConsentimiento[];
  entidades: EntidadConsentimiento[];
}

/** Las cuatro tarjetas del listado (decisión D-5 a). No dependen del filtro. */
export interface IndicadoresConsentimientos {
  activos: number;
  vencidos: number;
  revocados30Dias: { total: number; desdeApp: number; desdePortal: number };
  fueraDePlazo: number;
  calculadoEn: string;
}

/** Una página del listado. */
export interface PaginaConsentimientos {
  items: ResumenConsentimiento[];
  pagina: number;
  tamano: number;
  totalRegistros: number;
  /** Al menos 1: una lista vacía es «página 1 de 1». */
  totalPaginas: number;
  indicadores: IndicadoresConsentimientos;
  /** Opciones del filtro por entidad, por nombre. */
  entidades: EntidadConsentimiento[];
}

interface FuenteDto {
  code: CodigoFuente;
  data_categories: string[];
  validity: VigenciaFuente;
}

interface ResumenConsentimientoDto {
  consent_id: string;
  holder: { full_name: string; document_masked: string };
  granted_at: string;
  expires_at: string;
  ended_at: string | null;
  status: EstadoConsentimiento;
  revocation: { effective_at: string; channel: string; notice_status: EstadoAviso } | null;
  grant_channel: string;
  scope: FuenteDto[];
  entities: { code: string; name: string }[];
}

/** Respuesta cruda de `GET /v1/audit/consents`. */
export interface PaginaConsentimientosDto {
  items: ResumenConsentimientoDto[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  indicators: {
    active: number;
    expired: number;
    revoked_last_30_days: { total: number; mobile_app: number; compliance_portal: number };
    revocations_out_of_deadline: number;
    as_of: string;
  };
  entities: { code: string; name: string }[];
}

/** Parámetros de la consulta: solo los filtros que tienen valor, con los nombres del contrato. */
export function aParametrosListado(filtro: FiltroConsentimientos): HttpParams {
  let parametros = new HttpParams().set('page', String(filtro.pagina)).set('page_size', String(filtro.tamano));
  if (filtro.estado) {
    parametros = parametros.set('status', filtro.estado);
  }
  if (filtro.desde) {
    parametros = parametros.set('granted_from', filtro.desde);
  }
  if (filtro.hasta) {
    parametros = parametros.set('granted_to', filtro.hasta);
  }
  if (filtro.entidad) {
    parametros = parametros.set('entity', filtro.entidad);
  }
  const cliente = filtro.cliente?.trim();
  if (cliente) {
    parametros = parametros.set('q', cliente);
  }
  return parametros;
}

function mapearResumen(dto: ResumenConsentimientoDto): ResumenConsentimiento {
  return {
    consentimientoId: dto.consent_id,
    titular: { nombreCompleto: dto.holder.full_name, documentoEnmascarado: dto.holder.document_masked },
    otorgadoEn: dto.granted_at,
    venceEn: dto.expires_at,
    finalizadoEn: dto.ended_at ?? null,
    estado: dto.status,
    revocacion: dto.revocation
      ? { efectivaEn: dto.revocation.effective_at, canal: dto.revocation.channel, estadoAviso: dto.revocation.notice_status }
      : null,
    canalOtorgamiento: dto.grant_channel,
    alcance: dto.scope.map((f) => ({ codigo: f.code, categoriasDatos: f.data_categories, vigencia: f.validity })),
    entidades: dto.entities.map((e) => ({ codigo: e.code, nombre: e.name })),
  };
}

export function mapearPaginaConsentimientos(dto: PaginaConsentimientosDto): PaginaConsentimientos {
  const indicadores = dto.indicators;
  return {
    items: dto.items.map(mapearResumen),
    pagina: dto.page,
    tamano: dto.page_size,
    totalRegistros: dto.total_items,
    totalPaginas: Math.max(1, dto.total_pages),
    indicadores: {
      activos: indicadores.active,
      vencidos: indicadores.expired,
      revocados30Dias: {
        total: indicadores.revoked_last_30_days.total,
        desdeApp: indicadores.revoked_last_30_days.mobile_app,
        desdePortal: indicadores.revoked_last_30_days.compliance_portal,
      },
      fueraDePlazo: indicadores.revocations_out_of_deadline,
      calculadoEn: indicadores.as_of,
    },
    entidades: dto.entities.map((e) => ({ codigo: e.code, nombre: e.name })),
  };
}

/** Códigos estables del contrato (`Error.error`) más los dos que resuelve el interceptor. */
export type CodigoErrorListado = 'validation_failed' | 'unauthorized' | 'forbidden' | 'service_unavailable';

/** Parámetro del filtro al que apunta un error de validación del backend. */
export type CampoListado = 'estado' | 'desde' | 'hasta' | 'entidad' | 'cliente' | 'pagina' | 'tamano';

/** Parámetro del contrato → campo del filtro. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoListado>> = {
  status: 'estado',
  granted_from: 'desde',
  granted_to: 'hasta',
  entity: 'entidad',
  q: 'cliente',
  page: 'pagina',
  page_size: 'tamano',
};

export interface ErrorDeCampoListado {
  campo: CampoListado;
  codigo: string;
}

/** Error del listado, con el código estable del contrato. */
export class ErrorListado extends Error {
  constructor(
    readonly codigo: CodigoErrorListado,
    /** Solo con `validation_failed`: todos los parámetros con error a la vez. */
    readonly campos: ErrorDeCampoListado[] = [],
  ) {
    super(`Error del listado de consentimientos: ${codigo}`);
    this.name = 'ErrorListado';
  }
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoListado[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoListado[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    const campo = typeof field === 'string' ? CAMPO_DEL_CONTRATO[field] : undefined;
    if (campo && typeof code === 'string') {
      campos.push({ campo, codigo: code });
    }
  }
  return campos;
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se trata como
 * `service_unavailable`: reintentar es seguro, el listado solo lee.
 */
export function traducirErrorListado(error: unknown): ErrorListado {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorListado('service_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null && (cuerpo as Record<string, unknown>)['error'] === 'validation_failed') {
    return new ErrorListado('validation_failed', extraerCampos(cuerpo as Record<string, unknown>));
  }
  switch (error.status) {
    case 400:
      return new ErrorListado('validation_failed');
    case 401:
      return new ErrorListado('unauthorized');
    case 403:
      return new ErrorListado('forbidden');
    default:
      return new ErrorListado('service_unavailable');
  }
}
