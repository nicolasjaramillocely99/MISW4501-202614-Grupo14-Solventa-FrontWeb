/**
 * Modelos del perfil de riesgo del servicio de originación (HU-W1.2-02), tipados según
 * `services/origination/api/openapi.yaml` del backend (`/v1/risk-profiles/resolve`, v0.3.0).
 * El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 */

/** Fuente externa que alimenta el perfil. */
export type NombreFuente = 'open_finance' | 'open_data' | 'kyc';

/**
 * Resultado de la consulta de una fuente: `ok` respondió a tiempo; `timeout` superó su presupuesto y se
 * canceló; `error` respondió con falla; `circuit_open` estaba aislada por su *circuit breaker* y no se llamó.
 */
export type EstadoFuente = 'ok' | 'timeout' | 'error' | 'circuit_open';

/** Estado y latencia de una fuente consultada (pantalla E2). */
export interface FuentePerfil {
  nombre: NombreFuente;
  estado: EstadoFuente;
  latenciaMs: number;
}

/** `normal` perfil calculado o reutilizado; `provisional` último perfil en caché o perfil base. */
export type ModoPerfil = 'normal' | 'provisional';

/** Origen del perfil aplicado. */
export type OrigenPerfil = 'open_finance' | 'external_sources' | 'cache' | 'base_actuarial';

/** Código del mensaje que la pantalla muestra en modo provisional. */
export type AvisoPerfil = 'last_profile_in_use' | 'personalization_unavailable';

/** Perfil de riesgo resuelto para cotizar la oferta. */
export interface PerfilRiesgo {
  clienteId: string;
  modo: ModoPerfil;
  origen: OrigenPerfil;
  puntaje: number;
  categoria: string;
  /** Fecha de cálculo del perfil aplicado (ISO 8601); `null` para el perfil actuarial base. */
  fechaPerfil: string | null;
  /** Fuente externa que no pudo usarse; `null` en modo normal. */
  fuenteNoDisponible: 'open_finance' | null;
  aviso: AvisoPerfil | null;
  /** Calculado en línea sin alguna de las fuentes (superó su presupuesto, falló o estaba aislada). */
  parcial: boolean;
  fuentes: FuentePerfil[];
}

/** Cuerpo de `POST /v1/risk-profiles/resolve`. */
export interface SolicitudPerfilRiesgo {
  clienteId: string;
  consentimientoActivo: boolean;
}

/** Códigos de error del contrato (`Error.error`). */
export type CodigoErrorPerfil = 'invalid_request' | 'consent_required' | 'request_aborted';

/** Respuesta cruda del contrato (snake_case). */
export interface PerfilRiesgoDto {
  customer_id: string;
  mode: ModoPerfil;
  source: OrigenPerfil;
  profile: { score: number; category: string };
  profile_date: string | null;
  unavailable_source: 'open_finance' | null;
  notice: AvisoPerfil | null;
  partial: boolean;
  sources: { name: NombreFuente; status: EstadoFuente; latency_ms: number }[];
}

/** Traduce la respuesta del contrato al modelo del cliente. */
export function mapearPerfilRiesgo(dto: PerfilRiesgoDto): PerfilRiesgo {
  return {
    clienteId: dto.customer_id,
    modo: dto.mode,
    origen: dto.source,
    puntaje: dto.profile.score,
    categoria: dto.profile.category,
    fechaPerfil: dto.profile_date,
    fuenteNoDisponible: dto.unavailable_source,
    aviso: dto.notice,
    parcial: dto.partial,
    fuentes: dto.sources.map((fuente) => ({
      nombre: fuente.name,
      estado: fuente.status,
      latenciaMs: fuente.latency_ms,
    })),
  };
}
