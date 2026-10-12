import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la aceptación de la oferta del servicio de originación (HU-W1.3-01), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.4.0) y su contrato para el front
 * (`HU-W1.3-01-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/** Canal donde se aceptó la oferta. El portal web envía siempre `web`. */
export type CanalAceptacion = 'web' | 'mobile';

/**
 * Estado de la aceptación (§4): `registered` aceptación guardada, suscripción en curso o reintentándose;
 * `issuance_pending` riesgo aprobado y emisión iniciada; `in_review` enrutada a la bandeja del asesor.
 * Los dos últimos son finales en esta historia.
 */
export type EstadoAceptacion = 'registered' | 'issuance_pending' | 'in_review';

/** Decisión de la suscripción automática. */
export type ResultadoSuscripcion = 'approved' | 'human_review';

/** Motivo del enrutamiento a revisión humana; `null` si la suscripción aprobó. */
export type MotivoRevision = 'provisional_offer' | 'low_risk_score';

export interface SuscripcionAceptacion {
  resultado: ResultadoSuscripcion;
  motivo: MotivoRevision | null;
  decididaEn: string;
}

export interface ProcesamientoAceptacion {
  /** Intentos fallidos de procesamiento. Más de 0 con `registered` = trámite reanudándose tras una falla. */
  intentos: number;
  ultimaFallaEn: string | null;
  /** Próximo intento automático; `null` cuando el estado ya no es `registered`. */
  proximoIntentoEn: string | null;
}

/** Aceptación de una oferta. Las fechas son RFC 3339 en UTC. */
export interface Aceptacion {
  aceptacionId: string;
  ofertaId: string;
  clienteId: string;
  canal: CanalAceptacion;
  /** Momento en que quedó registrada la aceptación (punto de no pérdida). */
  aceptadaEn: string;
  estado: EstadoAceptacion;
  /** `null` hasta que la suscripción decide. */
  suscripcion: SuscripcionAceptacion | null;
  procesamiento: ProcesamientoAceptacion;
  actualizadaEn: string;
}

/** Respuesta cruda del contrato (snake_case). */
export interface AceptacionDto {
  acceptance_id: string;
  offer_id: string;
  customer_id: string;
  channel: CanalAceptacion;
  accepted_at: string;
  status: EstadoAceptacion;
  underwriting: {
    outcome: ResultadoSuscripcion;
    reason: MotivoRevision | null;
    decided_at: string;
  } | null;
  processing: {
    attempts: number;
    last_failure_at: string | null;
    next_attempt_at: string | null;
  };
  updated_at: string;
}

/** Traduce la respuesta del contrato al modelo del cliente. */
export function mapearAceptacion(dto: AceptacionDto): Aceptacion {
  return {
    aceptacionId: dto.acceptance_id,
    ofertaId: dto.offer_id,
    clienteId: dto.customer_id,
    canal: dto.channel,
    aceptadaEn: dto.accepted_at,
    estado: dto.status,
    suscripcion: dto.underwriting
      ? {
          resultado: dto.underwriting.outcome,
          motivo: dto.underwriting.reason,
          decididaEn: dto.underwriting.decided_at,
        }
      : null,
    procesamiento: {
      intentos: dto.processing.attempts,
      ultimaFallaEn: dto.processing.last_failure_at,
      proximoIntentoEn: dto.processing.next_attempt_at,
    },
    actualizadaEn: dto.updated_at,
  };
}

/** `issuance_pending` e `in_review` no cambian en esta historia: no hay nada más que consultar. */
export function esEstadoFinal(estado: EstadoAceptacion): boolean {
  return estado !== 'registered';
}

/** Códigos estables del catálogo de errores (§3). La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorAceptacion =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'offer_not_found'
  | 'acceptance_not_found'
  | 'offer_expired'
  | 'acceptance_not_registered'
  | 'acceptance_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'offer_not_found',
  'acceptance_not_found',
  'offer_expired',
  'acceptance_not_registered',
  'acceptance_unavailable',
];

function esCodigoError(valor: unknown): valor is CodigoErrorAceptacion {
  return typeof valor === 'string' && CODIGOS_ERROR.includes(valor);
}

/** Error de las rutas de aceptación, con el código estable del contrato. */
export class ErrorAceptacion extends Error {
  constructor(
    readonly codigo: CodigoErrorAceptacion,
    /** Solo con `offer_expired`: fin de la vigencia de la oferta. */
    readonly venceEn: string | null = null,
  ) {
    super(`Error de aceptación: ${codigo}`);
    this.name = 'ErrorAceptacion';
  }
}

/** Código que se usa cuando la respuesta no trae un cuerpo JSON del contrato, según el endpoint. */
export interface RespaldoErrorAceptacion {
  noEncontrado: 'offer_not_found' | 'acceptance_not_found';
  indisponible: 'acceptance_not_registered' | 'acceptance_unavailable';
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway)
 * se trata como el 503 del mismo endpoint (§3).
 */
export function traducirErrorAceptacion(
  error: unknown,
  respaldo: RespaldoErrorAceptacion,
): ErrorAceptacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorAceptacion(respaldo.indisponible);
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const campos = cuerpo as Record<string, unknown>;
    const codigo = campos['error'];
    const expiraEn = campos['expires_at'];
    if (esCodigoError(codigo)) {
      return new ErrorAceptacion(codigo, typeof expiraEn === 'string' ? expiraEn : null);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorAceptacion('invalid_request');
    case 401:
      return new ErrorAceptacion('unauthorized');
    case 403:
      return new ErrorAceptacion('forbidden');
    case 404:
      return new ErrorAceptacion(respaldo.noEncontrado);
    default:
      return new ErrorAceptacion(respaldo.indisponible);
  }
}
