import { HttpErrorResponse } from '@angular/common/http';

/** Dígitos del código de confirmación que recibe el cliente. */
export const LONGITUD_CODIGO_CONFIRMACION = 6;

/** Cómo aceptó el cliente la compra (HU-W1.1-03, CA-5). */
export type MetodoAceptacion = 'recorded_call' | 'remote_signature' | 'confirmation_code';

export const METODOS_ACEPTACION: readonly MetodoAceptacion[] = ['recorded_call', 'remote_signature', 'confirmation_code'];

/** Máximo de caracteres de la referencia de la grabación o de la firma. */
export const MAX_REFERENCIA = 64;

/** Código enviado al correo del cliente. El código nunca vuelve al asesor: solo el correo enmascarado. */
export interface ConfirmacionEnviada {
  cotizacionId: string;
  /** Correo del cliente, enmascarado (`la***@example.com`). */
  enviadoA: string;
  /** Hasta cuándo se puede usar el código. */
  venceEn: string;
}

/** Lo que el asesor registra para formalizar: cómo y cuándo aceptó el cliente (CA-5). */
export interface SolicitudFormalizacion {
  metodo: MetodoAceptacion;
  /** Instante en que el cliente aceptó, en ISO 8601. */
  aceptadaEn: string;
  /** Referencia de la grabación o de la firma; obligatoria salvo con `confirmation_code`. */
  referencia: string;
  /** Solo con `confirmation_code`: el código que recibió el cliente. */
  codigo?: string;
}

/** Compra formalizada por el asesor en nombre del cliente: quién, cuándo y desde qué cotización (CA-4). */
export interface Formalizacion {
  formalizacionId: string;
  cotizacionId: string;
  ofertaId: string;
  /** Aceptación con canal «asesor» que arrancó la emisión. */
  aceptacionId: string;
  clienteId: string;
  asesorId: string;
  /** El token de Cognito no trae nombre: el asesor se identifica por su correo. */
  asesorCorreo: string;
  metodo: MetodoAceptacion;
  aceptadaEn: string;
  referencia: string;
  formalizadaEn: string;
  /** Estado de la aceptación (`registered`, `issuance_pending`, `in_review`). */
  estado: string;
}

/** Resultado de formalizar: `creada` es `false` si el mismo asesor repitió una formalización ya completa. */
export interface ResultadoFormalizacion {
  formalizacion: Formalizacion;
  creada: boolean;
}

/** Respuestas crudas del contrato (snake_case). */
export interface ConfirmacionEnviadaDto {
  quote_id: string;
  sent_to: string;
  expires_at: string;
}

export interface FormalizacionDto {
  formalization_id: string;
  quote_id: string;
  offer_id: string;
  acceptance_id: string;
  customer_id: string;
  advisor_id: string;
  advisor_email: string;
  consent_method: MetodoAceptacion;
  accepted_at: string;
  consent_reference: string;
  formalized_at: string;
  status: string;
}

export function mapearConfirmacionEnviada(dto: ConfirmacionEnviadaDto): ConfirmacionEnviada {
  return { cotizacionId: dto.quote_id, enviadoA: dto.sent_to, venceEn: dto.expires_at };
}

export function mapearFormalizacion(dto: FormalizacionDto): Formalizacion {
  return {
    formalizacionId: dto.formalization_id,
    cotizacionId: dto.quote_id,
    ofertaId: dto.offer_id,
    aceptacionId: dto.acceptance_id,
    clienteId: dto.customer_id,
    asesorId: dto.advisor_id,
    asesorCorreo: dto.advisor_email,
    metodo: dto.consent_method,
    aceptadaEn: dto.accepted_at,
    referencia: dto.consent_reference,
    formalizadaEn: dto.formalized_at,
    estado: dto.status,
  };
}

/** Cuerpo de `POST /v1/assisted-quotes/{id}/formalization`. El código solo viaja con `confirmation_code`. */
export function aSolicitudFormalizacionDto(s: SolicitudFormalizacion): Record<string, unknown> {
  const aceptacion: Record<string, string> = { method: s.metodo, accepted_at: s.aceptadaEn };
  const referencia = s.referencia.trim();
  if (referencia) {
    aceptacion['reference'] = referencia;
  }
  return s.metodo === 'confirmation_code' ? { acceptance: aceptacion, confirmation_code: s.codigo ?? '' } : { acceptance: aceptacion };
}

/** Campo del formulario al que apunta un error de validación. */
export type CampoFormalizacion = 'metodo' | 'fecha' | 'referencia' | 'codigo';

export type CodigoCampoFormalizacion = 'required' | 'invalid_format' | 'out_of_range';

/** Un campo inválido según el backend. */
export interface ErrorDeCampoFormalizacion {
  campo: CampoFormalizacion;
  codigo: CodigoCampoFormalizacion;
}

/** Campo del contrato (snake_case) → campo del formulario. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoFormalizacion>> = {
  'acceptance.method': 'metodo',
  'acceptance.accepted_at': 'fecha',
  'acceptance.reference': 'referencia',
  confirmation_code: 'codigo',
};

const CODIGOS_CAMPO: readonly string[] = ['required', 'invalid_format', 'out_of_range'];

/** Códigos estables del contrato. La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorFormalizacion =
  | 'invalid_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'quote_not_found'
  | 'formalization_not_found'
  | 'quote_expired'
  | 'already_formalized'
  | 'consent_code_required'
  | 'invalid_confirmation_code'
  | 'confirmation_code_expired'
  | 'too_many_attempts'
  | 'too_many_codes'
  | 'code_delivery_unavailable'
  | 'formalization_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'quote_not_found',
  'formalization_not_found',
  'quote_expired',
  'already_formalized',
  'consent_code_required',
  'invalid_confirmation_code',
  'confirmation_code_expired',
  'too_many_attempts',
  'too_many_codes',
  'code_delivery_unavailable',
  'formalization_unavailable',
];

/** Error de las rutas de formalización, con el código estable del contrato. */
export class ErrorFormalizacion extends Error {
  constructor(
    readonly codigo: CodigoErrorFormalizacion,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampoFormalizacion[] = [],
  ) {
    super(`Error de formalización: ${codigo}`);
    this.name = 'ErrorFormalizacion';
  }
}

function esCodigoError(valor: unknown): valor is CodigoErrorFormalizacion {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoFormalizacion[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoFormalizacion[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    const campo = typeof field === 'string' ? CAMPO_DEL_CONTRATO[field] : undefined;
    if (campo && typeof code === 'string' && CODIGOS_CAMPO.includes(code)) {
      campos.push({ campo, codigo: code as CodigoCampoFormalizacion });
    }
  }
  return campos;
}

/** Traduce un error de HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorFormalizacion(error: unknown): ErrorFormalizacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorFormalizacion('formalization_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const { error: codigo } = cuerpo as Record<string, unknown>;
    if (esCodigoError(codigo)) {
      return new ErrorFormalizacion(codigo, codigo === 'validation_failed' ? extraerCampos(cuerpo as Record<string, unknown>) : []);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorFormalizacion('invalid_request');
    case 401:
      return new ErrorFormalizacion('unauthorized');
    case 403:
      return new ErrorFormalizacion('forbidden');
    case 404:
      return new ErrorFormalizacion('quote_not_found');
    case 409:
      return new ErrorFormalizacion('already_formalized');
    default:
      return new ErrorFormalizacion('formalization_unavailable');
  }
}
