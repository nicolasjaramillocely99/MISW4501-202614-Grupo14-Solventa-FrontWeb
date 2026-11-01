import { HttpErrorResponse } from '@angular/common/http';

import { OfertaAjustada, OfertaAjustadaDto, TipoDecision, mapearOfertaAjustada } from './aceptacion.modelos';
import { ModoPerfil } from './perfil-riesgo.modelos';

/**
 * Modelos de la bandeja de decisión humana del servicio de originación (HU-W1.1-02), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.8.0) y su contrato para el front (`HU-W1.1-02-api.md`).
 * El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/** Estado de una solicitud en la bandeja: pendiente de decisión o decidida (final). */
export type EstadoSolicitudRevision = 'pending' | 'decided';

/** Orden por fecha de llegada: `asc` la más antigua primero (como la bandeja), `desc` la más reciente. */
export type OrdenLlegada = 'asc' | 'desc';

/** Estado del correo que avisa al cliente el ajuste o el rechazo. */
export type EstadoAvisoCliente = 'pending' | 'sent' | 'failed';

export interface SolicitanteRevision {
  nombreCompleto: string;
  documento: string;
  correo: string;
}

export interface OfertaRevision {
  prima: number;
  moneda: string;
  /** Solo en el detalle; `null` si la oferta no se pudo leer. */
  modo: ModoPerfil | null;
  /** Solo en el detalle; `null` si la oferta no se pudo leer. */
  venceEn: string | null;
}

export interface AsesorDecision {
  /** Claim `sub` del token del asesor. */
  id: string;
  correo: string;
}

/** Aviso al cliente del ajuste o el rechazo (por correo). */
export interface AvisoCliente {
  canal: string;
  estado: EstadoAvisoCliente;
  /** Envíos fallidos hasta ahora. */
  intentos: number;
  enviadoEn: string | null;
}

/** Registro *append-only* de la decisión del asesor (CA-4). */
export interface DecisionHumana {
  decisionId: string;
  tipo: TipoDecision;
  asesor: AsesorDecision;
  decididaEn: string;
  /** Puede ser vacío en una aceptación. */
  observaciones: string;
  /** Solo en `adjust`. */
  ajustePrimaPct: number | null;
  /** Solo en `adjust`. */
  ofertaAjustada: OfertaAjustada | null;
  /** `null` en `accept` o sin canal de correo configurado. */
  aviso: AvisoCliente | null;
}

/** Solicitud de la bandeja. `aceptacionId` es también el número de la solicitud. */
export interface SolicitudRevision {
  aceptacionId: string;
  ofertaId: string;
  clienteId: string;
  solicitante: SolicitanteRevision;
  oferta: OfertaRevision;
  /**
   * Motivo del enrutamiento (`provisional_offer`, `high_risk_score`). Se deja como texto: un motivo nuevo del
   * motor de suscripción se muestra con un texto genérico.
   */
  motivo: string;
  llegadaEn: string;
  estado: EstadoSolicitudRevision;
  /** `null` mientras está pendiente. */
  decision: DecisionHumana | null;
}

export interface ConteosBandeja {
  pendientes: number;
  decididas: number;
}

export interface ListaSolicitudesRevision {
  solicitudes: SolicitudRevision[];
  /** Respetan el motivo e ignoran el estado: alimentan las dos pestañas. */
  conteos: ConteosBandeja;
}

/** Filtro de la bandeja (CA-5). */
export interface FiltroBandeja {
  estado: EstadoSolicitudRevision;
  /** `null` = todos los motivos. */
  motivo: string | null;
  orden: OrdenLlegada;
}

/** Decisión que registra el asesor (CA-2). */
export interface RegistroDecision {
  tipo: TipoDecision;
  /** Obligatorias al ajustar o rechazar; opcionales al aceptar. */
  observaciones?: string;
  /** Recargo en %; solo al ajustar. */
  ajustePrimaPct?: number;
}

/** Respuesta cruda del contrato (snake_case). */
export interface SolicitudRevisionDto {
  acceptance_id: string;
  offer_id: string;
  customer_id: string;
  applicant: { full_name: string; document_id: string; email: string };
  offer: { premium: number; currency: string; mode?: ModoPerfil | null; expires_at?: string | null };
  reason: string;
  received_at: string;
  status: EstadoSolicitudRevision;
  decision: {
    decision_id: string;
    type: TipoDecision;
    advisor: { id: string; email: string };
    decided_at: string;
    observations: string;
    premium_adjustment_pct: number | null;
    adjusted_offer: OfertaAjustadaDto | null;
    notification: { channel: string; status: EstadoAvisoCliente; attempts: number; sent_at: string | null } | null;
  } | null;
}

export interface ListaSolicitudesRevisionDto {
  items: SolicitudRevisionDto[];
  counts: { pending: number; decided: number };
}

export interface RegistroDecisionDto {
  type: TipoDecision;
  observations?: string;
  premium_adjustment_pct?: number;
}

/** Traduce una solicitud del contrato al modelo del cliente. */
export function mapearSolicitudRevision(dto: SolicitudRevisionDto): SolicitudRevision {
  const d = dto.decision;
  return {
    aceptacionId: dto.acceptance_id,
    ofertaId: dto.offer_id,
    clienteId: dto.customer_id,
    solicitante: {
      nombreCompleto: dto.applicant.full_name,
      documento: dto.applicant.document_id,
      correo: dto.applicant.email,
    },
    oferta: {
      prima: dto.offer.premium,
      moneda: dto.offer.currency,
      modo: dto.offer.mode ?? null,
      venceEn: dto.offer.expires_at ?? null,
    },
    motivo: dto.reason,
    llegadaEn: dto.received_at,
    estado: dto.status,
    decision: d
      ? {
          decisionId: d.decision_id,
          tipo: d.type,
          asesor: { id: d.advisor.id, correo: d.advisor.email },
          decididaEn: d.decided_at,
          observaciones: d.observations,
          ajustePrimaPct: d.premium_adjustment_pct,
          ofertaAjustada: mapearOfertaAjustada(d.adjusted_offer),
          aviso: d.notification
            ? {
                canal: d.notification.channel,
                estado: d.notification.status,
                intentos: d.notification.attempts,
                enviadoEn: d.notification.sent_at,
              }
            : null,
        }
      : null,
  };
}

export function mapearListaSolicitudesRevision(dto: ListaSolicitudesRevisionDto): ListaSolicitudesRevision {
  return {
    solicitudes: dto.items.map(mapearSolicitudRevision),
    conteos: { pendientes: dto.counts.pending, decididas: dto.counts.decided },
  };
}

/** Cuerpo del `POST` de la decisión: solo envía lo que aplica al tipo. */
export function aRegistroDecisionDto(registro: RegistroDecision): RegistroDecisionDto {
  const dto: RegistroDecisionDto = { type: registro.tipo };
  if (registro.observaciones !== undefined && registro.observaciones.trim() !== '') {
    dto.observations = registro.observaciones.trim();
  }
  if (registro.tipo === 'adjust' && registro.ajustePrimaPct !== undefined) {
    dto.premium_adjustment_pct = registro.ajustePrimaPct;
  }
  return dto;
}

/** Códigos estables del catálogo de errores (§3). La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorRevision =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'observations_required'
  | 'premium_adjustment_invalid'
  | 'review_request_not_found'
  | 'review_request_already_decided'
  | 'decision_not_registered'
  | 'decision_continuation_pending'
  | 'review_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'observations_required',
  'premium_adjustment_invalid',
  'review_request_not_found',
  'review_request_already_decided',
  'decision_not_registered',
  'decision_continuation_pending',
  'review_unavailable',
];

function esCodigoError(valor: unknown): valor is CodigoErrorRevision {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Error de las rutas de la bandeja, con el código estable del contrato. */
export class ErrorRevision extends Error {
  constructor(readonly codigo: CodigoErrorRevision) {
    super(`Error de la bandeja de decisión: ${codigo}`);
    this.name = 'ErrorRevision';
  }
}

/** Código que se usa sin cuerpo JSON del contrato para un 5xx o un error de red, según el endpoint. */
export type RespaldoErrorRevision = 'review_unavailable' | 'decision_not_registered';

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se
 * trata como el 503 del mismo endpoint (§3).
 */
export function traducirErrorRevision(error: unknown, respaldo: RespaldoErrorRevision): ErrorRevision {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorRevision(respaldo);
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (esCodigoError(codigo)) {
      return new ErrorRevision(codigo);
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
      return new ErrorRevision('review_request_not_found');
    case 409:
      return new ErrorRevision('review_request_already_decided');
    default:
      return new ErrorRevision(respaldo);
  }
}
