import { HttpErrorResponse } from '@angular/common/http';

import { EstadoCobro, MedioDePago, MedioDePagoDto } from './cobro.modelos';
import { CodigoCampoFormalizacion, MetodoAceptacion, SolicitudFormalizacion, aSolicitudFormalizacionDto } from './formalizacion.modelos';
import { AvisoPerfil, EstadoFuente, ModoPerfil, OrigenPerfil } from './perfil-riesgo.modelos';
import {
  CondicionesPoliza,
  CondicionesPolizaDto,
  ResumenRenovacion,
  ResumenRenovacionDto,
  mapearCondiciones,
  mapearResumenRenovacion,
} from './renovacion.modelos';

/**
 * Modelos de la renovación asistida con recotización (HU-W1.5-03), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.15.0) y su contrato para el front (`HU-W1.5-03-api.md`).
 * El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/**
 * Cómo se obtiene el consentimiento para recotizar: `audit` lo verifica (póliza nacida en el canal embebido o de
 * canal desconocido); `advisor_affirmation` lo afirma el asesor con una casilla (póliza nacida en el canal asistido).
 */
export type ModoConsentimiento = 'audit' | 'advisor_affirmation';

/** Por qué el asesor no puede renovar ahora. */
export type MotivoBloqueo = 'renewal_not_available' | 'renewal_closed' | 'payment_method_missing';

/** Quién renovó el periodo: el asesor (con su registro) o el asegurado en línea (HU-W1.5-02). */
export type CanalRenovacion = 'advisor' | 'insured';

/** `valid` se puede formalizar; `expired` pasó de 24 horas; `superseded` ya no es la última del periodo. */
export type EstadoRecotizacion = 'valid' | 'expired' | 'superseded';

/** Con qué autorización se consultaron los datos del cliente. */
export type BaseConsentimiento = 'audit_verified' | 'advisor_affirmed';

/** Un factor del motor de rating y el valor que tomó. */
export interface FactorAplicado {
  codigo: string;
  valor: number;
}

/** Estado y latencia de una fuente consultada para la recotización. */
export interface FuenteRecotizacion {
  nombre: string;
  estado: EstadoFuente;
  latenciaMs: number;
}

/** Recotización guardada de la renovación. Nunca trae el puntaje ni la categoría del perfil. */
export interface RecotizacionRenovacion {
  recotizacionId: string;
  creadaEn: string;
  venceEn: string;
  estado: EstadoRecotizacion;
  vigente: CondicionesPoliza;
  renovada: CondicionesPoliza;
  /** Prima renovada frente a la vigente, como fracción (0,053 es +5,3 %). */
  variacionPrima: number;
  /** Descuento por buena experiencia (0 a 1); 0 si no hay. */
  descuento: number;
  /** `false` cuando el motor no pudo tarifar y se repiten las condiciones vigentes. */
  recotizada: boolean;
  versionMotor: string | null;
  factores: FactorAplicado[];
  modo: ModoPerfil | null;
  origen: OrigenPerfil | null;
  /** Fecha del perfil en caché; solo con `origen: cache`. */
  fechaPerfil: string | null;
  fuenteNoDisponible: string | null;
  /** Qué perfil degradado se usó: el último en caché o el actuarial base. */
  aviso: AvisoPerfil | null;
  fuentes: FuenteRecotizacion[];
  baseConsentimiento: BaseConsentimiento | null;
  consentimientoAfirmadoEn: string | null;
}

/** Titular de la póliza, sin su contacto. */
export interface TitularRenovacion {
  nombreCompleto: string;
  tipoDocumento: string | null;
  documento: string | null;
}

/** Póliza que se renueva. */
export interface PolizaRenovacionAsistida {
  polizaId: string;
  linea: string;
  titular: TitularRenovacion;
  prima: number;
  moneda: string;
  valorAsegurado: number;
  vigenciaDesde: string;
  vigenciaHasta: string;
  renovacionDe: string | null;
}

/** Renovación del periodo con el canal que la hizo. */
export interface ResumenRenovacionAsistida extends ResumenRenovacion {
  canal: CanalRenovacion;
}

/** Registro del asesor (CA-4): quién, cuándo, con qué recotización y cómo aceptó el cliente. */
export interface FormalizacionRenovacion {
  asesorId: string;
  asesorCorreo: string;
  /** Claim `name` de la cuenta; `null` si no lo tiene: la pantalla muestra el correo. */
  asesorNombre: string | null;
  formalizadaEn: string;
  recotizacionId: string;
  metodo: MetodoAceptacion;
  aceptadaEn: string;
  referencia: string | null;
}

/** Estado del cobro de la renovación (01·D-3 a+); su plazo de reintento es `renovacion.reintentarHasta`. */
export interface CobroRenovacion {
  estado: EstadoCobro;
  motivoFalla: string | null;
  codigoRechazo: string | null;
  ultimaFallaEn: string | null;
  intentos: number;
  /** La póliza nueva, cuando el cobro se confirma. */
  polizaId: string | null;
}

/** Todo lo que pintan S7, S7b y «Ver» de una renovación en curso. */
export interface RenovacionAsistida {
  poliza: PolizaRenovacionAsistida;
  ventana: { abreEn: string; cierraEn: string; abierta: boolean };
  vigente: CondicionesPoliza;
  medioDePago: MedioDePago | null;
  recotizacion: RecotizacionRenovacion | null;
  renovacion: ResumenRenovacionAsistida | null;
  formalizacion: FormalizacionRenovacion | null;
  cobro: CobroRenovacion | null;
  modoConsentimiento: ModoConsentimiento;
  puedeRecotizar: boolean;
  puedeFormalizar: boolean;
  motivoBloqueo: MotivoBloqueo | null;
}

/** Código enviado al titular; el código nunca vuelve al asesor. */
export interface CodigoRenovacionEnviado {
  recotizacionId: string;
  /** Correo del titular, enmascarado (`ca***@example.com`). */
  enviadoA: string;
  venceEn: string;
}

/** Lo que el asesor registra para formalizar: la recotización que el cliente aceptó y cómo la aceptó. */
export interface SolicitudFormalizacionRenovacion extends SolicitudFormalizacion {
  recotizacionId: string;
}

/** Resultado de formalizar: `creada` es `false` si el mismo asesor repitió una formalización ya hecha. */
export interface ResultadoFormalizacionRenovacion {
  renovacion: RenovacionAsistida;
  creada: boolean;
}

/** Respuestas crudas del contrato (snake_case). */
export interface RecotizacionRenovacionDto {
  requote_id: string;
  created_at: string;
  expires_at: string;
  status: EstadoRecotizacion;
  current: CondicionesPolizaDto;
  renewal: CondicionesPolizaDto;
  premium_change_rate: number;
  discount_rate: number;
  requoted: boolean;
  rating_version: string | null;
  applied_rules: { code: string; value: number }[];
  mode: ModoPerfil | null;
  source: OrigenPerfil | null;
  profile_date: string | null;
  unavailable_source: string | null;
  notice: AvisoPerfil | null;
  sources: { source: string; status: EstadoFuente; latency_ms: number }[];
  consent_basis: BaseConsentimiento | null;
  consent_affirmed_at: string | null;
}

export interface RenovacionAsistidaDto {
  policy: {
    policy_id: string;
    line: string;
    holder: { full_name: string; document_type: string | null; document_id: string | null };
    premium: number;
    currency: string;
    insured_amount: number;
    coverages: { code: string; insured_amount: number }[];
    coverage_start: string;
    coverage_end: string;
    renewal_of: string | null;
  };
  renewal_window: { opens_at: string; closes_at: string; open: boolean };
  current: CondicionesPolizaDto;
  payment_method: MedioDePagoDto | null;
  requote: RecotizacionRenovacionDto | null;
  renewal: (ResumenRenovacionDto & { channel: CanalRenovacion }) | null;
  formalization: {
    advisor_id: string;
    advisor_email: string;
    advisor_name: string | null;
    formalized_at: string;
    requote_id: string;
    acceptance: { method: MetodoAceptacion; accepted_at: string; reference: string | null };
  } | null;
  charge: {
    status: EstadoCobro;
    failure_reason: string | null;
    decline_code: string | null;
    last_failure_at: string | null;
    attempts: number;
    policy_id: string | null;
  } | null;
  consent_mode: ModoConsentimiento;
  can_requote: boolean;
  can_formalize: boolean;
  blocked_reason: MotivoBloqueo | null;
}

export interface CodigoRenovacionEnviadoDto {
  requote_id: string;
  sent_to: string;
  expires_at: string;
}

export function mapearRecotizacion(dto: RecotizacionRenovacionDto): RecotizacionRenovacion {
  return {
    recotizacionId: dto.requote_id,
    creadaEn: dto.created_at,
    venceEn: dto.expires_at,
    estado: dto.status,
    vigente: mapearCondiciones(dto.current),
    renovada: mapearCondiciones(dto.renewal),
    variacionPrima: dto.premium_change_rate,
    descuento: dto.discount_rate,
    recotizada: dto.requoted,
    versionMotor: dto.rating_version,
    factores: dto.applied_rules.map((r) => ({ codigo: r.code, valor: r.value })),
    modo: dto.mode,
    origen: dto.source,
    fechaPerfil: dto.profile_date,
    fuenteNoDisponible: dto.unavailable_source,
    aviso: dto.notice,
    fuentes: dto.sources.map((f) => ({ nombre: f.source, estado: f.status, latenciaMs: f.latency_ms })),
    baseConsentimiento: dto.consent_basis,
    consentimientoAfirmadoEn: dto.consent_affirmed_at,
  };
}

function mapearMedio(dto: MedioDePagoDto): MedioDePago {
  return {
    tipo: dto.method,
    marca: dto.brand,
    ultimosCuatro: dto.last4,
    cuotas: dto.installments,
    codigoBanco: dto.bank_code,
    tipoDePersona: dto.payer_type,
    capturadoEn: dto.captured_at,
  };
}

export function mapearRenovacionAsistida(dto: RenovacionAsistidaDto): RenovacionAsistida {
  const p = dto.policy;
  const f = dto.formalization;
  const c = dto.charge;
  return {
    poliza: {
      polizaId: p.policy_id,
      linea: p.line,
      titular: { nombreCompleto: p.holder.full_name, tipoDocumento: p.holder.document_type, documento: p.holder.document_id },
      prima: p.premium,
      moneda: p.currency,
      valorAsegurado: p.insured_amount,
      vigenciaDesde: p.coverage_start,
      vigenciaHasta: p.coverage_end,
      renovacionDe: p.renewal_of,
    },
    ventana: { abreEn: dto.renewal_window.opens_at, cierraEn: dto.renewal_window.closes_at, abierta: dto.renewal_window.open },
    vigente: mapearCondiciones(dto.current),
    medioDePago: dto.payment_method ? mapearMedio(dto.payment_method) : null,
    recotizacion: dto.requote ? mapearRecotizacion(dto.requote) : null,
    renovacion: dto.renewal ? { ...mapearResumenRenovacion(dto.renewal), canal: dto.renewal.channel } : null,
    formalizacion: f
      ? {
          asesorId: f.advisor_id,
          asesorCorreo: f.advisor_email,
          asesorNombre: f.advisor_name,
          formalizadaEn: f.formalized_at,
          recotizacionId: f.requote_id,
          metodo: f.acceptance.method,
          aceptadaEn: f.acceptance.accepted_at,
          referencia: f.acceptance.reference,
        }
      : null,
    cobro: c
      ? {
          estado: c.status,
          motivoFalla: c.failure_reason,
          codigoRechazo: c.decline_code,
          ultimaFallaEn: c.last_failure_at,
          intentos: c.attempts,
          polizaId: c.policy_id,
        }
      : null,
    modoConsentimiento: dto.consent_mode,
    puedeRecotizar: dto.can_requote,
    puedeFormalizar: dto.can_formalize,
    motivoBloqueo: dto.blocked_reason,
  };
}

export function mapearCodigoEnviado(dto: CodigoRenovacionEnviadoDto): CodigoRenovacionEnviado {
  return { recotizacionId: dto.requote_id, enviadoA: dto.sent_to, venceEn: dto.expires_at };
}

/** Nombre con que la pantalla identifica al asesor: su nombre o, si la cuenta no lo tiene, su correo. */
export function nombreDelAsesor(f: FormalizacionRenovacion): string {
  return f.asesorNombre?.trim() || f.asesorCorreo;
}

/** Cuerpo de `POST …/assisted-renewal/requotes`: la casilla solo viaja cuando el asesor la marcó. */
export function aSolicitudRecotizacionDto(consentimientoAfirmado: boolean): Record<string, unknown> {
  return consentimientoAfirmado ? { consent_affirmed: true } : {};
}

/** Cuerpo de `POST …/assisted-renewal/formalization`: el mismo de la compra (HU-W1.1-03) con la recotización. */
export function aSolicitudFormalizacionRenovacionDto(s: SolicitudFormalizacionRenovacion): Record<string, unknown> {
  return { requote_id: s.recotizacionId, ...aSolicitudFormalizacionDto(s) };
}

/** Campo del formulario al que apunta un error de validación. */
export type CampoRenovacionAsistida = 'metodo' | 'fecha' | 'referencia' | 'codigo' | 'recotizacion' | 'consentimiento';

/** Un campo inválido según el backend. */
export interface ErrorDeCampoRenovacion {
  campo: CampoRenovacionAsistida;
  codigo: CodigoCampoFormalizacion;
}

const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoRenovacionAsistida>> = {
  'acceptance.method': 'metodo',
  'acceptance.accepted_at': 'fecha',
  'acceptance.reference': 'referencia',
  confirmation_code: 'codigo',
  requote_id: 'recotizacion',
  consent_affirmed: 'consentimiento',
};

const CODIGOS_CAMPO: readonly string[] = ['required', 'invalid_format', 'out_of_range'];

/** Códigos estables del contrato. La pantalla decide el texto por el código, nunca por `message`. */
export const CODIGOS_ERROR_RENOVACION_ASISTIDA = [
  'invalid_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'policy_not_found',
  'requote_not_found',
  'renewal_not_available',
  'renewal_closed',
  'already_formalized',
  'payment_method_missing',
  'consent_required',
  'consent_unverifiable',
  'requote_expired',
  'requote_superseded',
  'consent_code_required',
  'invalid_confirmation_code',
  'confirmation_code_expired',
  'too_many_attempts',
  'too_many_codes',
  'code_delivery_unavailable',
  'renewal_unavailable',
] as const;

export type CodigoErrorRenovacionAsistida = (typeof CODIGOS_ERROR_RENOVACION_ASISTIDA)[number];

/** Error de las rutas de la renovación asistida, con el código estable del contrato. */
export class ErrorRenovacionAsistida extends Error {
  constructor(
    readonly codigo: CodigoErrorRenovacionAsistida,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampoRenovacion[] = [],
  ) {
    super(`Error de renovación asistida: ${codigo}`);
    this.name = 'ErrorRenovacionAsistida';
  }
}

function esCodigoError(valor: unknown): valor is CodigoErrorRenovacionAsistida {
  return typeof valor === 'string' && (CODIGOS_ERROR_RENOVACION_ASISTIDA as readonly string[]).includes(valor);
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoRenovacion[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoRenovacion[] = [];
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
export function traducirErrorRenovacionAsistida(error: unknown): ErrorRenovacionAsistida {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorRenovacionAsistida('renewal_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const { error: codigo } = cuerpo as Record<string, unknown>;
    if (esCodigoError(codigo)) {
      return new ErrorRenovacionAsistida(codigo, codigo === 'validation_failed' ? extraerCampos(cuerpo as Record<string, unknown>) : []);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorRenovacionAsistida('invalid_request');
    case 401:
      return new ErrorRenovacionAsistida('unauthorized');
    case 403:
      return new ErrorRenovacionAsistida('forbidden');
    case 404:
      return new ErrorRenovacionAsistida('policy_not_found');
    case 409:
      return new ErrorRenovacionAsistida('renewal_not_available');
    default:
      return new ErrorRenovacionAsistida('renewal_unavailable');
  }
}
