import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la cotización asistida por asesor del servicio de originación (HU-W1.1-01), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.6.0) y su contrato para el front
 * (`docs/contratos/HU-W1.1-01-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos
 * tipos (camelCase).
 */

/** Campos de la solicitud, con el nombre que usa el formulario (el contrato los nombra en snake_case). */
export type CampoCotizacion =
  | 'documento'
  | 'nombreCompleto'
  | 'correo'
  | 'fechaNacimiento'
  | 'montoAsegurado'
  | 'plazoMeses'
  | 'consentimiento';

/** Código con el que el backend explica por qué un campo no es válido. */
export type CodigoCampo = 'required' | 'invalid_format' | 'out_of_range';

/** Datos que el asesor captura en S1. `fechaNacimiento` es `YYYY-MM-DD`. */
export interface SolicitudCotizacionAsistida {
  documento: string;
  nombreCompleto: string;
  correo: string;
  fechaNacimiento: string;
  montoAsegurado: number;
  plazoMeses: number;
  /** El asesor afirma el consentimiento del cliente mientras `audit` no exponga su consulta (HU-W1.2-01). */
  consentimientoActivo: boolean;
}

/** `normal` perfil fresco o reutilizado; `provisional` último perfil en caché o perfil actuarial base. */
export type ModoCotizacion = 'normal' | 'provisional';

/** Origen del perfil con el que se cotizó. */
export type OrigenCotizacion = 'open_finance' | 'external_sources' | 'cache' | 'base_actuarial';

/** Código del mensaje de modo degradado (S2b); el texto lo traduce la pantalla. */
export type AvisoCotizacion = 'last_profile_in_use' | 'personalization_unavailable';

export type EstadoCotizacion = 'valid' | 'expired';

export type CodigoCobertura = 'death' | 'total_permanent_disability';

export interface CoberturaCotizacion {
  codigo: CodigoCobertura;
  montoAsegurado: number;
}

/** Cotización asistida. Las fechas son RFC 3339 en UTC. */
export interface CotizacionAsistida {
  cotizacionId: string;
  clienteId: string;
  documento: string;
  nombreCompleto: string;
  correo: string;
  montoAsegurado: number;
  plazoMeses: number;
  /** Prima **mensual**, redondeada a 100 pesos. */
  prima: number;
  moneda: string;
  coberturas: CoberturaCotizacion[];
  versionTarifa: string;
  modo: ModoCotizacion;
  origen: OrigenCotizacion;
  puntaje: number;
  categoria: string;
  /** Fecha del perfil aplicado; `null` para el perfil actuarial base. */
  fechaPerfil: string | null;
  fuenteNoDisponible: string | null;
  aviso: AvisoCotizacion | null;
  creadaEn: string;
  /** Fin de la vigencia: `creadaEn` más 24 horas. */
  venceEn: string;
  estado: EstadoCotizacion;
  /** `false` una vez vencida: no se puede formalizar y hay que generar una nueva. */
  puedeFormalizar: boolean;
  motivoBloqueo: 'quote_expired' | null;
}

/** Cliente registrado, recuperado por su documento. */
export interface ClienteCotizacion {
  clienteId: string;
  documento: string;
  nombreCompleto: string;
  correo: string;
  /** `YYYY-MM-DD`. */
  fechaNacimiento: string;
}

/** Respuesta cruda del contrato (snake_case). */
export interface CotizacionAsistidaDto {
  quote_id: string;
  customer_id: string;
  customer: { document_id: string; full_name: string; email: string };
  insured_amount: number;
  term_months: number;
  premium: number;
  currency: string;
  coverages: { code: CodigoCobertura; insured_amount: number }[];
  rating_version: string;
  mode: ModoCotizacion;
  source: OrigenCotizacion;
  profile: { score: number; category: string };
  profile_date: string | null;
  unavailable_source: string | null;
  notice: AvisoCotizacion | null;
  created_at: string;
  expires_at: string;
  status: EstadoCotizacion;
  can_formalize: boolean;
  blocked_reason: 'quote_expired' | null;
}

export interface ClienteDto {
  customer_id: string;
  document_id: string;
  full_name: string;
  email: string;
  birth_date: string;
}

/** Traduce la respuesta del contrato al modelo del cliente. */
export function mapearCotizacionAsistida(dto: CotizacionAsistidaDto): CotizacionAsistida {
  return {
    cotizacionId: dto.quote_id,
    clienteId: dto.customer_id,
    documento: dto.customer.document_id,
    nombreCompleto: dto.customer.full_name,
    correo: dto.customer.email,
    montoAsegurado: dto.insured_amount,
    plazoMeses: dto.term_months,
    prima: dto.premium,
    moneda: dto.currency,
    coberturas: dto.coverages.map((c) => ({ codigo: c.code, montoAsegurado: c.insured_amount })),
    versionTarifa: dto.rating_version,
    modo: dto.mode,
    origen: dto.source,
    puntaje: dto.profile.score,
    categoria: dto.profile.category,
    fechaPerfil: dto.profile_date,
    fuenteNoDisponible: dto.unavailable_source,
    aviso: dto.notice,
    creadaEn: dto.created_at,
    venceEn: dto.expires_at,
    estado: dto.status,
    puedeFormalizar: dto.can_formalize,
    motivoBloqueo: dto.blocked_reason,
  };
}

export function mapearCliente(dto: ClienteDto): ClienteCotizacion {
  return {
    clienteId: dto.customer_id,
    documento: dto.document_id,
    nombreCompleto: dto.full_name,
    correo: dto.email,
    fechaNacimiento: dto.birth_date,
  };
}

/** Cuerpo de `POST /v1/assisted-quotes`. */
export function aSolicitudDto(s: SolicitudCotizacionAsistida): Record<string, unknown> {
  return {
    document_id: s.documento,
    full_name: s.nombreCompleto,
    email: s.correo,
    birth_date: s.fechaNacimiento,
    insured_amount: s.montoAsegurado,
    term_months: s.plazoMeses,
    consent_active: s.consentimientoActivo,
  };
}

/** Códigos estables del contrato. La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorCotizacion =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'validation_failed'
  | 'consent_required'
  | 'quote_not_found'
  | 'customer_not_found'
  | 'quote_unavailable'
  | 'customer_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'validation_failed',
  'consent_required',
  'quote_not_found',
  'customer_not_found',
  'quote_unavailable',
  'customer_unavailable',
];

const CODIGOS_CAMPO: readonly string[] = ['required', 'invalid_format', 'out_of_range'];

/** Campo del contrato (snake_case) → campo del formulario. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoCotizacion>> = {
  document_id: 'documento',
  full_name: 'nombreCompleto',
  email: 'correo',
  birth_date: 'fechaNacimiento',
  insured_amount: 'montoAsegurado',
  term_months: 'plazoMeses',
  consent_active: 'consentimiento',
};

/** Un campo inválido según el backend. */
export interface ErrorDeCampo {
  campo: CampoCotizacion;
  codigo: CodigoCampo;
}

/** Error de las rutas de cotización asistida, con el código estable del contrato. */
export class ErrorCotizacionAsistida extends Error {
  constructor(
    readonly codigo: CodigoErrorCotizacion,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampo[] = [],
  ) {
    super(`Error de cotización asistida: ${codigo}`);
    this.name = 'ErrorCotizacionAsistida';
  }
}

/** Código que se usa cuando la respuesta no trae un cuerpo JSON del contrato, según el endpoint. */
export interface RespaldoErrorCotizacion {
  noEncontrado: 'quote_not_found' | 'customer_not_found';
  indisponible: 'quote_unavailable' | 'customer_unavailable';
}

function esCodigoError(valor: unknown): valor is CodigoErrorCotizacion {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampo[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampo[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    const campo = typeof field === 'string' ? CAMPO_DEL_CONTRATO[field] : undefined;
    if (campo && typeof code === 'string' && CODIGOS_CAMPO.includes(code)) {
      campos.push({ campo, codigo: code as CodigoCampo });
    }
  }
  return campos;
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway)
 * se trata como el 503 del mismo endpoint.
 */
export function traducirErrorCotizacion(error: unknown, respaldo: RespaldoErrorCotizacion): ErrorCotizacionAsistida {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorCotizacionAsistida(respaldo.indisponible);
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const campos = cuerpo as Record<string, unknown>;
    const codigo = campos['error'];
    if (esCodigoError(codigo)) {
      return new ErrorCotizacionAsistida(codigo, codigo === 'validation_failed' ? extraerCampos(campos) : []);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorCotizacionAsistida('invalid_request');
    case 401:
      return new ErrorCotizacionAsistida('unauthorized');
    case 403:
      return new ErrorCotizacionAsistida('forbidden');
    case 404:
      return new ErrorCotizacionAsistida(respaldo.noEncontrado);
    default:
      return new ErrorCotizacionAsistida(respaldo.indisponible);
  }
}
