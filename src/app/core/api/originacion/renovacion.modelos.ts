import { HttpErrorResponse } from '@angular/common/http';

import { Cobro, CobroDto, MedioDePago, MedioDePagoDto, mapearCobro } from './cobro.modelos';

/**
 * Modelos de las pólizas del asegurado y su renovación en línea (HU-W1.5-02), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.12.0) y su contrato para el front (`HU-W1.5-02-api.md`).
 * El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/**
 * Estado de la renovación de un periodo: `accepted` el asegurado aceptó y se cobra la prima (o aún puede arreglar el
 * pago); `renewed` cobrada y póliza nueva activa; `not_renewed` la ventana cerró sin respuesta o el pago no se resolvió.
 */
export type EstadoRenovacion = 'accepted' | 'renewed' | 'not_renewed';

/** Por qué una póliza no se renovó: no respondió a tiempo o el pago no se resolvió dentro del plazo. */
export type MotivoNoRenovada = 'no_response' | 'payment_failed';

/** Cobertura de una póliza; el código lo traduce la pantalla. */
export interface CoberturaPoliza {
  codigo: string;
  valorAsegurado: number;
}

/** Póliza activa del asegurado. Las fechas son RFC 3339 en UTC. */
export interface Poliza {
  polizaId: string;
  titular: string;
  prima: number;
  moneda: string;
  valorAsegurado: number;
  coberturas: CoberturaPoliza[];
  vigenciaDesde: string;
  vigenciaHasta: string;
  /** Póliza que esta renueva; `null` si es negocio nuevo. */
  renovacionDe: string | null;
}

/** Cuándo abre y cuándo cierra la renovación: cierra cuando termina la cobertura. */
export interface VentanaRenovacion {
  abreEn: string;
  cierraEn: string;
}

/** Resumen de la renovación de un periodo. */
export interface ResumenRenovacion {
  renovacionId: string;
  estado: EstadoRenovacion;
  motivo: MotivoNoRenovada | null;
  polizaNuevaId: string | null;
  /** Id del cobro de la prima: sirve como `{acceptance_id}` para consultarlo y entregar otro medio de pago. */
  cobroId: string | null;
  aceptadaEn: string | null;
  /** Plazo para lograr el pago de la renovación. */
  reintentarHasta: string | null;
  cerradaEn: string | null;
}

/** Fila de «Mis pólizas» (A1). */
export interface PolizaListada extends Poliza {
  ventana: VentanaRenovacion;
  puedeRenovar: boolean;
  renovacion: ResumenRenovacion | null;
}

/** Un lado de la comparación de A4: la vigencia actual o la renovación. */
export interface CondicionesPoliza {
  prima: number;
  moneda: string;
  valorAsegurado: number;
  coberturas: CoberturaPoliza[];
  vigenciaDesde: string;
  vigenciaHasta: string;
}

/** Lo que el asegurado ve antes de aceptar (A4, criterio 1). */
export interface CondicionesRenovacion {
  poliza: Poliza;
  vigente: CondicionesPoliza;
  renovada: CondicionesPoliza;
  ventana: VentanaRenovacion;
  /** `false` cuando el motor no pudo tarifar y la renovación repite las condiciones vigentes. */
  recotizada: boolean;
  /** Descuento por buena experiencia aplicado a la prima renovada (0 a 1); 0 si no hay. */
  descuento: number;
  /** Medio con el que se pagó la póliza y con el que se cobra la renovación; `null` si no hay uno registrado. */
  medioDePago: MedioDePago | null;
}

/** Renovación aceptada o consultada (A4b), con su cobro. */
export interface Renovacion {
  resumen: ResumenRenovacion;
  condiciones: CondicionesPoliza;
  descuento: number;
  cobro: Cobro | null;
}

/** Resultado de aceptar: `creada` es `false` si el periodo ya estaba aceptado. */
export interface ResultadoRenovacion {
  renovacion: Renovacion;
  creada: boolean;
}

/** Respuestas crudas del contrato (snake_case). */
interface CoberturaDto {
  code: string;
  insured_amount: number;
}

export interface PolizaDto {
  policy_id: string;
  holder_name: string;
  premium: number;
  currency: string;
  insured_amount: number;
  coverages: CoberturaDto[];
  coverage_start: string;
  coverage_end: string;
  renewal_of: string | null;
}

interface VentanaDto {
  opens_at: string;
  closes_at: string;
}

export interface ResumenRenovacionDto {
  renewal_id: string;
  status: EstadoRenovacion;
  reason: MotivoNoRenovada | null;
  new_policy_id: string | null;
  charge_id: string | null;
  accepted_at: string | null;
  retry_until: string | null;
  closed_at: string | null;
}

export interface PolizaListadaDto extends PolizaDto {
  renewal_window: VentanaDto;
  can_renew: boolean;
  renewal: ResumenRenovacionDto | null;
}

export interface ListaPolizasDto {
  items: PolizaListadaDto[];
}

export interface CondicionesPolizaDto {
  premium: number;
  currency: string;
  insured_amount: number;
  coverages: CoberturaDto[];
  coverage_start: string;
  coverage_end: string;
}

export interface CondicionesRenovacionDto {
  policy: PolizaDto;
  current: CondicionesPolizaDto;
  renewal: CondicionesPolizaDto;
  renewal_window: VentanaDto;
  requoted: boolean;
  discount_rate: number;
  payment_method: MedioDePagoDto | null;
}

export interface RenovacionDto {
  renewal: ResumenRenovacionDto;
  terms: CondicionesPolizaDto;
  discount_rate: number;
  charge: CobroDto | null;
}

function mapearCoberturas(dtos: CoberturaDto[]): CoberturaPoliza[] {
  return dtos.map((c) => ({ codigo: c.code, valorAsegurado: c.insured_amount }));
}

export function mapearPoliza(dto: PolizaDto): Poliza {
  return {
    polizaId: dto.policy_id,
    titular: dto.holder_name,
    prima: dto.premium,
    moneda: dto.currency,
    valorAsegurado: dto.insured_amount,
    coberturas: mapearCoberturas(dto.coverages),
    vigenciaDesde: dto.coverage_start,
    vigenciaHasta: dto.coverage_end,
    renovacionDe: dto.renewal_of,
  };
}

function mapearVentana(dto: VentanaDto): VentanaRenovacion {
  return { abreEn: dto.opens_at, cierraEn: dto.closes_at };
}

export function mapearResumenRenovacion(dto: ResumenRenovacionDto): ResumenRenovacion {
  return {
    renovacionId: dto.renewal_id,
    estado: dto.status,
    motivo: dto.reason,
    polizaNuevaId: dto.new_policy_id,
    cobroId: dto.charge_id,
    aceptadaEn: dto.accepted_at,
    reintentarHasta: dto.retry_until,
    cerradaEn: dto.closed_at,
  };
}

export function mapearPolizaListada(dto: PolizaListadaDto): PolizaListada {
  return {
    ...mapearPoliza(dto),
    ventana: mapearVentana(dto.renewal_window),
    puedeRenovar: dto.can_renew,
    renovacion: dto.renewal ? mapearResumenRenovacion(dto.renewal) : null,
  };
}

function mapearCondiciones(dto: CondicionesPolizaDto): CondicionesPoliza {
  return {
    prima: dto.premium,
    moneda: dto.currency,
    valorAsegurado: dto.insured_amount,
    coberturas: mapearCoberturas(dto.coverages),
    vigenciaDesde: dto.coverage_start,
    vigenciaHasta: dto.coverage_end,
  };
}

export function mapearCondicionesRenovacion(dto: CondicionesRenovacionDto): CondicionesRenovacion {
  const medio = dto.payment_method;
  return {
    poliza: mapearPoliza(dto.policy),
    vigente: mapearCondiciones(dto.current),
    renovada: mapearCondiciones(dto.renewal),
    ventana: mapearVentana(dto.renewal_window),
    recotizada: dto.requoted,
    descuento: dto.discount_rate,
    medioDePago: medio
      ? {
          tipo: medio.method,
          marca: medio.brand,
          ultimosCuatro: medio.last4,
          cuotas: medio.installments,
          codigoBanco: medio.bank_code,
          tipoDePersona: medio.payer_type,
          capturadoEn: medio.captured_at,
        }
      : null,
  };
}

export function mapearRenovacion(dto: RenovacionDto): Renovacion {
  return {
    resumen: mapearResumenRenovacion(dto.renewal),
    condiciones: mapearCondiciones(dto.terms),
    descuento: dto.discount_rate,
    cobro: dto.charge ? mapearCobro(dto.charge) : null,
  };
}

/** Códigos estables del contrato. La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorRenovacion =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'policy_not_found'
  | 'renewal_not_found'
  /** La póliza está fuera de la ventana de renovación, o la ventana cerró sin renovación. */
  | 'renewal_not_available'
  /** El periodo ya se aceptó o se renovó. */
  | 'renewal_closed'
  | 'renewal_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'policy_not_found',
  'renewal_not_found',
  'renewal_not_available',
  'renewal_closed',
  'renewal_unavailable',
];

/** Error de las rutas de pólizas y renovación, con el código estable del contrato. */
export class ErrorRenovacion extends Error {
  constructor(readonly codigo: CodigoErrorRenovacion) {
    super(`Error de renovación: ${codigo}`);
    this.name = 'ErrorRenovacion';
  }
}

function esCodigoError(valor: unknown): valor is CodigoErrorRenovacion {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Traduce un error de HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorRenovacion(error: unknown): ErrorRenovacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorRenovacion('renewal_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (esCodigoError(codigo)) {
      return new ErrorRenovacion(codigo);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorRenovacion('invalid_request');
    case 401:
      return new ErrorRenovacion('unauthorized');
    case 403:
      return new ErrorRenovacion('forbidden');
    case 404:
      return new ErrorRenovacion('policy_not_found');
    case 409:
      return new ErrorRenovacion('renewal_not_available');
    default:
      return new ErrorRenovacion('renewal_unavailable');
  }
}
