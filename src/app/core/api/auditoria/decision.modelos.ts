import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos del registro de auditoría de decisiones de suscripción (HU-W4.1-01), tipados según
 * `services/audit/api/openapi.yaml` del backend y su contrato para el front (`HU-W4.1-01-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/** Resultado final de la decisión. */
export type ResultadoDecision = 'accepted' | 'rejected' | 'deferred';

export interface FuenteConsultada {
  /** Código de la fuente (`open_finance`, `open_data`, `kyc`); el portal lo traduce. */
  fuente: string;
  /** `ok`, `timeout`, `error` o `circuit_open`. */
  estado: string;
  latenciaMs: number;
}

export interface ReglaAplicada {
  /** Posición en la ejecución, desde 1. */
  orden: number;
  codigo: string;
  valor: number;
}

export interface RegistroDecision {
  ofertaId: string;
  clienteId: string;
  aliadoId: string;
  solicitudId: string;
  canal: string;
  /** Instante de la solicitud (RFC 3339, UTC). */
  solicitadaEn: string;
  versionMotor: string;
  fuentes: FuenteConsultada[];
  perfil: { puntaje: number; categoria: string; parcial: boolean };
  reglas: ReglaAplicada[];
  prima: number;
  moneda: string;
  decision: ResultadoDecision;
  /** Motivo de un rechazo o un aplazamiento; vacío si se aceptó. */
  motivo: string;
  registradaEn: string;
}

export interface RegistroDecisionDto {
  offer_id: string;
  customer_id: string;
  partner_id: string;
  application_id: string;
  channel: string;
  requested_at: string;
  rater_version: string;
  sources: { source: string; status: string; latency_ms: number }[];
  profile: { score: number; category: string; partial: boolean };
  rules: { order: number; code: string; value: number }[];
  premium: number;
  currency: string;
  decision: ResultadoDecision;
  decision_reason?: string;
  recorded_at: string;
}

export function mapearRegistroDecision(dto: RegistroDecisionDto): RegistroDecision {
  return {
    ofertaId: dto.offer_id,
    clienteId: dto.customer_id,
    aliadoId: dto.partner_id,
    solicitudId: dto.application_id,
    canal: dto.channel,
    solicitadaEn: dto.requested_at,
    versionMotor: dto.rater_version,
    fuentes: dto.sources.map((f) => ({ fuente: f.source, estado: f.status, latenciaMs: f.latency_ms })),
    perfil: { puntaje: dto.profile.score, categoria: dto.profile.category, parcial: dto.profile.partial },
    reglas: [...dto.rules].sort((a, b) => a.order - b.order).map((r) => ({ orden: r.order, codigo: r.code, valor: r.value })),
    prima: dto.premium,
    moneda: dto.currency,
    decision: dto.decision,
    motivo: dto.decision_reason ?? '',
    registradaEn: dto.recorded_at,
  };
}

/** Códigos estables del contrato para la consulta del registro. */
export type CodigoErrorDecision = 'decision_not_found' | 'unauthorized' | 'forbidden' | 'service_unavailable';

/** Error de la consulta del registro, con el código estable del contrato. */
export class ErrorDecision extends Error {
  constructor(readonly codigo: CodigoErrorDecision) {
    super(`Error del registro de auditoría: ${codigo}`);
    this.name = 'ErrorDecision';
  }
}

/** Traduce un error HTTP al código del contrato; sin respuesta del servicio (red, 5xx) es `service_unavailable`. */
export function traducirErrorDecision(error: unknown): ErrorDecision {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401:
        return new ErrorDecision('unauthorized');
      case 403:
        return new ErrorDecision('forbidden');
      case 404:
        return new ErrorDecision('decision_not_found');
    }
  }
  return new ErrorDecision('service_unavailable');
}
