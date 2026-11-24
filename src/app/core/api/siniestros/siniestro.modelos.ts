import { HttpErrorResponse } from '@angular/common/http';

import { RamoPoliza } from './radicacion.modelos';

/**
 * Modelos del caso radicado y del listado «Mis siniestros» (HU-W2.1-01), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.3.0). Los casos radicados desde la app móvil (HU-M2.2-01) no
 * guardan la foto de la póliza: llegan con ramo, producto y objeto asegurado en `null` y los soportes en ceros.
 */

/**
 * Estado del caso: `active` al radicar («Radicado», pendiente de la revisión del asesor), `returned` («Devuelto al
 * cliente», HU-W2.1-03), `in_evaluation` (aprobado por el asesor) y los de la decisión de operaciones (HU-W2.2-03):
 * `approved` (pago en curso), `paid`, `rejected` y `payment_exception`.
 */
export type EstadoSiniestro =
  'active' | 'returned' | 'in_evaluation' | 'approved' | 'paid' | 'rejected' | 'payment_exception';

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
  /** Cuándo llegó a su estado actual (HU-W2.1-02); la radicación si el backend no lo trae. */
  ultimoCambioEn: string;
}

/** Detalle del caso: también es la respuesta de la radicación (confirmación A6b). */
export interface DetalleSiniestro extends ResumenSiniestro {
  lugar: string;
  descripcion: string;
  /** Centavos de COP que declaró el asegurado; `null` si no lo declaró (HU-W2.2-01). */
  montoEstimadoMinor: number | null;
  soportes: ResumenSoportes;
}

/** Filtros de `GET /v1/claims`. Al cambiar un filtro se empieza sin `tokenPagina`. */
export interface FiltroSiniestros {
  polizaId?: string;
  /** La etapa del caso (HU-W2.1-02). */
  estado?: EstadoSiniestro;
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
  /** Conteo de todos los casos del asegurado, sin importar los filtros (HU-W2.1-02, A7); `null` si no llega. */
  resumen?: ResumenCasos | null;
}

/** Los indicadores de A7: en curso, pagados en el año y lo que espera al asegurado. */
export interface ResumenCasos {
  enCurso: number;
  porEstado: Partial<Record<EstadoSiniestro, number>>;
  pagadosAnio: { casos: number; montoMinor: number; moneda: string | null };
  /** Los devueltos para corregir, del más reciente al más antiguo. */
  pendientes: { id: string; numeroRadicado: string }[];
  /** Las pólizas de los siniestros del asegurado: las que ofrece el filtro de A7, también las vencidas. */
  polizas: PolizaSiniestro[];
}

/** Enlace firmado para leer un soporte (HU-W2.1-02); vence a los 10 minutos. */
export interface EnlaceSoporte {
  soporteId: string;
  nombreArchivo: string;
  tipoContenido: string;
  tamanoBytes: number;
  url: string;
  venceEn: string;
}

export interface EnlaceSoporteDto {
  support_id: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  download_url: string;
  expires_at: string;
}

export function mapearEnlaceSoporte(dto: EnlaceSoporteDto): EnlaceSoporte {
  return {
    soporteId: dto.support_id,
    nombreArchivo: dto.file_name,
    tipoContenido: dto.content_type,
    tamanoBytes: dto.byte_size,
    url: dto.download_url,
    venceEn: dto.expires_at,
  };
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
  /** Ausente donde el backend no lo lee. */
  last_changed_at?: string;
}

/** Respuesta cruda de `GET /v1/claims/{claim_id}` y de la radicación (201/200). */
export interface DetalleSiniestroDto extends ResumenSiniestroDto {
  place: string;
  description: string;
  /** Ausente (no `null`) si no se declaró, también en los casos radicados desde el móvil. */
  estimated_amount_minor?: number | null;
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
  summary?: {
    in_progress: number;
    by_status: Partial<Record<EstadoSiniestro, number>>;
    paid_this_year: { claims: number; amount_minor: number; currency: string | null };
    pending_action: { claim_id: string; filing_number: string }[];
    policies?: PolizaSiniestroDto[];
  };
}

function mapearPolizaSiniestro(dto: PolizaSiniestroDto): PolizaSiniestro {
  return {
    id: dto.policy_id,
    ramo: dto.line,
    producto: dto.product,
    objetoAsegurado: dto.insured_object,
  };
}

export function mapearResumenSiniestro(dto: ResumenSiniestroDto): ResumenSiniestro {
  return {
    id: dto.claim_id,
    numeroRadicado: dto.filing_number,
    estado: dto.status,
    canal: dto.channel,
    poliza: mapearPolizaSiniestro(dto.policy),
    tipoSiniestro: dto.incident_type,
    ocurridoEn: dto.occurred_at,
    radicadoEn: dto.filed_at,
    ultimoCambioEn: dto.last_changed_at ?? dto.filed_at,
  };
}

export function mapearDetalleSiniestro(dto: DetalleSiniestroDto): DetalleSiniestro {
  return {
    ...mapearResumenSiniestro(dto),
    lugar: dto.place,
    descripcion: dto.description,
    montoEstimadoMinor: dto.estimated_amount_minor ?? null,
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
  const s = dto.summary;
  return {
    items: dto.items.map(mapearResumenSiniestro),
    siguienteToken: dto.next_page_token,
    resumen: s
      ? {
          enCurso: s.in_progress,
          porEstado: { ...s.by_status },
          pagadosAnio: {
            casos: s.paid_this_year.claims,
            montoMinor: s.paid_this_year.amount_minor,
            moneda: s.paid_this_year.currency,
          },
          pendientes: s.pending_action.map((p) => ({ id: p.claim_id, numeroRadicado: p.filing_number })),
          polizas: (s.policies ?? []).map(mapearPolizaSiniestro),
        }
      : null,
  };
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
