import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la oferta personalizada del servicio de originación (HU-W1.2-03), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.10.0) y su contrato para el front
 * (`docs/contratos/HU-W1.2-03-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos tipos
 * (camelCase).
 */

/** Origen de la oferta. Las `adjusted` (HU-W1.1-02) y `demo` (HU-W1.3-01) llegan con una vista reducida. */
export type ClaseOferta = 'personalized' | 'adjusted' | 'demo';

/** `active` hasta `venceEn`; `expired` ya pasó; `superseded` una recotización la reemplazó. */
export type EstadoOferta = 'active' | 'expired' | 'superseded';

/** `provisional`: se calculó sin el perfil real (pantallas E3b y E3c). */
export type ModoOferta = 'normal' | 'provisional';

/** Por qué la oferta es provisional: último perfil en caché o perfil actuarial base. */
export type MotivoProvisional = 'cached_profile' | 'base_actuarial_profile';

/** Categoría del perfil aplicado. Nunca llega el puntaje. */
export type CategoriaPerfilOferta = 'preferred' | 'standard' | 'high_risk' | 'base_actuarial';

/** De dónde salió el perfil aplicado. */
export type FuentePerfilOferta = 'external_sources' | 'open_finance' | 'cache' | 'base_actuarial';

export interface PerfilOferta {
  categoria: CategoriaPerfilOferta;
  fuente: FuentePerfilOferta;
}

/** Cobertura incluida: `codigo` es `death` o `total_permanent_disability`. */
export interface CoberturaOferta {
  codigo: string;
  valorAsegurado: number;
}

export interface CreditoOferta {
  aliadoId: string;
  solicitudId: string;
}

/**
 * Oferta de seguro. Las ofertas `adjusted` y `demo` solo traen prima, moneda, modo, vigencia y estado: el
 * resto llega vacío (`perfil` y `credito` en `null`, `coberturas` y `condiciones` sin elementos).
 */
export interface Oferta {
  id: string;
  clase: ClaseOferta;
  estado: EstadoOferta;
  /** Prima mensual, en `moneda`. */
  primaMensual: number;
  /** Código ISO 4217. */
  moneda: string;
  modo: ModoOferta;
  /** Fin de la vigencia (RFC 3339, UTC): 24 horas después de `creadaEn`. */
  venceEn: string;
  puedeAceptar: boolean;
  puedeRenovar: boolean;
  creadaEn: string | null;
  motivoProvisional: MotivoProvisional | null;
  /** Cuándo se calculó el perfil en caché (`cached_profile`). */
  fechaPerfil: string | null;
  /** Fuente caída (`open_finance`), solo si es provisional. */
  fuenteNoDisponible: string | null;
  perfil: PerfilOferta | null;
  valorAsegurado: number | null;
  plazoMeses: number | null;
  coberturas: CoberturaOferta[];
  /** Códigos que la pantalla traduce, p. ej. `validity_24h`. */
  condiciones: string[];
  versionMotor: string | null;
  titular: string | null;
  credito: CreditoOferta | null;
  /** La oferta que la reemplazó (`estado: superseded`). */
  reemplazadaPor: string | null;
  /** Su renovación (`estado: expired`). */
  renovadaPor: string | null;
}

/** Datos con los que el canal del aliado pide la oferta (`POST /v1/offers`, decisión D3). */
export interface SolicitudOferta {
  clienteId: string;
  /** El consentimiento activo del cliente que devolvió auditoría (HU-W1.2-01). */
  consentimientoId: string;
  aliadoId: string;
  solicitudId: string;
  documento: string;
  nombreCompleto: string;
  correo: string;
  /** `YYYY-MM-DD`. */
  fechaNacimiento: string;
  valorAsegurado: number;
  plazoMeses: number;
}

interface CoberturaDto {
  code: string;
  insured_amount: number;
}

/** Respuesta cruda del contrato (snake_case). Los campos opcionales llegan en `null` en las vistas reducidas. */
export interface OfertaDto {
  offer_id: string;
  kind: ClaseOferta;
  status: EstadoOferta;
  premium: number;
  currency: string;
  mode: ModoOferta;
  expires_at: string;
  can_accept: boolean;
  can_renew: boolean;
  channel?: string | null;
  created_at?: string | null;
  provisional_reason?: MotivoProvisional | null;
  profile_date?: string | null;
  unavailable_source?: string | null;
  profile?: { category: CategoriaPerfilOferta; source: FuentePerfilOferta } | null;
  terms?: { insured_amount: number; term_months: number; coverages: CoberturaDto[] } | null;
  conditions?: string[] | null;
  rater_version?: string | null;
  applicant?: { full_name: string } | null;
  credit?: { partner_id: string; application_id: string } | null;
  superseded_by?: string | null;
  renewed_by?: string | null;
}

export function mapearOferta(dto: OfertaDto): Oferta {
  return {
    id: dto.offer_id,
    clase: dto.kind,
    estado: dto.status,
    primaMensual: dto.premium,
    moneda: dto.currency,
    modo: dto.mode,
    venceEn: dto.expires_at,
    puedeAceptar: dto.can_accept,
    puedeRenovar: dto.can_renew,
    creadaEn: dto.created_at ?? null,
    motivoProvisional: dto.provisional_reason ?? null,
    fechaPerfil: dto.profile_date ?? null,
    fuenteNoDisponible: dto.unavailable_source ?? null,
    perfil: dto.profile ? { categoria: dto.profile.category, fuente: dto.profile.source } : null,
    valorAsegurado: dto.terms?.insured_amount ?? null,
    plazoMeses: dto.terms?.term_months ?? null,
    coberturas: (dto.terms?.coverages ?? []).map((c) => ({ codigo: c.code, valorAsegurado: c.insured_amount })),
    condiciones: dto.conditions ?? [],
    versionMotor: dto.rater_version ?? null,
    titular: dto.applicant?.full_name ?? null,
    credito: dto.credit ? { aliadoId: dto.credit.partner_id, solicitudId: dto.credit.application_id } : null,
    reemplazadaPor: dto.superseded_by ?? null,
    renovadaPor: dto.renewed_by ?? null,
  };
}

/** Cuerpo de `POST /v1/offers`. */
export function aSolicitudOfertaDto(solicitud: SolicitudOferta): Record<string, unknown> {
  return {
    customer_id: solicitud.clienteId,
    consent_id: solicitud.consentimientoId,
    partner_id: solicitud.aliadoId,
    application_id: solicitud.solicitudId,
    document_id: solicitud.documento,
    full_name: solicitud.nombreCompleto,
    email: solicitud.correo,
    birth_date: solicitud.fechaNacimiento,
    insured_amount: solicitud.valorAsegurado,
    term_months: solicitud.plazoMeses,
  };
}

/** Códigos estables del catálogo de errores (§3). La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorOferta =
  | 'invalid_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'offer_not_found'
  | 'offer_still_valid'
  | 'offer_superseded'
  | 'consent_required'
  | 'consent_mismatch'
  | 'consent_unverifiable'
  | 'offer_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'offer_not_found',
  'offer_still_valid',
  'offer_superseded',
  'consent_required',
  'consent_mismatch',
  'consent_unverifiable',
  'offer_unavailable',
];

function esCodigoError(valor: unknown): valor is CodigoErrorOferta {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Error de las rutas de oferta, con el código estable del contrato. */
export class ErrorOferta extends Error {
  constructor(
    readonly codigo: CodigoErrorOferta,
    /** Solo con `offer_superseded`: la oferta que reemplazó a la consultada. */
    readonly reemplazadaPor: string | null = null,
    /** Solo con `offer_still_valid`: fin de la vigencia de la oferta. */
    readonly venceEn: string | null = null,
  ) {
    super(`Error de oferta: ${codigo}`);
    this.name = 'ErrorOferta';
  }
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se
 * trata como `offer_unavailable`: no se produjo ni se perdió nada y reintentar es seguro.
 */
export function traducirErrorOferta(error: unknown): ErrorOferta {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorOferta('offer_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const campos = cuerpo as Record<string, unknown>;
    const codigo = campos['error'];
    if (esCodigoError(codigo)) {
      const reemplazadaPor = campos['superseded_by'];
      const venceEn = campos['expires_at'];
      return new ErrorOferta(
        codigo,
        typeof reemplazadaPor === 'string' ? reemplazadaPor : null,
        typeof venceEn === 'string' ? venceEn : null,
      );
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorOferta('invalid_request');
    case 401:
      return new ErrorOferta('unauthorized');
    case 403:
      return new ErrorOferta('forbidden');
    case 404:
      return new ErrorOferta('offer_not_found');
    default:
      return new ErrorOferta('offer_unavailable');
  }
}
