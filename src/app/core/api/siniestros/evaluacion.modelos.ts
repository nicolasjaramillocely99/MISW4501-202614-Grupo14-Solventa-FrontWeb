import { HttpErrorResponse } from '@angular/common/http';

import {
  DetalleSiniestro,
  DetalleSiniestroDto,
  ResumenSiniestro,
  ResumenSiniestroDto,
  mapearDetalleSiniestro,
  mapearResumenSiniestro,
} from './siniestro.modelos';
import { TriageOperaciones, TriageSiniestroDto, mapearTriageSiniestro } from './triage.modelos';

/**
 * Modelos de la evaluación, aprobación y pago del siniestro (HU-W2.2-03), tipados según `services/claims/api/openapi.yaml`
 * del backend (v0.8.0) y `docs/contratos/HU-W2.2-03-api.md`. Los montos llegan en centavos (`*_minor`) y aquí se
 * convierten a pesos para mostrarlos con `formatoMoneda`; al aprobar se envían otra vez en centavos.
 *
 * **Bruto y neto:** el analista aprueba el costo bruto (`gross_amount_minor`); el deducible lo asume el asegurado y la
 * aseguradora paga el neto (`payout_amount_minor`), que es el «Monto aprobado» de O6. El deducible lo calcula solo el
 * backend; el portal lo muestra antes de aprobar con `calcularDesglose` y la respuesta lo confirma.
 */

/** Nivel de prioridad del triage (HU-W2.2-01). */
export interface PrioridadSiniestro {
  estado: 'pending' | 'assessed' | 'not_applicable' | 'not_found';
  nivel: 1 | 2 | 3 | null;
  severidad: 'high' | 'medium' | 'low' | null;
  bandaMonto: 'high' | 'medium' | 'low' | 'unknown' | null;
}

/** Fila de la cola de evaluación y de las excepciones de pago. */
export interface CasoEnCola extends ResumenSiniestro {
  /** Pesos; `null` si el asegurado no lo declaró. */
  montoEstimado: number | null;
  prioridad: PrioridadSiniestro;
}

export interface PaginaCola {
  items: CasoEnCola[];
  siguienteToken: string | null;
}

export interface Cobertura {
  incidente: string;
  /** Pesos: el tope del costo aprobado. */
  valorAsegurado: number;
  moneda: string;
  /** 500 = 5 %. */
  deduciblePuntosBasicos: number;
}

export interface PolizaVigente {
  id: string;
  ramo: string;
  producto: string;
  objetoAsegurado: string;
  estado: string;
  coberturas: Cobertura[];
}

export interface CuentaEnmascarada {
  codigoBanco: string;
  nombreBanco: string;
  tipoCuenta: string;
  /** «•••• 4512»: el número completo nunca llega al portal. */
  numeroEnmascarado: string;
}

export interface Asegurado {
  nombreCompleto: string;
  tipoDocumento: string;
  documento: string;
  correo: string;
  telefono: string;
  cuenta: CuentaEnmascarada;
}

export interface SoporteFirmado {
  soporteId: string;
  codigoRequisito: string;
  nombreArchivo: string;
  tipoContenido: string;
  /** URL de lectura de 10 minutos; `null` si no se pudo firmar. */
  urlDescarga: string | null;
}

export interface EvidenciaFirmada {
  tipo: string;
  capturadaEn: string;
  ubicacionConfiable: boolean;
  urlDescarga: string | null;
}

export interface CalculoPrioridad {
  nivel: 1 | 2 | 3;
  calculadoEn: string;
}

export type EstadoPago = 'pending' | 'in_progress' | 'paid' | 'failed';

export interface Aprobacion {
  /** Costo bruto aprobado, en pesos. */
  bruto: number;
  valorAsegurado: number;
  deduciblePuntosBasicos: number;
  deducible: number;
  /** Neto que paga la aseguradora: el «Monto aprobado» de O6. */
  neto: number;
  moneda: string;
}

export interface PagoIndemnizacion {
  /** Clave idempotente del pago: no cambia aunque se reintente. */
  referencia: string;
  estado: EstadoPago;
  destino: CuentaEnmascarada;
  intentosAutomaticos: number;
  maximoIntentosAutomaticos: number;
  falla: 'rejected' | 'retries_exhausted' | null;
  codigoPasarela: string | null;
  ultimaFallaEn: string | null;
  referenciaPasarela: string | null;
  pagadoEn: string | null;
  reintentosManuales: number;
  ultimoReintentoPor: string | null;
  ultimoReintentoEn: string | null;
}

export type EstadoDecision = 'approved' | 'paid' | 'rejected' | 'payment_exception';

export interface Decision {
  siniestroId: string;
  numeroRadicado: string;
  /** El estado en que la decisión deja el caso. */
  estado: EstadoDecision;
  resultado: 'approved' | 'rejected';
  decididaPor: string;
  decididaEn: string;
  aprobacion: Aprobacion | null;
  pago: PagoIndemnizacion | null;
  rechazo: { motivo: string; notificadoEn: string | null } | null;
}

/** Todo lo que el analista necesita para decidir (O6) o atender el pago fallido (O6b). */
export interface Evaluacion {
  siniestro: DetalleSiniestro & { montoEstimado: number | null; evidencia: EvidenciaFirmada[] };
  soportes: SoporteFirmado[];
  /** El nivel vigente, para el encabezado; `null` mientras el triage no lo calcula. */
  prioridadActual: CalculoPrioridad | null;
  /** La vista de operaciones de HU-W2.2-01, la misma de `GET /v1/claims/{id}/triage`: la pintan sus componentes. */
  triage: TriageOperaciones | null;
  poliza: PolizaVigente | null;
  cobertura: Cobertura | null;
  asegurado: Asegurado | null;
  /** El núcleo de pólizas no respondió: el caso se ve, pero no se puede decidir. */
  polizaNoDisponible: boolean;
  decision: Decision | null;
}

/** Destino corregido del reintento manual. */
export interface DestinoPago {
  codigoBanco: string;
  nombreBanco: string;
  tipoCuenta: 'savings' | 'checking';
  numeroCuenta: string;
}

/** El desglose que muestra O6 antes de aprobar, con la misma regla del backend. */
export interface Desglose {
  bruto: number;
  deducible: number;
  neto: number;
}

/**
 * Deducible y neto de un costo bruto en pesos: el deducible se redondea al centavo como en el backend
 * (`domain.DeductibleOf`). Con $ 4.350.000 y 5 %: deducible $ 217.500 y neto $ 4.132.500.
 */
export function calcularDesglose(brutoPesos: number, deduciblePuntosBasicos: number): Desglose {
  const brutoCentavos = Math.round(brutoPesos * 100);
  const deducibleCentavos = Math.floor((brutoCentavos * deduciblePuntosBasicos + 5000) / 10000);
  return {
    bruto: brutoCentavos / 100,
    deducible: deducibleCentavos / 100,
    neto: (brutoCentavos - deducibleCentavos) / 100,
  };
}

const aPesos = (centavos: number): number => centavos / 100;
const aPesosOpcional = (centavos: number | null | undefined): number | null =>
  centavos === null || centavos === undefined ? null : aPesos(centavos);

interface PrioridadDto {
  state: PrioridadSiniestro['estado'];
  level: 1 | 2 | 3 | null;
  severity: PrioridadSiniestro['severidad'];
  amount_band: PrioridadSiniestro['bandaMonto'];
}

export interface CasoEnColaDto extends ResumenSiniestroDto {
  estimated_amount_minor: number | null;
  triage: PrioridadDto;
}

export interface PaginaColaDto {
  items: CasoEnColaDto[];
  next_page_token: string | null;
}

interface CoberturaDto {
  incident: string;
  insured_value_minor: number;
  currency: string;
  deductible_basis_points: number;
}

interface CuentaDto {
  bank_code: string;
  bank_name: string;
  account_type: string;
  masked_number: string;
}

export interface DecisionDto {
  claim_id: string;
  filing_number: string;
  status: EstadoDecision;
  outcome: 'approved' | 'rejected';
  decided_by: string;
  decided_at: string;
  approval: {
    gross_amount_minor: number;
    insured_value_minor: number;
    deductible_basis_points: number;
    deductible_minor: number;
    payout_amount_minor: number;
    currency: string;
  } | null;
  payout: {
    payment_reference: string;
    status: EstadoPago;
    destination: CuentaDto;
    automatic_attempts: number;
    max_automatic_attempts: number;
    failure: 'rejected' | 'retries_exhausted' | null;
    gateway_code: string | null;
    last_failure_at: string | null;
    gateway_reference: string | null;
    paid_at: string | null;
    manual_retries: number;
    last_retried_by: string | null;
    last_retried_at: string | null;
  } | null;
  rejection: { reason: string; notified_at: string | null } | null;
}

export interface EvaluacionDto {
  claim: DetalleSiniestroDto & {
    estimated_amount_minor?: number;
    evidence: { kind: string; captured_at: string; location_trusted: boolean; download_url: string | null }[];
  };
  support_files: {
    support_id: string;
    requirement_code: string;
    file_name: string;
    content_type: string;
    download_url: string | null;
  }[];
  /** La vista `operations` del triage (HU-W2.2-01). */
  triage: TriageSiniestroDto;
  policy: {
    policy_id: string;
    line: string;
    product: string;
    insured_object: string;
    status: string;
    coverages: CoberturaDto[];
  } | null;
  coverage: CoberturaDto | null;
  holder: {
    full_name: string;
    document_type: string;
    document_id: string;
    email: string;
    phone: string;
    payout_account: CuentaDto;
  } | null;
  policy_unavailable: boolean;
  decision: DecisionDto | null;
}

function mapearCobertura(dto: CoberturaDto): Cobertura {
  return {
    incidente: dto.incident,
    valorAsegurado: aPesos(dto.insured_value_minor),
    moneda: dto.currency,
    deduciblePuntosBasicos: dto.deductible_basis_points,
  };
}

function mapearCuenta(dto: CuentaDto): CuentaEnmascarada {
  return {
    codigoBanco: dto.bank_code,
    nombreBanco: dto.bank_name,
    tipoCuenta: dto.account_type,
    numeroEnmascarado: dto.masked_number,
  };
}

export function mapearPaginaCola(dto: PaginaColaDto): PaginaCola {
  return {
    items: dto.items.map((item) => ({
      ...mapearResumenSiniestro(item),
      montoEstimado: aPesosOpcional(item.estimated_amount_minor),
      prioridad: {
        estado: item.triage.state,
        nivel: item.triage.level,
        severidad: item.triage.severity,
        bandaMonto: item.triage.amount_band,
      },
    })),
    siguienteToken: dto.next_page_token,
  };
}

export function mapearDecision(dto: DecisionDto): Decision {
  const a = dto.approval;
  const p = dto.payout;
  return {
    siniestroId: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estado: dto.status,
    resultado: dto.outcome,
    decididaPor: dto.decided_by,
    decididaEn: dto.decided_at,
    aprobacion: a
      ? {
          bruto: aPesos(a.gross_amount_minor),
          valorAsegurado: aPesos(a.insured_value_minor),
          deduciblePuntosBasicos: a.deductible_basis_points,
          deducible: aPesos(a.deductible_minor),
          neto: aPesos(a.payout_amount_minor),
          moneda: a.currency,
        }
      : null,
    pago: p
      ? {
          referencia: p.payment_reference,
          estado: p.status,
          destino: mapearCuenta(p.destination),
          intentosAutomaticos: p.automatic_attempts,
          maximoIntentosAutomaticos: p.max_automatic_attempts,
          falla: p.failure,
          codigoPasarela: p.gateway_code,
          ultimaFallaEn: p.last_failure_at,
          referenciaPasarela: p.gateway_reference,
          pagadoEn: p.paid_at,
          reintentosManuales: p.manual_retries,
          ultimoReintentoPor: p.last_retried_by,
          ultimoReintentoEn: p.last_retried_at,
        }
      : null,
    rechazo: dto.rejection ? { motivo: dto.rejection.reason, notificadoEn: dto.rejection.notified_at } : null,
  };
}

export function mapearEvaluacion(dto: EvaluacionDto): Evaluacion {
  const h = dto.holder;
  const leido = mapearTriageSiniestro(dto.triage);
  const triage = leido.vista === 'operations' ? leido : null;
  const actual = triage?.actual ?? null;
  return {
    siniestro: {
      ...mapearDetalleSiniestro(dto.claim),
      montoEstimado: aPesosOpcional(dto.claim.estimated_amount_minor),
      evidencia: dto.claim.evidence.map((e) => ({
        tipo: e.kind,
        capturadaEn: e.captured_at,
        ubicacionConfiable: e.location_trusted,
        urlDescarga: e.download_url,
      })),
    },
    soportes: dto.support_files.map((s) => ({
      soporteId: s.support_id,
      codigoRequisito: s.requirement_code,
      nombreArchivo: s.file_name,
      tipoContenido: s.content_type,
      urlDescarga: s.download_url,
    })),
    prioridadActual: actual ? { nivel: actual.nivel, calculadoEn: actual.evaluadoEn } : null,
    triage,
    poliza: dto.policy
      ? {
          id: dto.policy.policy_id,
          ramo: dto.policy.line,
          producto: dto.policy.product,
          objetoAsegurado: dto.policy.insured_object,
          estado: dto.policy.status,
          coberturas: dto.policy.coverages.map(mapearCobertura),
        }
      : null,
    cobertura: dto.coverage ? mapearCobertura(dto.coverage) : null,
    asegurado: h
      ? {
          nombreCompleto: h.full_name,
          tipoDocumento: h.document_type,
          documento: h.document_id,
          correo: h.email,
          telefono: h.phone,
          cuenta: mapearCuenta(h.payout_account),
        }
      : null,
    polizaNoDisponible: dto.policy_unavailable,
    decision: dto.decision ? mapearDecision(dto.decision) : null,
  };
}

export function aDestinoDto(destino: DestinoPago): Record<string, string> {
  const dto: Record<string, string> = {
    bank_code: destino.codigoBanco,
    account_type: destino.tipoCuenta,
    account_number: destino.numeroCuenta,
  };
  if (destino.nombreBanco) {
    dto['bank_name'] = destino.nombreBanco;
  }
  return dto;
}

/** Códigos estables de la evaluación y la decisión (contrato, secciones 2 a 7). */
export type CodigoErrorEvaluacion =
  | 'invalid_request'
  | 'claim_not_found'
  | 'claim_not_decidable'
  | 'payout_not_retryable'
  | 'amount_out_of_range'
  | 'amount_exceeds_insured_value'
  | 'nothing_to_pay'
  | 'no_payout_account'
  | 'reason_required'
  | 'reason_too_long'
  | 'no_contact'
  | 'not_covered'
  | 'policy_unavailable'
  | 'claims_unavailable'
  | 'unauthorized'
  | 'forbidden';

const CODIGOS_EVALUACION: readonly string[] = [
  'invalid_request',
  'claim_not_found',
  'claim_not_decidable',
  'payout_not_retryable',
  'amount_out_of_range',
  'amount_exceeds_insured_value',
  'nothing_to_pay',
  'no_payout_account',
  'reason_required',
  'reason_too_long',
  'no_contact',
  'not_covered',
  'policy_unavailable',
  'claims_unavailable',
];

export class ErrorEvaluacion extends Error {
  constructor(readonly codigo: CodigoErrorEvaluacion) {
    super(`Error de la evaluación: ${codigo}`);
    this.name = 'ErrorEvaluacion';
  }
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo reconocible se decide por el estado: `400` →
 * `invalid_request`, `401`/`403` (los resuelve el interceptor), `404` → `claim_not_found`, `409` →
 * `claim_not_decidable` y lo demás (red, 5xx del API Gateway) → `claims_unavailable`.
 */
export function traducirErrorEvaluacion(error: unknown): ErrorEvaluacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorEvaluacion('claims_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_EVALUACION.includes(codigo)) {
      return new ErrorEvaluacion(codigo as CodigoErrorEvaluacion);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorEvaluacion('invalid_request');
    case 401:
      return new ErrorEvaluacion('unauthorized');
    case 403:
      return new ErrorEvaluacion('forbidden');
    case 404:
      return new ErrorEvaluacion('claim_not_found');
    case 409:
      return new ErrorEvaluacion('claim_not_decidable');
    default:
      return new ErrorEvaluacion('claims_unavailable');
  }
}
