import { HttpErrorResponse } from '@angular/common/http';

import { CodigoFuente, FuenteConsentimiento, VigenciaFuente } from './consentimiento.modelos';

/**
 * Modelos de la revocación de un consentimiento desde el portal de cumplimiento (HU-W4.2-02), tipados según
 * `services/audit/api/openapi.yaml` 0.6.0 del backend y sus contratos para el front (`HU-W4.2-02-api.md` y, para la
 * vigencia, la finalidad y los canales del detalle, `HU-W4.2-01-api.md`). El cliente traduce el JSON del contrato
 * (snake_case) a estos tipos (camelCase).
 */

/** Estado del consentimiento en el contrato. Solo `active` es revocable. */
export type EstadoConsentimiento = 'active' | 'expired' | 'revoked' | 'partially_revoked';

/** Avance del aviso a las entidades: `partial` sigue así tras un reintento hasta que la entidad confirme. */
export type EstadoAviso = 'in_progress' | 'completed' | 'partial';

/** Estado del aviso a una entidad. */
export type EstadoEntidad = 'pending' | 'confirmed' | 'not_confirmed';

/** Motivo que el analista indica al revocar. */
export type MotivoRevocacion = 'customer_request' | 'regulatory_order';

/** Entidad que el consentimiento autoriza (hoy una: el aliado). */
export interface EntidadConsentimiento {
  codigo: string;
  nombre: string;
}

/** Aviso a una entidad dentro de la revocación. */
export interface EntidadRevocacion {
  codigo: string;
  nombre: string;
  estado: EstadoEntidad;
  /** Instante en que confirmó (RFC 3339, UTC); `null` mientras no lo haga. */
  confirmadaEn: string | null;
  /** Fin de su ventana para confirmar; en `not_confirmed`, la hora en que se agotó el plazo. */
  plazoHasta: string | null;
}

/** Quién pidió la revocación: un tipo y el `sub` de la cuenta, nunca un nombre. */
export interface ActorRevocacion {
  /** `operations`, `holder` u otro; el portal traduce por código. */
  tipo: string;
  id: string;
}

export interface RevocacionCumplimiento {
  /** Comprobante `REV-AAAA-NNNN`. */
  numeroComprobante: string;
  solicitadaEn: string;
  /** Desde este instante Solventa no consulta datos del cliente. */
  efectivaEn: string;
  /** `compliance_portal` o `mobile_app`; es texto libre, no un conjunto cerrado. */
  canal: string;
  estadoAviso: EstadoAviso;
  solicitadaPor: ActorRevocacion;
  /** `null` si la revocó el titular desde la app. */
  motivo: string | null;
  /** `null` si la revocó el titular desde la app. */
  referencia: string | null;
  entidades: EntidadRevocacion[];
}

/** Cambio de estado del consentimiento, en orden cronológico. */
export interface EntradaHistorial {
  /** `granted`, `revocation_requested`, `revoked`, `revocation_confirmed`, etc.; el portal traduce por código. */
  estado: string;
  ocurridoEn: string;
  /** Solo en las entradas de una entidad. */
  entidadCodigo: string | null;
  tipoActor: string | null;
  /** Canal del otorgamiento (`embedded`) o de la revocación (`mobile_app`, `compliance_portal`); `null` si no aplica. */
  canal: string | null;
  motivo: string | null;
  referencia: string | null;
}

/** Lo que el portal necesita para el detalle (HU-W4.2-01), el modal, la alerta de revocación parcial y el reintento. */
export interface EstadoRevocacion {
  consentimientoId: string;
  estado: EstadoConsentimiento;
  /** `true` solo con `active`. */
  revocable: boolean;
  titular: { nombreCompleto: string; documentoEnmascarado: string };
  /** Cuándo lo otorgó el cliente (HU-W4.2-01); `null` si el backend no lo trae. */
  otorgadoEn: string | null;
  /** Fin de su vigencia: 12 meses después del otorgamiento (HU-W4.2-01). */
  venceEn: string | null;
  /** Cuándo dejó de estar vigente (revocado o vencido); `null` mientras lo esté. */
  finalizadoEn: string | null;
  /** Código de la finalidad, p. ej. `risk_profiling_mortgage_life_offer`; la pantalla la traduce. */
  finalidad: string | null;
  /** Canal por el que se otorgó, p. ej. `embedded`. */
  canalOtorgamiento: string | null;
  versionTerminos: string | null;
  alcance: FuenteConsentimiento[];
  entidades: EntidadConsentimiento[];
  /** `null` si no se ha revocado. */
  revocacion: RevocacionCumplimiento | null;
  historial: EntradaHistorial[];
}

/** Datos con los que el analista revoca (`POST …/revocations`). */
export interface SolicitudRevocacion {
  motivo: MotivoRevocacion;
  referencia: string;
  /** La casilla del modal: el analista confirma que actúa como responsable de cumplimiento. */
  rolConfirmado: true;
}

/** Respuesta de `POST …/revocation-retries`. */
export interface ResultadoReintento {
  /** Códigos de las entidades a las que se avisó de nuevo. */
  entidadesReintentadas: string[];
  estado: EstadoRevocacion;
}

interface FuenteDto {
  code: CodigoFuente;
  data_categories: string[];
  validity: VigenciaFuente;
}

interface EntidadRevocacionDto {
  code: string;
  name: string;
  status: EstadoEntidad;
  confirmed_at: string | null;
  deadline_at: string | null;
}

interface RevocacionDto {
  receipt_number: string;
  requested_at: string;
  effective_at: string;
  channel: string;
  notice_status: EstadoAviso;
  requested_by: { type: string; id: string };
  reason: string | null;
  reference: string | null;
  entities: EntidadRevocacionDto[];
}

interface EntradaHistorialDto {
  status: string;
  occurred_at: string;
  entity_code: string | null;
  actor_type: string | null;
  /** Desde la versión 0.6.0 (HU-W4.2-01). */
  channel?: string | null;
  reason: string | null;
  reference: string | null;
}

/** Respuesta cruda de `GET …/revocation` y de `POST …/revocations` (201 o 200). */
export interface EstadoRevocacionDto {
  consent_id: string;
  status: EstadoConsentimiento;
  revocable: boolean;
  holder: { full_name: string; document_masked: string };
  /** Desde la versión 0.6.0 (HU-W4.2-01): solo agrega campos, por eso son opcionales para el cliente. */
  granted_at?: string;
  expires_at?: string;
  ended_at?: string | null;
  purpose?: string;
  grant_channel?: string;
  terms_version?: string;
  scope: FuenteDto[];
  entities: { code: string; name: string }[];
  revocation: RevocacionDto | null;
  history: EntradaHistorialDto[];
}

/** Respuesta cruda de `POST …/revocation-retries` (202). */
export interface ResultadoReintentoDto {
  retried_entities: string[];
  state: EstadoRevocacionDto;
}

function mapearRevocacion(dto: RevocacionDto): RevocacionCumplimiento {
  return {
    numeroComprobante: dto.receipt_number,
    solicitadaEn: dto.requested_at,
    efectivaEn: dto.effective_at,
    canal: dto.channel,
    estadoAviso: dto.notice_status,
    solicitadaPor: { tipo: dto.requested_by.type, id: dto.requested_by.id },
    motivo: dto.reason ?? null,
    referencia: dto.reference ?? null,
    entidades: dto.entities.map((e) => ({
      codigo: e.code,
      nombre: e.name,
      estado: e.status,
      confirmadaEn: e.confirmed_at ?? null,
      plazoHasta: e.deadline_at ?? null,
    })),
  };
}

export function mapearEstadoRevocacion(dto: EstadoRevocacionDto): EstadoRevocacion {
  return {
    consentimientoId: dto.consent_id,
    estado: dto.status,
    revocable: dto.revocable,
    titular: { nombreCompleto: dto.holder.full_name, documentoEnmascarado: dto.holder.document_masked },
    otorgadoEn: dto.granted_at ?? null,
    venceEn: dto.expires_at ?? null,
    finalizadoEn: dto.ended_at ?? null,
    finalidad: dto.purpose ?? null,
    canalOtorgamiento: dto.grant_channel ?? null,
    versionTerminos: dto.terms_version ?? null,
    alcance: dto.scope.map((f) => ({ codigo: f.code, categoriasDatos: f.data_categories, vigencia: f.validity })),
    entidades: dto.entities.map((e) => ({ codigo: e.code, nombre: e.name })),
    revocacion: dto.revocation ? mapearRevocacion(dto.revocation) : null,
    historial: dto.history.map((h) => ({
      estado: h.status,
      ocurridoEn: h.occurred_at,
      entidadCodigo: h.entity_code ?? null,
      tipoActor: h.actor_type ?? null,
      canal: h.channel ?? null,
      motivo: h.reason ?? null,
      referencia: h.reference ?? null,
    })),
  };
}

export function mapearResultadoReintento(dto: ResultadoReintentoDto): ResultadoReintento {
  return { entidadesReintentadas: dto.retried_entities, estado: mapearEstadoRevocacion(dto.state) };
}

/** Cuerpo de `POST …/revocations`: ningún campo más, el backend rechaza los desconocidos. */
export function aSolicitudRevocacionDto(solicitud: SolicitudRevocacion): Record<string, unknown> {
  return { reason: solicitud.motivo, reference: solicitud.referencia, role_confirmed: solicitud.rolConfirmado };
}

/** Códigos estables del contrato (`Error.error`) más los dos que resuelve el interceptor. La pantalla decide el texto por el código. */
export type CodigoErrorRevocacion =
  | 'invalid_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'consent_not_found'
  | 'consent_already_revoked'
  | 'consent_not_active'
  | 'idempotency_key_reused'
  | 'consent_not_revoked'
  | 'nothing_to_retry'
  | 'service_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'consent_not_found',
  'consent_already_revoked',
  'consent_not_active',
  'idempotency_key_reused',
  'consent_not_revoked',
  'nothing_to_retry',
  'service_unavailable',
];

/** Campo del formulario del modal al que apunta un error de validación del backend. */
export type CampoRevocacion = 'motivo' | 'referencia' | 'rolConfirmado';

export type CodigoCampoRevocacion = 'required' | 'invalid_format' | 'out_of_range' | 'must_be_true';

const CODIGOS_CAMPO: readonly string[] = ['required', 'invalid_format', 'out_of_range', 'must_be_true'];

/** Campo del contrato (snake_case) → campo del modelo. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoRevocacion>> = {
  reason: 'motivo',
  reference: 'referencia',
  role_confirmed: 'rolConfirmado',
};

/** Un campo inválido según el backend. */
export interface ErrorDeCampoRevocacion {
  campo: CampoRevocacion;
  codigo: CodigoCampoRevocacion;
}

/** Error de las rutas de revocación, con el código estable del contrato. */
export class ErrorRevocacion extends Error {
  constructor(
    readonly codigo: CodigoErrorRevocacion,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampoRevocacion[] = [],
  ) {
    super(`Error de revocación de consentimiento: ${codigo}`);
    this.name = 'ErrorRevocacion';
  }
}

function esCodigoError(valor: unknown): valor is CodigoErrorRevocacion {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Campos con error del cuerpo; `null` si alguno es la `Idempotency-Key`, que es un fallo del cliente y no del analista. */
function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoRevocacion[] | null {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoRevocacion[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    if (field === 'Idempotency-Key') {
      return null;
    }
    const campo = typeof field === 'string' ? CAMPO_DEL_CONTRATO[field] : undefined;
    if (campo && typeof code === 'string' && CODIGOS_CAMPO.includes(code)) {
      campos.push({ campo, codigo: code as CodigoCampoRevocacion });
    }
  }
  return campos;
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se trata
 * como `service_unavailable`: no cambió nada y reintentar es seguro (la revocación es idempotente por clave).
 * Un código desconocido se resuelve por el estado HTTP.
 */
export function traducirErrorRevocacion(error: unknown): ErrorRevocacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorRevocacion('service_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const campos = cuerpo as Record<string, unknown>;
    const codigo = campos['error'];
    if (esCodigoError(codigo)) {
      if (codigo !== 'validation_failed') {
        return new ErrorRevocacion(codigo);
      }
      const invalidos = extraerCampos(campos);
      return invalidos === null ? new ErrorRevocacion('invalid_request') : new ErrorRevocacion(codigo, invalidos);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorRevocacion('invalid_request');
    case 401:
      return new ErrorRevocacion('unauthorized');
    case 403:
      return new ErrorRevocacion('forbidden');
    case 404:
      return new ErrorRevocacion('consent_not_found');
    case 409:
      return new ErrorRevocacion('consent_already_revoked');
    default:
      return new ErrorRevocacion('service_unavailable');
  }
}
