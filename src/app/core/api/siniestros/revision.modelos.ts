import { HttpErrorResponse } from '@angular/common/http';

import { Evaluacion, EvaluacionDto, mapearEvaluacion } from './evaluacion.modelos';
import {
  EstadoSiniestro,
  ResumenSiniestro,
  ResumenSiniestroDto,
  mapearResumenSiniestro,
} from './siniestro.modelos';

/**
 * Modelos de la revisión de la radicación por el asesor (HU-W2.1-03, pantalla S8), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.10.0) y `docs/contratos/HU-W2.1-03-api.md`.
 *
 * El asesor da un veredicto por soporte: **válido**, **ilegible** (el asegurado lo reemplaza) o **falta** (requerido sin
 * adjuntar, u opcional que el asesor pide). Aprueba si todo lo adjunto es válido y no falta ningún requerido; si no,
 * devuelve con un motivo de la lista y un mensaje para el cliente.
 */

export type VeredictoSoporte = 'valid' | 'illegible' | 'missing';

export const MOTIVOS_DEVOLUCION = [
  'illegible_or_incomplete_supports',
  'inconsistent_facts',
  'missing_information',
  'other',
] as const;
export type MotivoDevolucion = (typeof MOTIVOS_DEVOLUCION)[number];

export const DATOS_CORREGIBLES = [
  'occurred_at',
  'place',
  'description',
  'estimated_amount',
] as const;
export type DatoCorregible = (typeof DATOS_CORREGIBLES)[number];

/** Límites del contrato, en caracteres. */
export const MAXIMO_MENSAJE = 1000;
export const MAXIMO_NOTA = 300;

/** Un soporte del tipo de siniestro y cuántos archivos tiene: una fila de «Soportes adjuntos» de S8. */
export interface ItemRevision {
  codigoRequisito: string;
  etiqueta: string;
  requerido: boolean;
  archivos: number;
}

export interface SoporteRevisado {
  codigoRequisito: string;
  etiqueta: string;
  veredicto: VeredictoSoporte;
  nota: string | null;
}

export interface Revision {
  secuencia: number;
  resultado: 'approved' | 'returned';
  revisadaPor: string;
  /** Nombre del asesor tal como lo lee el asegurado (A9); su correo si no tiene nombre. */
  nombreRevisor: string;
  revisadaEn: string;
  motivo: MotivoDevolucion | null;
  mensaje: string | null;
  soportes: SoporteRevisado[];
  datosACorregir: DatoCorregible[];
}

/** Todo lo que el asesor revisa (S8): la lectura de la evaluación, sin prioridad, y lo propio de la revisión. */
export interface RadicacionEnRevision extends Evaluacion {
  checklist: ItemRevision[];
  /** Los otros siniestros del asegurado sobre la misma póliza, del más nuevo al más viejo. */
  siniestrosPrevios: ResumenSiniestro[];
  revisiones: Revision[];
}

export interface ResultadoRevision {
  siniestroId: string;
  numeroRadicado: string;
  estado: EstadoSiniestro;
  revision: Revision;
}

/** Lo que el asesor envía al devolver. Lo adjunto que no se menciona queda válido. */
export interface SolicitudDevolucion {
  motivo: MotivoDevolucion;
  mensaje: string;
  soportes: { codigoRequisito: string; veredicto: VeredictoSoporte; nota?: string }[];
  datosACorregir: DatoCorregible[];
}

export interface RevisionDto {
  seq: number;
  outcome: 'approved' | 'returned';
  reviewed_by: string;
  reviewer_name: string;
  reviewed_at: string;
  reason_code: MotivoDevolucion | null;
  message: string | null;
  supports: {
    requirement_code: string;
    label: string;
    verdict: VeredictoSoporte;
    note: string | null;
  }[];
  facts_to_correct: DatoCorregible[];
}

export interface RadicacionEnRevisionDto extends EvaluacionDto {
  checklist: { requirement_code: string; label: string; required: boolean; files: number }[];
  prior_claims: ResumenSiniestroDto[];
  reviews: RevisionDto[];
}

export interface ResultadoRevisionDto {
  claim_id: string;
  filing_number: string;
  status: EstadoSiniestro;
  review: RevisionDto;
}

export function mapearRevision(dto: RevisionDto): Revision {
  return {
    secuencia: dto.seq,
    resultado: dto.outcome,
    revisadaPor: dto.reviewed_by,
    nombreRevisor: dto.reviewer_name,
    revisadaEn: dto.reviewed_at,
    motivo: dto.reason_code,
    mensaje: dto.message,
    soportes: dto.supports.map((s) => ({
      codigoRequisito: s.requirement_code,
      etiqueta: s.label,
      veredicto: s.verdict,
      nota: s.note,
    })),
    datosACorregir: [...dto.facts_to_correct],
  };
}

export function mapearRadicacionEnRevision(dto: RadicacionEnRevisionDto): RadicacionEnRevision {
  return {
    ...mapearEvaluacion(dto),
    checklist: dto.checklist.map((item) => ({
      codigoRequisito: item.requirement_code,
      etiqueta: item.label,
      requerido: item.required,
      archivos: item.files,
    })),
    siniestrosPrevios: dto.prior_claims.map(mapearResumenSiniestro),
    revisiones: dto.reviews.map(mapearRevision),
  };
}

export function mapearResultadoRevision(dto: ResultadoRevisionDto): ResultadoRevision {
  return {
    siniestroId: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estado: dto.status,
    revision: mapearRevision(dto.review),
  };
}

/** Cuerpo de `POST /v1/claims/{claim_id}/review-return`. La nota vacía no viaja. */
export function aDevolucionDto(solicitud: SolicitudDevolucion): Record<string, unknown> {
  return {
    reason_code: solicitud.motivo,
    message: solicitud.mensaje.trim(),
    supports: solicitud.soportes.map((s) => {
      const nota = s.nota?.trim();
      return nota
        ? { requirement_code: s.codigoRequisito, verdict: s.veredicto, note: nota }
        : { requirement_code: s.codigoRequisito, verdict: s.veredicto };
    }),
    facts_to_correct: [...solicitud.datosACorregir],
  };
}

/** Códigos estables de la revisión (contrato, sección 3). */
export type CodigoErrorRevision =
  | 'invalid_request'
  | 'claim_not_found'
  | 'claim_not_reviewable'
  | 'supports_incomplete'
  | 'reason_code_invalid'
  | 'message_required'
  | 'message_too_long'
  | 'note_too_long'
  | 'nothing_requested'
  | 'support_not_applicable'
  | 'verdict_not_applicable'
  | 'claims_unavailable'
  | 'unauthorized'
  | 'forbidden';

const CODIGOS_REVISION: readonly string[] = [
  'invalid_request',
  'claim_not_found',
  'claim_not_reviewable',
  'supports_incomplete',
  'reason_code_invalid',
  'message_required',
  'message_too_long',
  'note_too_long',
  'nothing_requested',
  'support_not_applicable',
  'verdict_not_applicable',
  'claims_unavailable',
];

export class ErrorRevision extends Error {
  constructor(readonly codigo: CodigoErrorRevision) {
    super(`Error de la revisión: ${codigo}`);
    this.name = 'ErrorRevision';
  }
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo reconocible se decide por el estado: `400` →
 * `invalid_request`, `401`/`403` (los resuelve el interceptor), `404` → `claim_not_found`, `409` →
 * `claim_not_reviewable` y lo demás (red, 5xx del API Gateway) → `claims_unavailable`.
 */
export function traducirErrorRevision(error: unknown): ErrorRevision {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorRevision('claims_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_REVISION.includes(codigo)) {
      return new ErrorRevision(codigo as CodigoErrorRevision);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorRevision('invalid_request');
    case 401:
      return new ErrorRevision('unauthorized');
    case 403:
      return new ErrorRevision('forbidden');
    case 404:
      return new ErrorRevision('claim_not_found');
    case 409:
      return new ErrorRevision('claim_not_reviewable');
    default:
      return new ErrorRevision('claims_unavailable');
  }
}
