import { HttpErrorResponse } from '@angular/common/http';

import { RamoPoliza } from './radicacion.modelos';

/**
 * Modelos del caso radicado y del listado «Mis siniestros» (HU-W2.1-01), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.3.0). Los casos radicados desde la app móvil (HU-M2.2-01) no
 * guardan la foto de la póliza: llegan con ramo, producto y objeto asegurado en `null` y los soportes en ceros.
 */

/** Hoy el único estado es `active` (la pantalla lo rotula «Radicado»). */
export type EstadoSiniestro = 'active';

export type CanalSiniestro = 'web' | 'mobile';

/** La póliza tal como estaba al radicar. */
export interface PolizaSiniestro {
  id: string;
  ramo: RamoPoliza | null;
  producto: string | null;
  objetoAsegurado: string | null;
}

export interface ArchivoAdjunto {
  soporteId: string;
  nombreArchivo: string;
  tipoContenido: string;
  tamanoBytes: number;
}

/** Soportes asociados al caso, para «3 de 3 obligatorios · 8 archivos». */
export interface ResumenSoportes {
  obligatoriosTotal: number;
  obligatoriosAdjuntos: number;
  archivos: number;
  items: { codigoRequisito: string; etiqueta: string; archivos: ArchivoAdjunto[] }[];
}

/** Fila de «Mis siniestros». */
export interface ResumenSiniestro {
  id: string;
  /** `SIN-<año>-<cinco dígitos>`. */
  numeroRadicado: string;
  estado: EstadoSiniestro;
  canal: CanalSiniestro;
  poliza: PolizaSiniestro;
  tipoSiniestro: string;
  ocurridoEn: string;
  /** Hora del servidor (RFC 3339, UTC); se muestra en la zona del usuario. */
  radicadoEn: string;
}

/** Detalle del caso: también es la respuesta de la radicación (confirmación A6b). */
export interface DetalleSiniestro extends ResumenSiniestro {
  lugar: string;
  descripcion: string;
  soportes: ResumenSoportes;
}

/** Filtros de `GET /v1/claims`. Al cambiar un filtro se empieza sin `tokenPagina`. */
export interface FiltroSiniestros {
  polizaId?: string;
  /** `YYYY-MM-DD`: radicados desde ese día a las 00:00 (hora de Colombia). */
  desde?: string;
  /** 1 a 50; 20 por defecto en el backend. */
  tamanoPagina?: number;
  tokenPagina?: string;
}

export interface PaginaSiniestros {
  items: ResumenSiniestro[];
  /** `null` en la última página. */
  siguienteToken: string | null;
}

interface PolizaSiniestroDto {
  policy_id: string;
  line: RamoPoliza | null;
  product: string | null;
  insured_object: string | null;
}

/** Fila cruda de `GET /v1/claims`. */
export interface ResumenSiniestroDto {
  claim_id: string;
  filing_number: string;
  status: EstadoSiniestro;
  channel: CanalSiniestro;
  policy: PolizaSiniestroDto;
  incident_type: string;
  occurred_at: string;
  filed_at: string;
}

/** Respuesta cruda de `GET /v1/claims/{claim_id}` y de la radicación (201/200). */
export interface DetalleSiniestroDto extends ResumenSiniestroDto {
  place: string;
  description: string;
  supports: {
    required_total: number;
    required_attached: number;
    files: number;
    items: {
      requirement_code: string;
      label: string;
      files: { support_id: string; file_name: string; content_type: string; byte_size: number }[];
    }[];
  };
}

/** Respuesta cruda de `GET /v1/claims`. */
export interface PaginaSiniestrosDto {
  items: ResumenSiniestroDto[];
  next_page_token: string | null;
}

export function mapearResumenSiniestro(dto: ResumenSiniestroDto): ResumenSiniestro {
  return {
    id: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estado: dto.status,
    canal: dto.channel,
    poliza: {
      id: dto.policy.policy_id,
      ramo: dto.policy.line,
      producto: dto.policy.product,
      objetoAsegurado: dto.policy.insured_object,
    },
    tipoSiniestro: dto.incident_type,
    ocurridoEn: dto.occurred_at,
    radicadoEn: dto.filed_at,
  };
}

export function mapearDetalleSiniestro(dto: DetalleSiniestroDto): DetalleSiniestro {
  return {
    ...mapearResumenSiniestro(dto),
    lugar: dto.place,
    descripcion: dto.description,
    soportes: {
      obligatoriosTotal: dto.supports.required_total,
      obligatoriosAdjuntos: dto.supports.required_attached,
      archivos: dto.supports.files,
      items: dto.supports.items.map((item) => ({
        codigoRequisito: item.requirement_code,
        etiqueta: item.label,
        archivos: item.files.map((archivo) => ({
          soporteId: archivo.support_id,
          nombreArchivo: archivo.file_name,
          tipoContenido: archivo.content_type,
          tamanoBytes: archivo.byte_size,
        })),
      })),
    },
  };
}

export function mapearPaginaSiniestros(dto: PaginaSiniestrosDto): PaginaSiniestros {
  return { items: dto.items.map(mapearResumenSiniestro), siguienteToken: dto.next_page_token };
}

/** Códigos estables de las lecturas (listado, detalle y PDF). */
export type CodigoErrorSiniestro = 'invalid_request' | 'claim_not_found' | 'claims_unavailable';

const CODIGOS: readonly string[] = ['invalid_request', 'claim_not_found', 'claims_unavailable'];

export class ErrorSiniestro extends Error {
  constructor(readonly codigo: CodigoErrorSiniestro) {
    super(`Error del siniestro: ${codigo}`);
    this.name = 'ErrorSiniestro';
  }
}

/**
 * Traduce un error HTTP de las lecturas al código del contrato. Sin cuerpo JSON (error de red, un 5xx del API Gateway
 * o el `Blob` de error del PDF) se decide por el estado: `400` → `invalid_request`, `404` → `claim_not_found` y lo
 * demás → `claims_unavailable`.
 */
export function traducirErrorSiniestro(error: unknown): ErrorSiniestro {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorSiniestro('claims_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS.includes(codigo)) {
      return new ErrorSiniestro(codigo as CodigoErrorSiniestro);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorSiniestro('invalid_request');
    case 404:
      return new ErrorSiniestro('claim_not_found');
    default:
      return new ErrorSiniestro('claims_unavailable');
  }
}
