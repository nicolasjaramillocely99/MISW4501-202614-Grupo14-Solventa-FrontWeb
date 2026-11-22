import { HttpErrorResponse } from '@angular/common/http';

import { Actor, ActorDto, CampoInvalido } from './asignacion.modelos';
import { EstadoSiniestro } from './siniestro.modelos';

/**
 * Modelos del seguimiento de la intervención del prestador y del cierre del caso (HU-W2.3-02, pantalla O8), tipados
 * según `services/claims/api/openapi.yaml` del backend (v0.19.0) y `docs/contratos/HU-W2.3-02-api.md`.
 *
 * El backend decide el orden de los pasos, si el caso se puede cerrar y qué falta: el front pinta `pasoSiguiente`,
 * `cerrable` y `faltantes` tal como llegan.
 */

/** Los avances del prestador en el orden en que se registran. La asignación es el inicio; no es un paso. */
export const PASOS_INTERVENCION = [
  'accepted',
  'en_route',
  'visit_done',
  'repair_authorized',
  'repair_executed',
] as const;

export type PasoIntervencion = (typeof PASOS_INTERVENCION)[number];

export type EstadoIntervencion = 'not_assigned' | 'in_progress' | 'ready_to_close' | 'closed';

export const RESULTADOS_CIERRE = [
  'repaired',
  'partially_repaired',
  'no_repair_needed',
  'not_repairable',
] as const;

/** Cómo terminó el caso en sitio. Nunca aprueba, rechaza ni paga el siniestro (CA-5). */
export type ResultadoCierre = (typeof RESULTADOS_CIERRE)[number];

/** Lo que encontró el prestador en la visita. Las fotos se quedan con él; solo se cuenta cuántas. */
export interface InformePrestador {
  causa: string;
  dano: string;
  /** Costo estimado de la reparación, en centavos de COP. */
  costoReparacionCentavos: number;
  diasReparacion: number;
  fotos: number;
}

export interface PasoRegistrado {
  paso: PasoIntervencion;
  /** Cuándo dice el prestador que ocurrió. */
  ocurridoEn: string;
  observacion: string | null;
  /** Solo en la visita. */
  informe: InformePrestador | null;
  registradoPor: Actor;
  registradoEn: string;
}

export interface CierreCaso {
  resultado: ResultadoCierre;
  cerradoEn: string;
  observaciones: string | null;
  cerradoPor: Actor;
  registradoEn: string;
}

export interface Intervencion {
  siniestroId: string;
  numeroRadicado: string;
  estadoSiniestro: EstadoSiniestro;
  tipoSiniestro: string;
  polizaId: string;
  lugar: string;
  estado: EstadoIntervencion;
  asignacion: {
    prestador: {
      id: string;
      nombre: string;
      correo: string;
      telefono: string | null;
      distanciaKm: number;
    };
    asignadaPor: Actor;
    asignadaEn: string;
  } | null;
  /** En orden cronológico. */
  pasos: PasoRegistrado[];
  pasoSiguiente: PasoIntervencion | null;
  informe: InformePrestador | null;
  cierre: CierreCaso | null;
  cerrable: boolean;
  /** Los pasos que faltan para poder cerrar (CA-4). */
  faltantes: PasoIntervencion[];
}

/** Un avance como lo escribe el analista. `ocurridoEn` en ISO 8601. */
export interface SolicitudAvance {
  paso: PasoIntervencion;
  ocurridoEn: string;
  observacion?: string;
  /** Obligatorio en la visita; el backend lo rechaza en cualquier otro paso. */
  informe?: InformePrestador;
}

export interface SolicitudCierreCaso {
  resultado: ResultadoCierre;
  cerradoEn: string;
  observaciones?: string;
}

// --- DTO (snake_case, como el contrato) ---------------------------------------------------------------------------

export interface InformePrestadorDto {
  cause: string;
  damage: string;
  repair_cost_minor: number;
  repair_days: number;
  photos: number;
}

export interface PasoRegistradoDto {
  step: PasoIntervencion;
  occurred_at: string;
  note: string | null;
  report: InformePrestadorDto | null;
  recorded_by: ActorDto;
  recorded_at: string;
}

export interface IntervencionDto {
  claim_id: string;
  filing_number: string;
  claim_status: EstadoSiniestro;
  incident_type: string;
  policy_id: string;
  place: string;
  state: EstadoIntervencion;
  assignment: {
    provider: {
      id: string;
      name: string;
      contact_email: string;
      contact_phone: string | null;
      distance_km: number;
    };
    assigned_by: ActorDto;
    assigned_at: string;
  } | null;
  steps: PasoRegistradoDto[];
  next_step: PasoIntervencion | null;
  report: InformePrestadorDto | null;
  closure: {
    result: ResultadoCierre;
    closed_at: string;
    notes: string | null;
    closed_by: ActorDto;
    recorded_at: string;
  } | null;
  closable: boolean;
  missing: PasoIntervencion[];
}

const actor = (dto: ActorDto): Actor => ({ correo: dto.email, nombre: dto.name });

function mapearInforme(dto: InformePrestadorDto | null): InformePrestador | null {
  if (!dto) {
    return null;
  }
  return {
    causa: dto.cause,
    dano: dto.damage,
    costoReparacionCentavos: dto.repair_cost_minor,
    diasReparacion: dto.repair_days,
    fotos: dto.photos,
  };
}

export function mapearIntervencion(dto: IntervencionDto): Intervencion {
  const a = dto.assignment;
  return {
    siniestroId: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estadoSiniestro: dto.claim_status,
    tipoSiniestro: dto.incident_type,
    polizaId: dto.policy_id,
    lugar: dto.place,
    estado: dto.state,
    asignacion: a
      ? {
          prestador: {
            id: a.provider.id,
            nombre: a.provider.name,
            correo: a.provider.contact_email,
            telefono: a.provider.contact_phone,
            distanciaKm: a.provider.distance_km,
          },
          asignadaPor: actor(a.assigned_by),
          asignadaEn: a.assigned_at,
        }
      : null,
    pasos: dto.steps.map((p) => ({
      paso: p.step,
      ocurridoEn: p.occurred_at,
      observacion: p.note,
      informe: mapearInforme(p.report),
      registradoPor: actor(p.recorded_by),
      registradoEn: p.recorded_at,
    })),
    pasoSiguiente: dto.next_step,
    informe: mapearInforme(dto.report),
    cierre: dto.closure
      ? {
          resultado: dto.closure.result,
          cerradoEn: dto.closure.closed_at,
          observaciones: dto.closure.notes,
          cerradoPor: actor(dto.closure.closed_by),
          registradoEn: dto.closure.recorded_at,
        }
      : null,
    cerrable: dto.closable,
    faltantes: dto.missing,
  };
}

export function aAvanceDto(solicitud: SolicitudAvance): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {
    step: solicitud.paso,
    occurred_at: solicitud.ocurridoEn,
  };
  const observacion = solicitud.observacion?.trim();
  if (observacion) {
    cuerpo['note'] = observacion;
  }
  if (solicitud.informe) {
    const i = solicitud.informe;
    cuerpo['report'] = {
      cause: i.causa,
      damage: i.dano,
      repair_cost_minor: i.costoReparacionCentavos,
      repair_days: i.diasReparacion,
      photos: i.fotos,
    };
  }
  return cuerpo;
}

export function aCierreCasoDto(solicitud: SolicitudCierreCaso): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {
    result: solicitud.resultado,
    closed_at: solicitud.cerradoEn,
  };
  const observaciones = solicitud.observaciones?.trim();
  if (observaciones) {
    cuerpo['notes'] = observaciones;
  }
  return cuerpo;
}

// --- Errores -------------------------------------------------------------------------------------------------------

/** Códigos estables del seguimiento y del cierre (contrato, §2.3 y §2.4). */
export type CodigoErrorIntervencion =
  | 'invalid_request'
  | 'claim_not_found'
  | 'not_assigned'
  | 'step_out_of_order'
  | 'case_closed'
  | 'intervention_not_finished'
  | 'validation_failed'
  | 'claims_unavailable';

const CODIGOS_INTERVENCION: readonly string[] = [
  'invalid_request',
  'claim_not_found',
  'not_assigned',
  'step_out_of_order',
  'case_closed',
  'intervention_not_finished',
  'validation_failed',
  'claims_unavailable',
];

export class ErrorIntervencion extends Error {
  constructor(
    readonly codigo: CodigoErrorIntervencion,
    readonly campos: readonly CampoInvalido[] = [],
    /** Con `intervention_not_finished`: los pasos que faltan para cerrar. */
    readonly faltantes: readonly PasoIntervencion[] = [],
  ) {
    super(`Error de la intervención: ${codigo}`);
    this.name = 'ErrorIntervencion';
  }
}

/**
 * Traduce un error HTTP al código del contrato, con los campos de `validation_failed` y los pasos que faltan de
 * `intervention_not_finished`. Sin cuerpo reconocible: `400` → `invalid_request`, `404` → `claim_not_found` y lo demás →
 * `claims_unavailable`. El `401` y el `403` los resuelve el interceptor.
 */
export function traducirErrorIntervencion(error: unknown): ErrorIntervencion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorIntervencion('claims_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const registro = cuerpo as Record<string, unknown>;
    const codigo = registro['error'];
    if (typeof codigo === 'string' && CODIGOS_INTERVENCION.includes(codigo)) {
      return new ErrorIntervencion(
        codigo as CodigoErrorIntervencion,
        leerCampos(registro['fields']),
        leerFaltantes(registro['missing']),
      );
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorIntervencion('invalid_request');
    case 404:
      return new ErrorIntervencion('claim_not_found');
    default:
      return new ErrorIntervencion('claims_unavailable');
  }
}

function leerCampos(campos: unknown): CampoInvalido[] {
  if (!Array.isArray(campos)) {
    return [];
  }
  return campos
    .filter(
      (c): c is { field: string; code: string } =>
        typeof c === 'object' &&
        c !== null &&
        typeof c.field === 'string' &&
        typeof c.code === 'string',
    )
    .map((c) => ({ campo: c.field, codigo: c.code }));
}

function leerFaltantes(faltantes: unknown): PasoIntervencion[] {
  if (!Array.isArray(faltantes)) {
    return [];
  }
  return faltantes.filter((p): p is PasoIntervencion =>
    PASOS_INTERVENCION.includes(p as PasoIntervencion),
  );
}
