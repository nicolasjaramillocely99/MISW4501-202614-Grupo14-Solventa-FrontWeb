import { HttpErrorResponse } from '@angular/common/http';

import { RequisitoDto, RequisitoSoporte, mapearRequisito } from './radicacion.modelos';
import { DatoCorregible, Revision, RevisionDto, mapearRevision } from './revision.modelos';
import { EstadoSiniestro } from './siniestro.modelos';

/**
 * Modelos del historial del siniestro y del reenvío de la radicación devuelta (HU-W2.1-04, pantalla A9), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.13.0) y `docs/contratos/HU-W2.1-04-api.md`.
 *
 * El asegurado corrige los hechos que cambian y, por cada soporte que toca, envía el **conjunto completo de archivos**
 * que queda: los que conserva más los nuevos. El caso conserva su número de radicado y vuelve a `active` para una nueva
 * revisión del asesor.
 */

/** Un cambio de estado del caso, como lo registra la base. */
export interface CambioEstado {
  id: number;
  estado: EstadoSiniestro;
  estadoAnterior: EstadoSiniestro | null;
  en: string;
}

/** Un dato que el reenvío cambió: RFC 3339 para la fecha, centavos para el monto; `null` sin valor. */
export interface CambioHecho {
  dato: DatoCorregible;
  antes: string | null;
  despues: string | null;
}

export interface CambioSoporte {
  codigoRequisito: string;
  etiqueta: string;
  agregados: string[];
  retirados: string[];
}

export interface Reenvio {
  secuencia: number;
  /** La devolución que respondió. */
  revisionSecuencia: number;
  reenviadoPor: string;
  reenviadoEn: string;
  hechos: CambioHecho[];
  soportes: CambioSoporte[];
}

/** `GET /v1/claims/{claim_id}/history`: cada etapa del caso, sus revisiones y sus reenvíos. */
export interface HistorialSiniestro {
  siniestroId: string;
  numeroRadicado: string;
  estado: EstadoSiniestro;
  ultimoCambioEn: string;
  cambios: CambioEstado[];
  revisiones: Revision[];
  /** La revisión que devolvió el caso, mientras está devuelto. */
  ultimaDevolucion: Revision | null;
  reenvios: Reenvio[];
  /** Los soportes que el caso puede tener, con sus reglas, en el orden del catálogo. */
  requisitos: RequisitoSoporte[];
  /** La decisión de operaciones como la lee el asegurado (HU-W2.1-02); `null` hasta que la haya. */
  decision: DecisionAsegurado | null;
  /** El prestador asignado (HU-W2.1-02): quién atiende y a qué distancia, nunca su contacto. */
  prestador: PrestadorAsegurado | null;
}

export interface DecisionAsegurado {
  resultado: 'approved' | 'rejected';
  decididaEn: string;
  /** Lo que paga la aseguradora, neto del deducible, en centavos; `null` en un rechazo. */
  montoMinor: number | null;
  moneda: string | null;
  estadoPago: 'pending' | 'in_progress' | 'confirmed' | 'failed' | null;
  pagadoEn: string | null;
  motivoRechazo: string | null;
}

export interface PrestadorAsegurado {
  nombre: string;
  distanciaKm: number;
  asignadoEn: string;
}

/** Lo que envía el asegurado. Un dato ausente se conserva; un grupo es el conjunto completo de archivos que queda. */
export interface SolicitudReenvio {
  revisionSecuencia: number;
  ocurridoEn?: string;
  lugar?: string;
  descripcion?: string;
  montoEstimadoMinor?: number;
  soportes?: { codigoRequisito: string; soporteIds: string[] }[];
}

export interface ResultadoReenvio {
  siniestroId: string;
  numeroRadicado: string;
  estado: EstadoSiniestro;
  reenvio: Reenvio;
}

export interface ReenvioDto {
  seq: number;
  review_seq: number;
  resubmitted_by: string;
  resubmitted_at: string;
  changed_facts: { fact: DatoCorregible; before: string | null; after: string | null }[];
  changed_supports: {
    requirement_code: string;
    label: string;
    added: string[];
    withdrawn: string[];
  }[];
}

export interface HistorialSiniestroDto {
  claim_id: string;
  filing_number: string;
  status: EstadoSiniestro;
  last_changed_at: string;
  changes: {
    id: number;
    status: EstadoSiniestro;
    previous_status: EstadoSiniestro | null;
    changed_at: string;
  }[];
  reviews: RevisionDto[];
  last_return: RevisionDto | null;
  resubmissions?: ReenvioDto[];
  requirements?: RequisitoDto[];
  decision?: {
    outcome: 'approved' | 'rejected';
    decided_at: string;
    amount_minor: number | null;
    currency: string | null;
    payout_status: 'pending' | 'in_progress' | 'confirmed' | 'failed' | null;
    paid_at: string | null;
    rejection_reason: string | null;
  } | null;
  provider?: { name: string; distance_km: number; assigned_at: string } | null;
}

export interface ResultadoReenvioDto {
  claim_id: string;
  filing_number: string;
  status: EstadoSiniestro;
  resubmission: ReenvioDto;
}

export interface SolicitudReenvioDto {
  review_seq: number;
  occurred_at?: string;
  place?: string;
  description?: string;
  estimated_amount_minor?: number;
  supports?: { requirement_code: string; support_ids: string[] }[];
}

export function mapearReenvio(dto: ReenvioDto): Reenvio {
  return {
    secuencia: dto.seq,
    revisionSecuencia: dto.review_seq,
    reenviadoPor: dto.resubmitted_by,
    reenviadoEn: dto.resubmitted_at,
    hechos: dto.changed_facts.map((h) => ({ dato: h.fact, antes: h.before, despues: h.after })),
    soportes: dto.changed_supports.map((s) => ({
      codigoRequisito: s.requirement_code,
      etiqueta: s.label,
      agregados: [...s.added],
      retirados: [...s.withdrawn],
    })),
  };
}

export function mapearHistorialSiniestro(dto: HistorialSiniestroDto): HistorialSiniestro {
  return {
    siniestroId: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estado: dto.status,
    ultimoCambioEn: dto.last_changed_at,
    cambios: dto.changes.map((c) => ({
      id: c.id,
      estado: c.status,
      estadoAnterior: c.previous_status,
      en: c.changed_at,
    })),
    revisiones: dto.reviews.map(mapearRevision),
    ultimaDevolucion: dto.last_return ? mapearRevision(dto.last_return) : null,
    reenvios: (dto.resubmissions ?? []).map(mapearReenvio),
    requisitos: (dto.requirements ?? []).map(mapearRequisito),
    decision: dto.decision
      ? {
          resultado: dto.decision.outcome,
          decididaEn: dto.decision.decided_at,
          montoMinor: dto.decision.amount_minor,
          moneda: dto.decision.currency,
          estadoPago: dto.decision.payout_status,
          pagadoEn: dto.decision.paid_at,
          motivoRechazo: dto.decision.rejection_reason,
        }
      : null,
    prestador: dto.provider
      ? { nombre: dto.provider.name, distanciaKm: dto.provider.distance_km, asignadoEn: dto.provider.assigned_at }
      : null,
  };
}

export function mapearResultadoReenvio(dto: ResultadoReenvioDto): ResultadoReenvio {
  return {
    siniestroId: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estado: dto.status,
    reenvio: mapearReenvio(dto.resubmission),
  };
}

export function aReenvioDto(solicitud: SolicitudReenvio): SolicitudReenvioDto {
  const dto: SolicitudReenvioDto = { review_seq: solicitud.revisionSecuencia };
  if (solicitud.ocurridoEn !== undefined) {
    dto.occurred_at = solicitud.ocurridoEn;
  }
  if (solicitud.lugar !== undefined) {
    dto.place = solicitud.lugar;
  }
  if (solicitud.descripcion !== undefined) {
    dto.description = solicitud.descripcion;
  }
  if (solicitud.montoEstimadoMinor !== undefined) {
    dto.estimated_amount_minor = solicitud.montoEstimadoMinor;
  }
  if (solicitud.soportes?.length) {
    dto.supports = solicitud.soportes.map((s) => ({
      requirement_code: s.codigoRequisito,
      support_ids: [...s.soporteIds],
    }));
  }
  return dto;
}

/** Códigos estables del reenvío y del historial. */
export type CodigoErrorReenvio =
  | 'validation_failed'
  | 'invalid_request'
  | 'claim_not_found'
  | 'claim_not_returned'
  | 'stale_return'
  | 'claims_unavailable';

const CODIGOS: readonly string[] = [
  'validation_failed',
  'invalid_request',
  'claim_not_found',
  'claim_not_returned',
  'stale_return',
  'claims_unavailable',
];

/** Un campo o soporte del `422`: `place`, `supports.traffic_report`… y su código. */
export interface CampoReenvio {
  campo: string;
  codigo: string;
}

export class ErrorReenvio extends Error {
  constructor(
    readonly codigo: CodigoErrorReenvio,
    readonly campos: readonly CampoReenvio[] = [],
  ) {
    super(`Error del reenvío: ${codigo}`);
    this.name = 'ErrorReenvio';
  }
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (red caída, un 5xx del API Gateway) se decide por el
 * estado: `400` → `invalid_request`, `404` → `claim_not_found`, `409` → `claim_not_returned`, `422` →
 * `validation_failed` y lo demás → `claims_unavailable`.
 */
export function traducirErrorReenvio(error: unknown): ErrorReenvio {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorReenvio('claims_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const registro = cuerpo as Record<string, unknown>;
    const codigo = registro['error'];
    if (typeof codigo === 'string' && CODIGOS.includes(codigo)) {
      return new ErrorReenvio(codigo as CodigoErrorReenvio, camposDe(registro['fields']));
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorReenvio('invalid_request');
    case 404:
      return new ErrorReenvio('claim_not_found');
    case 409:
      return new ErrorReenvio('claim_not_returned');
    case 422:
      return new ErrorReenvio('validation_failed');
    default:
      return new ErrorReenvio('claims_unavailable');
  }
}

function camposDe(valor: unknown): CampoReenvio[] {
  if (!Array.isArray(valor)) {
    return [];
  }
  return valor.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const { field, code } = item as Record<string, unknown>;
    return typeof field === 'string' && typeof code === 'string'
      ? [{ campo: field, codigo: code }]
      : [];
  });
}
