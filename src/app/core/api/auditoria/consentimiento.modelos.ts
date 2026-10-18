import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos del consentimiento explícito del servicio de auditoría (HU-W1.2-01), tipados según
 * `services/audit/api/openapi.yaml` del backend (v0.2.0) y su contrato para el front
 * (`docs/contratos/HU-W1.2-01-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos
 * tipos (camelCase).
 */

/** Fuente de datos que cubre el consentimiento. */
export type CodigoFuente = 'open_finance' | 'open_data' | 'kyc';

/** `12_months` dura 12 meses; `single_use` es de un solo uso (mientras no se registre su uso dura lo que el consentimiento). */
export type VigenciaFuente = '12_months' | 'single_use';

/** Qué datos lee una fuente y por cuánto tiempo vale la autorización (pantalla E1). */
export interface FuenteConsentimiento {
  codigo: CodigoFuente;
  /** Códigos de categoría de datos, p. ej. `credit_products`; la pantalla los traduce. */
  categoriasDatos: string[];
  vigencia: VigenciaFuente;
}

/** Términos vigentes que el cliente debe ver antes de autorizar. */
export interface TerminosConsentimiento {
  /** Versión que se envía al registrar: lo mostrado es lo registrado. */
  version: string;
  /** Código de la finalidad, p. ej. `risk_profiling_mortgage_life_offer`. */
  finalidad: string;
  responsable: string;
  /** Código de la política de datos, p. ej. `personal-data-policy-v1`. */
  politicaDatos: string;
  fuentes: FuenteConsentimiento[];
}

/** Canal por el que el cliente otorga el consentimiento; hoy el backend solo acepta `embedded`. */
export type CanalConsentimiento = 'embedded';

/** Datos con los que se registra el consentimiento (`POST /v1/audit/consents`). */
export interface SolicitudConsentimiento {
  clienteId: string;
  documento: string;
  nombreCompleto: string;
  /** La versión de los términos que se mostró. */
  versionTerminos: string;
  /** Todas las fuentes de los términos: el consentimiento es todo o nada. */
  fuentesAceptadas: CodigoFuente[];
  aceptaPoliticaDatos: boolean;
  aliadoId: string;
  solicitudId: string;
}

/** Recibo del consentimiento registrado. No repite el documento del titular. */
export interface Consentimiento {
  id: string;
  clienteId: string;
  versionTerminos: string;
  finalidad: string;
  canal: string;
  alcance: FuenteConsentimiento[];
  /** Fecha y hora en que el servidor lo registró (RFC 3339, UTC). */
  otorgadoEn: string;
  /** `otorgadoEn` más 12 meses. */
  venceEn: string;
}

interface FuenteDto {
  code: CodigoFuente;
  data_categories: string[];
  validity: VigenciaFuente;
}

/** Respuesta cruda de `GET /v1/audit/consent-terms/current`. */
export interface TerminosConsentimientoDto {
  version: string;
  purpose: string;
  controller: string;
  policy_ref: string;
  sources: FuenteDto[];
}

/** Respuesta cruda de `POST /v1/audit/consents` (201 o 200). */
export interface ConsentimientoDto {
  consent_id: string;
  customer_id: string;
  terms_version: string;
  purpose: string;
  channel: string;
  scope: FuenteDto[];
  granted_at: string;
  expires_at: string;
}

function mapearFuente(dto: FuenteDto): FuenteConsentimiento {
  return { codigo: dto.code, categoriasDatos: dto.data_categories, vigencia: dto.validity };
}

export function mapearTerminosConsentimiento(dto: TerminosConsentimientoDto): TerminosConsentimiento {
  return {
    version: dto.version,
    finalidad: dto.purpose,
    responsable: dto.controller,
    politicaDatos: dto.policy_ref,
    fuentes: dto.sources.map(mapearFuente),
  };
}

export function mapearConsentimiento(dto: ConsentimientoDto): Consentimiento {
  return {
    id: dto.consent_id,
    clienteId: dto.customer_id,
    versionTerminos: dto.terms_version,
    finalidad: dto.purpose,
    canal: dto.channel,
    alcance: dto.scope.map(mapearFuente),
    otorgadoEn: dto.granted_at,
    venceEn: dto.expires_at,
  };
}

/** Cuerpo de `POST /v1/audit/consents`; el canal siempre es `embedded` en este cliente. */
export function aSolicitudConsentimientoDto(solicitud: SolicitudConsentimiento): Record<string, unknown> {
  return {
    customer_id: solicitud.clienteId,
    document_id: solicitud.documento,
    full_name: solicitud.nombreCompleto,
    terms_version: solicitud.versionTerminos,
    accepted_sources: solicitud.fuentesAceptadas,
    accepted_data_policy: solicitud.aceptaPoliticaDatos,
    channel: 'embedded' satisfies CanalConsentimiento,
    partner_id: solicitud.aliadoId,
    application_id: solicitud.solicitudId,
  };
}

/** Códigos estables del contrato (`Error.error`). La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorConsentimiento =
  | 'invalid_request'
  | 'validation_failed'
  | 'terms_outdated'
  | 'service_unavailable';

const CODIGOS_ERROR: readonly string[] = ['invalid_request', 'validation_failed', 'terms_outdated', 'service_unavailable'];

/** Campo del formulario al que apunta un error de validación del backend. */
export type CampoConsentimiento =
  | 'clienteId'
  | 'documento'
  | 'nombreCompleto'
  | 'versionTerminos'
  | 'fuentesAceptadas'
  | 'aceptaPoliticaDatos'
  | 'canal'
  | 'aliadoId'
  | 'solicitudId';

export type CodigoCampoConsentimiento = 'required' | 'invalid_format' | 'out_of_range' | 'incomplete' | 'must_be_true';

const CODIGOS_CAMPO: readonly string[] = ['required', 'invalid_format', 'out_of_range', 'incomplete', 'must_be_true'];

/** Campo del contrato (snake_case) → campo del modelo. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoConsentimiento>> = {
  customer_id: 'clienteId',
  document_id: 'documento',
  full_name: 'nombreCompleto',
  terms_version: 'versionTerminos',
  accepted_sources: 'fuentesAceptadas',
  accepted_data_policy: 'aceptaPoliticaDatos',
  channel: 'canal',
  partner_id: 'aliadoId',
  application_id: 'solicitudId',
};

/** Un campo inválido según el backend. */
export interface ErrorDeCampoConsentimiento {
  campo: CampoConsentimiento;
  codigo: CodigoCampoConsentimiento;
}

/** Error de las rutas de consentimiento, con el código estable del contrato. */
export class ErrorConsentimiento extends Error {
  constructor(
    readonly codigo: CodigoErrorConsentimiento,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampoConsentimiento[] = [],
  ) {
    super(`Error de consentimiento: ${codigo}`);
    this.name = 'ErrorConsentimiento';
  }
}

function esCodigoError(valor: unknown): valor is CodigoErrorConsentimiento {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoConsentimiento[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoConsentimiento[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    const campo = typeof field === 'string' ? CAMPO_DEL_CONTRATO[field] : undefined;
    if (campo && typeof code === 'string' && CODIGOS_CAMPO.includes(code)) {
      campos.push({ campo, codigo: code as CodigoCampoConsentimiento });
    }
  }
  return campos;
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se
 * trata como `service_unavailable`: no se guardó nada y reintentar es seguro (el registro es idempotente).
 */
export function traducirErrorConsentimiento(error: unknown): ErrorConsentimiento {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorConsentimiento('service_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const campos = cuerpo as Record<string, unknown>;
    const codigo = campos['error'];
    if (esCodigoError(codigo)) {
      return new ErrorConsentimiento(codigo, codigo === 'validation_failed' ? extraerCampos(campos) : []);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorConsentimiento('invalid_request');
    case 409:
      return new ErrorConsentimiento('terms_outdated');
    default:
      return new ErrorConsentimiento('service_unavailable');
  }
}
