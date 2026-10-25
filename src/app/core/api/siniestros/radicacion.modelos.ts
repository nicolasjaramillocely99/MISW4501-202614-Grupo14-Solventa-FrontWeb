import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la radicación web del siniestro con soportes (HU-W2.1-01), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.3.0) y su contrato para el front
 * (`docs/contratos/HU-W2.1-01-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos tipos
 * (camelCase). El catálogo de tipos y soportes **no** se fija aquí: llega en `GET /v1/claims/filing-options`.
 */

/** Ramo de la póliza que se radica (Viaje es paramétrico y no aparece). */
export type RamoPoliza = 'auto' | 'home';

/** Formato que admite un soporte; se decide por el contenido del archivo, no por su extensión. */
export type FormatoArchivo = 'jpeg' | 'png' | 'pdf';

/** Soporte que pide un tipo de siniestro (catálogo `claim-catalog-v1`). */
export interface RequisitoSoporte {
  /** Código estable, p. ej. `vehicle_photos`; la pantalla lo traduce y cae a `etiqueta` si no lo conoce. */
  codigo: string;
  /** Texto en español del backend: respaldo cuando el front no conoce el código. */
  etiqueta: string;
  obligatorio: boolean;
  /** 0 cuando el soporte es opcional. */
  minArchivos: number;
  maxArchivos: number;
  formatos: FormatoArchivo[];
}

/** Tipo de siniestro que cubre una póliza, con sus soportes. */
export interface TipoSiniestro {
  codigo: string;
  etiqueta: string;
  requisitos: RequisitoSoporte[];
}

/** Póliza activa del asegurado sobre la que puede radicar (CA-1). */
export interface PolizaRadicable {
  id: string;
  ramo: RamoPoliza;
  /** Nombre del producto en el core de pólizas, p. ej. `Autos`. */
  producto: string;
  /** Lo que asegura: una placa, una dirección. */
  objetoAsegurado: string;
  vigenteDesde: string;
  /** Primer instante **sin** cobertura: la vigencia es `vigenteDesde ≤ hecho < vigenteHasta`. */
  vigenteHasta: string;
  tiposSiniestro: TipoSiniestro[];
}

/** Opciones del formulario «Radicar un siniestro». */
export interface OpcionesRadicacion {
  versionCatalogo: string;
  /** Vacío: el asegurado no tiene pólizas activas que se radiquen (estado vacío, no un error). */
  polizas: PolizaRadicable[];
}

/** Soporte ya subido, todavía sin asociar a un caso. */
export interface SoporteSubido {
  id: string;
  nombreArchivo: string;
  tipoContenido: string;
  tamanoBytes: number;
  sha256: string;
  subidoEn: string;
}

/** Soportes subidos que responden a un requisito del catálogo. */
export interface GrupoSoportes {
  codigoRequisito: string;
  soporteIds: string[];
}

/** Datos con los que se radica (`POST /v1/claims/web-filings`). */
export interface SolicitudRadicacion {
  polizaId: string;
  tipoSiniestro: string;
  /** RFC 3339 (UTC). */
  ocurridoEn: string;
  lugar: string;
  descripcion: string;
  soportes: GrupoSoportes[];
}

interface RequisitoDto {
  code: string;
  label: string;
  required: boolean;
  min_files: number;
  max_files: number;
  formats: FormatoArchivo[];
}

interface TipoSiniestroDto {
  code: string;
  label: string;
  requirements: RequisitoDto[];
}

interface PolizaRadicableDto {
  policy_id: string;
  line: RamoPoliza;
  product: string;
  insured_object: string;
  valid_from: string;
  valid_to: string;
  incident_types: TipoSiniestroDto[];
}

/** Respuesta cruda de `GET /v1/claims/filing-options`. */
export interface OpcionesRadicacionDto {
  catalog_version: string;
  policies: PolizaRadicableDto[];
}

/** Respuesta cruda de `POST /v1/claims/supports` (201). */
export interface SoporteSubidoDto {
  support_id: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  sha256: string;
  uploaded_at: string;
}

function mapearRequisito(dto: RequisitoDto): RequisitoSoporte {
  return {
    codigo: dto.code,
    etiqueta: dto.label,
    obligatorio: dto.required,
    minArchivos: dto.min_files,
    maxArchivos: dto.max_files,
    formatos: dto.formats,
  };
}

function mapearPoliza(dto: PolizaRadicableDto): PolizaRadicable {
  return {
    id: dto.policy_id,
    ramo: dto.line,
    producto: dto.product,
    objetoAsegurado: dto.insured_object,
    vigenteDesde: dto.valid_from,
    vigenteHasta: dto.valid_to,
    tiposSiniestro: dto.incident_types.map((tipo) => ({
      codigo: tipo.code,
      etiqueta: tipo.label,
      requisitos: tipo.requirements.map(mapearRequisito),
    })),
  };
}

export function mapearOpcionesRadicacion(dto: OpcionesRadicacionDto): OpcionesRadicacion {
  return { versionCatalogo: dto.catalog_version, polizas: dto.policies.map(mapearPoliza) };
}

export function mapearSoporteSubido(dto: SoporteSubidoDto): SoporteSubido {
  return {
    id: dto.support_id,
    nombreArchivo: dto.file_name,
    tipoContenido: dto.content_type,
    tamanoBytes: dto.byte_size,
    sha256: dto.sha256,
    subidoEn: dto.uploaded_at,
  };
}

/** Cuerpo de `POST /v1/claims/web-filings`. Los grupos sin archivos no se envían. */
export function aSolicitudRadicacionDto(solicitud: SolicitudRadicacion): Record<string, unknown> {
  return {
    policy_id: solicitud.polizaId,
    incident_type: solicitud.tipoSiniestro,
    occurred_at: solicitud.ocurridoEn,
    place: solicitud.lugar,
    description: solicitud.descripcion,
    supports: solicitud.soportes
      .filter((grupo) => grupo.soporteIds.length > 0)
      .map((grupo) => ({ requirement_code: grupo.codigoRequisito, support_ids: grupo.soporteIds })),
  };
}

/** Códigos estables de la radicación y de sus opciones. La pantalla decide el texto por el código, nunca por `message`. */
export type CodigoErrorRadicacion =
  | 'invalid_request'
  | 'validation_failed'
  | 'policy_not_eligible'
  | 'idempotency_key_reused'
  | 'policy_directory_unavailable'
  | 'filing_unavailable';

const CODIGOS_RADICACION: readonly string[] = [
  'invalid_request',
  'validation_failed',
  'policy_not_eligible',
  'idempotency_key_reused',
  'policy_directory_unavailable',
  'filing_unavailable',
];

/** Campo del formulario al que apunta un error de validación del backend. */
export type CampoRadicacion = 'polizaId' | 'tipoSiniestro' | 'ocurridoEn' | 'lugar' | 'descripcion' | 'soportes';

export type CodigoCampoRadicacion =
  | 'required'
  | 'invalid_format'
  | 'out_of_range'
  | 'missing'
  | 'too_few'
  | 'too_many'
  | 'not_applicable'
  | 'not_found';

const CODIGOS_CAMPO: readonly string[] = [
  'required',
  'invalid_format',
  'out_of_range',
  'missing',
  'too_few',
  'too_many',
  'not_applicable',
  'not_found',
];

/** Campo del contrato (snake_case) → campo del modelo. `supports.<código>` se resuelve aparte. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoRadicacion>> = {
  policy_id: 'polizaId',
  incident_type: 'tipoSiniestro',
  occurred_at: 'ocurridoEn',
  place: 'lugar',
  description: 'descripcion',
  supports: 'soportes',
};

/** Un campo inválido según el backend. */
export interface ErrorDeCampoRadicacion {
  campo: CampoRadicacion;
  codigo: CodigoCampoRadicacion;
  /** Solo en `supports.<código>`: el requisito del catálogo al que apunta. Sin él, el error es de la lista completa. */
  requisito?: string;
}

/** Por qué la póliza no admite la radicación (`422 policy_not_eligible`, CA-3). */
export type MotivoPolizaNoElegible =
  | 'policy_not_found'
  | 'policy_not_active'
  | 'incident_not_covered'
  | 'occurred_outside_validity';

const MOTIVOS: readonly string[] = [
  'policy_not_found',
  'policy_not_active',
  'incident_not_covered',
  'occurred_outside_validity',
];

/** Error de las opciones o de la radicación, con el código estable del contrato. */
export class ErrorRadicacion extends Error {
  constructor(
    readonly codigo: CodigoErrorRadicacion,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampoRadicacion[] = [],
    /** Solo con `policy_not_eligible`. */
    readonly motivo: MotivoPolizaNoElegible | null = null,
    /** Solo con `policy_not_eligible`: la vigencia de la póliza (`null` si no es del asegurado). */
    readonly vigenteDesde: string | null = null,
    readonly vigenteHasta: string | null = null,
  ) {
    super(`Error de radicación: ${codigo}`);
    this.name = 'ErrorRadicacion';
  }
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoRadicacion[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoRadicacion[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    if (typeof field !== 'string' || typeof code !== 'string' || !CODIGOS_CAMPO.includes(code)) {
      continue;
    }
    const codigo = code as CodigoCampoRadicacion;
    if (field.startsWith('supports.')) {
      campos.push({ campo: 'soportes', codigo, requisito: field.slice('supports.'.length) });
    } else if (CAMPO_DEL_CONTRATO[field]) {
      campos.push({ campo: CAMPO_DEL_CONTRATO[field], codigo });
    }
  }
  return campos;
}

function textoONulo(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null;
}

/**
 * Traduce un error HTTP de la radicación al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API
 * Gateway) se trata como `filing_unavailable`: no se sabe si se creó el caso, así que se reintenta con la **misma**
 * `Idempotency-Key`.
 */
export function traducirErrorRadicacion(error: unknown): ErrorRadicacion {
  return traducir(error, 'filing_unavailable');
}

/** Igual que `traducirErrorRadicacion`, pero sin cuerpo JSON las opciones se tratan como `policy_directory_unavailable`. */
export function traducirErrorOpciones(error: unknown): ErrorRadicacion {
  return traducir(error, 'policy_directory_unavailable');
}

function traducir(error: unknown, indisponible: CodigoErrorRadicacion): ErrorRadicacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorRadicacion(indisponible);
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const campos = cuerpo as Record<string, unknown>;
    const codigo = campos['error'];
    if (typeof codigo === 'string' && CODIGOS_RADICACION.includes(codigo)) {
      if (codigo === 'validation_failed') {
        return new ErrorRadicacion(codigo, extraerCampos(campos));
      }
      if (codigo === 'policy_not_eligible') {
        const motivo = campos['reason'];
        return new ErrorRadicacion(
          codigo,
          [],
          typeof motivo === 'string' && MOTIVOS.includes(motivo) ? (motivo as MotivoPolizaNoElegible) : null,
          textoONulo(campos['valid_from']),
          textoONulo(campos['valid_to']),
        );
      }
      return new ErrorRadicacion(codigo as CodigoErrorRadicacion);
    }
  }
  return new ErrorRadicacion(error.status === 400 ? 'invalid_request' : indisponible);
}

/** Códigos estables de la subida de un soporte. Un rechazo afecta **solo** a ese archivo (CA-5). */
export type CodigoErrorSoporte =
  | 'invalid_request'
  | 'file_too_large'
  | 'unsupported_file_type'
  | 'empty_file'
  | 'too_many_pending_supports'
  | 'supports_unavailable';

const CODIGOS_SOPORTE: readonly string[] = [
  'invalid_request',
  'file_too_large',
  'unsupported_file_type',
  'empty_file',
  'too_many_pending_supports',
  'supports_unavailable',
];

/** Estado HTTP → código, para las respuestas sin cuerpo JSON (p. ej. el `413` del propio API Gateway). */
const CODIGO_SOPORTE_POR_ESTADO: Readonly<Record<number, CodigoErrorSoporte>> = {
  400: 'invalid_request',
  413: 'file_too_large',
  415: 'unsupported_file_type',
  422: 'empty_file',
  429: 'too_many_pending_supports',
};

/** Error de `POST /v1/claims/supports`, con el código estable del contrato. */
export class ErrorSoporte extends Error {
  constructor(readonly codigo: CodigoErrorSoporte) {
    super(`Error del soporte: ${codigo}`);
    this.name = 'ErrorSoporte';
  }
}

export function traducirErrorSoporte(error: unknown): ErrorSoporte {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorSoporte('supports_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_SOPORTE.includes(codigo)) {
      return new ErrorSoporte(codigo as CodigoErrorSoporte);
    }
  }
  return new ErrorSoporte(CODIGO_SOPORTE_POR_ESTADO[error.status] ?? 'supports_unavailable');
}
