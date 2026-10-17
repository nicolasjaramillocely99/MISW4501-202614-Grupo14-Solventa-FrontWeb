import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la emisión contractual (documento y notificación; HU-W1.3-03), tipados según
 * `services/origination/api/openapi.yaml` del backend (v0.6.0) y su contrato para el front
 * (`docs/contratos/HU-W1.3-03-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos tipos.
 */

/**
 * `pending` activación recibida, documento aún no listo; `document_ready` documento disponible y notificación
 * pendiente o reintentándose; `completed` documento disponible y asegurado notificado; `failed` el correo no
 * pudo entregarse tras todos los intentos (el documento sigue disponible).
 */
export type EstadoEmision = 'pending' | 'document_ready' | 'completed' | 'failed';

export type EstadoNotificacion = 'pending' | 'sent' | 'failed';

export interface DocumentoContractual {
  documentoId: string;
  version: number;
  tamanoBytes: number;
  generadoEn: string;
}

export interface NotificacionEmision {
  canal: string;
  estado: EstadoNotificacion;
  /** Intentos fallidos hasta ahora. */
  intentos: number;
  enviadaEn: string | null;
}

export interface EmisionContractual {
  polizaId: string;
  estado: EstadoEmision;
  activadaEn: string;
  /** Cuándo quedó disponible el documento; `null` mientras no lo está. */
  disponibleEn: string | null;
  /** Si el documento estuvo disponible dentro de los 60 s de la activación; `null` mientras no lo está. */
  dentroDelPlazo: boolean | null;
  documento: DocumentoContractual | null;
  notificacion: NotificacionEmision;
}

/** Respuesta cruda del contrato (snake_case). */
export interface EmisionContractualDto {
  policy_id: string;
  status: EstadoEmision;
  activated_at: string;
  available_at: string | null;
  within_slo: boolean | null;
  document: { document_id: string; version: number; size_bytes: number; generated_at: string } | null;
  notification: { channel: string; status: EstadoNotificacion; attempts: number; sent_at: string | null };
}

export function mapearEmisionContractual(dto: EmisionContractualDto): EmisionContractual {
  return {
    polizaId: dto.policy_id,
    estado: dto.status,
    activadaEn: dto.activated_at,
    disponibleEn: dto.available_at,
    dentroDelPlazo: dto.within_slo,
    documento: dto.document
      ? {
          documentoId: dto.document.document_id,
          version: dto.document.version,
          tamanoBytes: dto.document.size_bytes,
          generadoEn: dto.document.generated_at,
        }
      : null,
    notificacion: {
      canal: dto.notification.channel,
      estado: dto.notification.status,
      intentos: dto.notification.attempts,
      enviadaEn: dto.notification.sent_at,
    },
  };
}

/** `completed` y `failed` no cambian: no hay nada más que consultar. */
export function esEmisionFinal(estado: EstadoEmision): boolean {
  return estado === 'completed' || estado === 'failed';
}

/** Códigos estables del contrato; la pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorEmision =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'policy_not_found'
  | 'document_not_available'
  | 'document_unavailable';

const CODIGOS: readonly string[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'policy_not_found',
  'document_not_available',
  'document_unavailable',
];

export class ErrorEmisionContractual extends Error {
  constructor(readonly codigo: CodigoErrorEmision) {
    super(`Error de emisión contractual: ${codigo}`);
    this.name = 'ErrorEmisionContractual';
  }
}

/** Traduce un error HTTP al código del contrato; sin cuerpo JSON se apoya en el estado. */
export function traducirErrorEmision(error: unknown): ErrorEmisionContractual {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorEmisionContractual('document_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS.includes(codigo)) {
      return new ErrorEmisionContractual(codigo as CodigoErrorEmision);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorEmisionContractual('invalid_request');
    case 401:
      return new ErrorEmisionContractual('unauthorized');
    case 403:
      return new ErrorEmisionContractual('forbidden');
    case 404:
      return new ErrorEmisionContractual('policy_not_found');
    default:
      return new ErrorEmisionContractual('document_unavailable');
  }
}
