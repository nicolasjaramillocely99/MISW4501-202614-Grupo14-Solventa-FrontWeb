import { HttpErrorResponse, HttpParams } from '@angular/common/http';

/**
 * Modelos de la solicitud de modificación del asegurado (HU-W1.4-01, pantallas A3, A3b y A11), tipados según
 * `services/origination/api/openapi.yaml` 0.18.0 del backend y su contrato para el front (`HU-W1.4-01-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase). HU-W1.4-02 (bandeja del analista) los reutiliza.
 */

/** Qué pide cambiar el asegurado. */
export type TipoCambio = 'beneficiaries' | 'insured_amount' | 'personal_data';

export const TIPOS_CAMBIO: readonly TipoCambio[] = ['beneficiaries', 'insured_amount', 'personal_data'];

/** Estado guardado en el servicio (cinco valores; HU-W1.4-02 escribe los que siguen a `filed`). */
export type EstadoGuardado = 'filed' | 'in_review' | 'applied' | 'rejected' | 'not_applied';

/**
 * Estado como lo ve el asegurado (ajuste A-1): una `not_applied` sin motivo sigue «En revisión»; con motivo (el analista la
 * devolvió) se ve «Rechazada». Un valor que este cliente no conoce llega como `desconocido` y se muestra neutro.
 */
export type EstadoSolicitud = 'radicada' | 'enRevision' | 'aplicada' | 'rechazada' | 'desconocido';

/** Valores del filtro «Estado» de A11, en el idioma del contrato (la proyección la hace el servicio). */
export type EstadoFiltroSolicitud = 'filed' | 'in_review' | 'applied' | 'rejected';

export const ESTADOS_FILTRO_SOLICITUD: readonly EstadoFiltroSolicitud[] = ['filed', 'in_review', 'applied', 'rejected'];

/** El estado del filtro que corresponde a cada estado visible. */
export const ESTADO_FILTRO_DE: Readonly<Record<Exclude<EstadoSolicitud, 'desconocido'>, EstadoFiltroSolicitud>> = {
  radicada: 'filed',
  enRevision: 'in_review',
  aplicada: 'applied',
  rechazada: 'rejected',
};

export type Parentesco = 'spouse_or_partner' | 'child' | 'parent' | 'sibling' | 'grandchild' | 'other';

export const PARENTESCOS: readonly Parentesco[] = ['spouse_or_partner', 'child', 'parent', 'sibling', 'grandchild', 'other'];

/** CC cédula de ciudadanía, TI tarjeta de identidad, RC registro civil, CE cédula de extranjería, PA pasaporte. */
export type TipoDocumento = 'CC' | 'TI' | 'RC' | 'CE' | 'PA';

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = ['CC', 'TI', 'RC', 'CE', 'PA'];

/** Beneficiario del remanente del valor asegurado, después del saldo del crédito. */
export interface Beneficiario {
  nombreCompleto: string;
  parentesco: string;
  tipoDocumento: string;
  numeroDocumento: string;
  /** Participación en porcentaje, con hasta dos decimales. */
  participacion: number;
}

/** El aliado que otorgó el crédito: no se modifica. `aliadoId` y `nombre` son `null` cuando no se conocen. */
export interface BeneficiarioOneroso {
  aliadoId: string | null;
  nombre: string | null;
  base: string;
}

/** Datos de contacto de la póliza; `null` es «no registrado» (en las condiciones) o «no cambia» (en lo pedido). */
export interface DatosContacto {
  direccion: string | null;
  correo: string | null;
  telefono: string | null;
}

export interface SolicitudAbierta {
  solicitudId: string;
  tipo: TipoCambio;
  estadoGuardado: string;
  radicadaEn: string;
}

/** Lo que muestra A3 al abrir (CA-1): la póliza, sus condiciones modificables, lo abierto y los límites de la captura. */
export interface CondicionesVigentes {
  poliza: {
    polizaId: string;
    linea: string;
    titular: string;
    vigenciaDesde: string;
    vigenciaHasta: string;
    vigente: boolean;
  };
  valorAsegurado: number;
  moneda: string;
  beneficiarios: Beneficiario[];
  oneroso: BeneficiarioOneroso | null;
  contacto: DatosContacto;
  abiertas: SolicitudAbierta[];
  limites: {
    valorMinimo: number;
    valorMaximo: number;
    maxBeneficiarios: number;
  };
}

/** Lo que el asegurado radica: el tipo y solo lo de ese tipo. En contacto, lo que no viaja no cambia. */
export type SolicitudNueva =
  | { tipo: 'beneficiaries'; beneficiarios: Beneficiario[] }
  | { tipo: 'insured_amount'; valorAsegurado: number }
  | { tipo: 'personal_data'; contacto: Partial<DatosContacto> };

/** Un lado del cambio, con solo lo de su tipo. */
export interface ContenidoCambio {
  beneficiarios?: Beneficiario[];
  oneroso?: BeneficiarioOneroso | null;
  valorAsegurado?: number;
  moneda?: string;
  contacto?: DatosContacto;
}

/** Una línea de la diferencia: un beneficiario, un número o un texto, `null` si no había o se retira. */
export interface CambioCampo {
  campo: string;
  anterior: Beneficiario | number | string | null;
  nuevo: Beneficiario | number | string | null;
}

export interface SolicitudModificacion {
  solicitudId: string;
  polizaId: string;
  tipo: TipoCambio;
  canal: string;
  estadoGuardado: string;
  estado: EstadoSolicitud;
  cambioEstadoEn: string;
  /** Lo que el analista le dijo al asegurado al rechazarla o devolverla. */
  motivo: string | null;
  radicadaEn: string;
  /** `nombre` es `null` si la cuenta no tiene nombre: la pantalla muestra el correo. */
  radicadaPor: { correo: string; nombre: string | null };
  anterior: ContenidoCambio;
  solicitado: ContenidoCambio;
  cambios: CambioCampo[];
}

/** Una fila de A11. */
export interface FilaSolicitud {
  solicitudId: string;
  polizaId: string;
  tipo: TipoCambio;
  canal: string;
  estadoGuardado: string;
  estado: EstadoSolicitud;
  cambioEstadoEn: string;
  motivo: string | null;
  radicadaEn: string;
}

export interface IndicadorSolicitudes {
  cantidad: number;
  ultima: { solicitudId: string; tipo: TipoCambio; radicadaEn: string; cambioEstadoEn: string } | null;
}

export interface PaginaSolicitudes {
  items: FilaSolicitud[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
  /** Sin los filtros: abiertas (con la más reciente), aplicadas en el año (con la última) y rechazadas (con la última). */
  indicadores: { abiertas: IndicadorSolicitudes; aplicadasAnio: IndicadorSolicitudes; rechazadas: IndicadorSolicitudes };
  /** Las pólizas del asegurado con solicitudes: las opciones del filtro «Póliza». */
  polizas: string[];
}

/** Filtro de A11. `desde` es un día civil de Colombia `AAAA-MM-DD`; `null` es «sin filtro». */
export interface FiltroSolicitudes {
  estado: EstadoFiltroSolicitud | null;
  polizaId: string | null;
  desde: string | null;
  /** Empieza en 1. */
  pagina: number;
  tamano: number;
}

/** Respuestas crudas del contrato (snake_case). */
export interface BeneficiarioDto {
  full_name: string;
  relationship: string;
  document_type: string;
  document_number: string;
  share_percent: number;
}

export interface OnerosoDto {
  partner_id: string | null;
  name: string | null;
  basis: string;
}

export interface DatosContactoDto {
  address: string | null;
  email: string | null;
  phone: string | null;
}

export interface CondicionesVigentesDto {
  policy: {
    policy_id: string;
    line: string;
    holder_name: string;
    coverage_start: string;
    coverage_end: string;
    in_force: boolean;
  };
  terms: {
    insured_amount: number;
    currency: string;
    beneficiaries: BeneficiarioDto[];
    onerous_beneficiary: OnerosoDto | null;
    personal_data: DatosContactoDto;
  };
  open_requests: { request_id: string; change_type: string; status: string; filed_at: string }[];
  limits: {
    insured_amount_min: number;
    insured_amount_max: number;
    max_beneficiaries: number;
    relationships: string[];
    document_types: string[];
  };
}

export interface ContenidoCambioDto {
  beneficiaries?: BeneficiarioDto[];
  onerous_beneficiary?: OnerosoDto;
  insured_amount?: number;
  currency?: string;
  personal_data?: DatosContactoDto;
}

export interface SolicitudModificacionDto {
  request_id: string;
  policy_id: string;
  change_type: string;
  channel: string;
  status: string;
  status_changed_at: string;
  decision_reason: string | null;
  filed_at: string;
  requested_by: { email: string; name: string | null };
  previous: ContenidoCambioDto;
  requested: ContenidoCambioDto;
  changes: { field: string; previous: unknown; requested: unknown }[];
}

export interface FilaSolicitudDto {
  request_id: string;
  policy_id: string;
  change_type: string;
  channel: string;
  status: string;
  status_changed_at: string;
  decision_reason: string | null;
  filed_at: string;
}

export interface IndicadorDto {
  count: number;
  latest: { request_id: string; change_type: string; filed_at: string; status_changed_at: string } | null;
}

export interface PaginaSolicitudesDto {
  items: FilaSolicitudDto[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  indicators: { open: IndicadorDto; applied_this_year: IndicadorDto; rejected: IndicadorDto };
  policies: string[];
}

/** Cuerpo de `POST /v1/policies/{policy_id}/change-requests`: el portal siempre envía `channel: web`. */
export interface SolicitudNuevaDto {
  change_type: TipoCambio;
  channel: 'web';
  beneficiaries?: BeneficiarioDto[];
  insured_amount?: number;
  personal_data?: Partial<DatosContactoDto>;
}

/** El estado que ve el asegurado (ajuste A-1). */
export function estadoParaAsegurado(estado: string, motivo: string | null): EstadoSolicitud {
  switch (estado) {
    case 'filed':
      return 'radicada';
    case 'in_review':
      return 'enRevision';
    case 'applied':
      return 'aplicada';
    case 'rejected':
      return 'rechazada';
    case 'not_applied':
      return motivo ? 'rechazada' : 'enRevision';
    default:
      return 'desconocido';
  }
}

function tipoDe(valor: string): TipoCambio {
  return (TIPOS_CAMBIO as readonly string[]).includes(valor) ? (valor as TipoCambio) : 'beneficiaries';
}

export function mapearBeneficiario(dto: BeneficiarioDto): Beneficiario {
  return {
    nombreCompleto: dto.full_name,
    parentesco: dto.relationship,
    tipoDocumento: dto.document_type,
    numeroDocumento: dto.document_number,
    participacion: dto.share_percent,
  };
}

function mapearOneroso(dto: OnerosoDto | null | undefined): BeneficiarioOneroso | null {
  return dto ? { aliadoId: dto.partner_id, nombre: dto.name, base: dto.basis } : null;
}

function mapearContacto(dto: DatosContactoDto): DatosContacto {
  return { direccion: dto.address, correo: dto.email, telefono: dto.phone };
}

export function mapearCondicionesVigentes(dto: CondicionesVigentesDto): CondicionesVigentes {
  return {
    poliza: {
      polizaId: dto.policy.policy_id,
      linea: dto.policy.line,
      titular: dto.policy.holder_name,
      vigenciaDesde: dto.policy.coverage_start,
      vigenciaHasta: dto.policy.coverage_end,
      vigente: dto.policy.in_force,
    },
    valorAsegurado: dto.terms.insured_amount,
    moneda: dto.terms.currency,
    beneficiarios: dto.terms.beneficiaries.map(mapearBeneficiario),
    oneroso: mapearOneroso(dto.terms.onerous_beneficiary),
    contacto: mapearContacto(dto.terms.personal_data),
    abiertas: dto.open_requests.map((a) => ({
      solicitudId: a.request_id,
      tipo: tipoDe(a.change_type),
      estadoGuardado: a.status,
      radicadaEn: a.filed_at,
    })),
    limites: {
      valorMinimo: dto.limits.insured_amount_min,
      valorMaximo: dto.limits.insured_amount_max,
      maxBeneficiarios: dto.limits.max_beneficiaries,
    },
  };
}

function mapearContenido(dto: ContenidoCambioDto): ContenidoCambio {
  const contenido: ContenidoCambio = {};
  if (dto.beneficiaries) {
    contenido.beneficiarios = dto.beneficiaries.map(mapearBeneficiario);
  }
  if ('onerous_beneficiary' in dto) {
    contenido.oneroso = mapearOneroso(dto.onerous_beneficiary);
  }
  if (dto.insured_amount !== undefined) {
    contenido.valorAsegurado = dto.insured_amount;
  }
  if (dto.currency !== undefined) {
    contenido.moneda = dto.currency;
  }
  if (dto.personal_data) {
    contenido.contacto = mapearContacto(dto.personal_data);
  }
  return contenido;
}

function valorDeCambio(valor: unknown): Beneficiario | number | string | null {
  if (typeof valor === 'number' || typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'object' && valor !== null && 'full_name' in valor) {
    return mapearBeneficiario(valor as BeneficiarioDto);
  }
  return null;
}

export function mapearSolicitudModificacion(dto: SolicitudModificacionDto): SolicitudModificacion {
  return {
    solicitudId: dto.request_id,
    polizaId: dto.policy_id,
    tipo: tipoDe(dto.change_type),
    canal: dto.channel,
    estadoGuardado: dto.status,
    estado: estadoParaAsegurado(dto.status, dto.decision_reason),
    cambioEstadoEn: dto.status_changed_at,
    motivo: dto.decision_reason,
    radicadaEn: dto.filed_at,
    radicadaPor: { correo: dto.requested_by.email, nombre: dto.requested_by.name },
    anterior: mapearContenido(dto.previous),
    solicitado: mapearContenido(dto.requested),
    cambios: dto.changes.map((c) => ({ campo: c.field, anterior: valorDeCambio(c.previous), nuevo: valorDeCambio(c.requested) })),
  };
}

export function mapearFilaSolicitud(dto: FilaSolicitudDto): FilaSolicitud {
  return {
    solicitudId: dto.request_id,
    polizaId: dto.policy_id,
    tipo: tipoDe(dto.change_type),
    canal: dto.channel,
    estadoGuardado: dto.status,
    estado: estadoParaAsegurado(dto.status, dto.decision_reason),
    cambioEstadoEn: dto.status_changed_at,
    motivo: dto.decision_reason,
    radicadaEn: dto.filed_at,
  };
}

function mapearIndicador(dto: IndicadorDto): IndicadorSolicitudes {
  return {
    cantidad: dto.count,
    ultima: dto.latest
      ? {
          solicitudId: dto.latest.request_id,
          tipo: tipoDe(dto.latest.change_type),
          radicadaEn: dto.latest.filed_at,
          cambioEstadoEn: dto.latest.status_changed_at,
        }
      : null,
  };
}

export function mapearPaginaSolicitudes(dto: PaginaSolicitudesDto): PaginaSolicitudes {
  return {
    items: dto.items.map(mapearFilaSolicitud),
    pagina: dto.page,
    tamano: dto.page_size,
    total: dto.total_items,
    totalPaginas: dto.total_pages,
    indicadores: {
      abiertas: mapearIndicador(dto.indicators.open),
      aplicadasAnio: mapearIndicador(dto.indicators.applied_this_year),
      rechazadas: mapearIndicador(dto.indicators.rejected),
    },
    polizas: [...dto.policies],
  };
}

function aBeneficiarioDto(b: Beneficiario): BeneficiarioDto {
  return {
    full_name: b.nombreCompleto,
    relationship: b.parentesco,
    document_type: b.tipoDocumento,
    document_number: b.numeroDocumento,
    share_percent: b.participacion,
  };
}

/** El cuerpo del `POST`: solo el miembro del tipo; en contacto, solo lo que cambia. */
export function aSolicitudNuevaDto(solicitud: SolicitudNueva): SolicitudNuevaDto {
  switch (solicitud.tipo) {
    case 'beneficiaries':
      return { change_type: 'beneficiaries', channel: 'web', beneficiaries: solicitud.beneficiarios.map(aBeneficiarioDto) };
    case 'insured_amount':
      return { change_type: 'insured_amount', channel: 'web', insured_amount: solicitud.valorAsegurado };
    case 'personal_data': {
      const contacto: Partial<DatosContactoDto> = {};
      if (solicitud.contacto.direccion) {
        contacto.address = solicitud.contacto.direccion;
      }
      if (solicitud.contacto.correo) {
        contacto.email = solicitud.contacto.correo;
      }
      if (solicitud.contacto.telefono) {
        contacto.phone = solicitud.contacto.telefono;
      }
      return { change_type: 'personal_data', channel: 'web', personal_data: contacto };
    }
  }
}

/** Parámetros de `GET /v1/policies/change-requests`: solo los que tienen valor, la página y su tamaño siempre. */
export function aParametrosSolicitudes(filtro: FiltroSolicitudes): HttpParams {
  let parametros = new HttpParams().set('page', String(filtro.pagina)).set('page_size', String(filtro.tamano));
  if (filtro.estado) {
    parametros = parametros.set('status', filtro.estado);
  }
  if (filtro.polizaId) {
    parametros = parametros.set('policy_id', filtro.polizaId);
  }
  if (filtro.desde) {
    parametros = parametros.set('filed_from', filtro.desde);
  }
  return parametros;
}

/** Códigos estables del contrato. La pantalla decide por el código, nunca por `message`. */
export type CodigoErrorSolicitud =
  | 'invalid_request'
  /** Uno o más campos inválidos (`campos` trae todos a la vez). */
  | 'validation_failed'
  | 'unauthorized'
  /** El rol no es asegurado, o la póliza o la solicitud son de otro asegurado. */
  | 'forbidden'
  | 'policy_not_found'
  | 'change_request_not_found'
  | 'policy_not_in_force'
  /** Ya hay una abierta del mismo tipo: `solicitudAbierta` la nombra. */
  | 'change_request_open'
  /** La base de originación no respondió: reintentar es seguro. */
  | 'change_request_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'invalid_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'policy_not_found',
  'change_request_not_found',
  'policy_not_in_force',
  'change_request_open',
  'change_request_unavailable',
];

/** Códigos de campo del contrato (`fields[].code`). */
export type CodigoCampoSolicitud = 'required' | 'invalid_format' | 'out_of_range' | 'share_total_not_100' | 'duplicate' | 'no_change';

const CODIGOS_CAMPO: readonly string[] = ['required', 'invalid_format', 'out_of_range', 'share_total_not_100', 'duplicate', 'no_change'];

/** Un campo inválido con su nombre del contrato (`beneficiaries[0].share_percent`, `personal_data.email`…). */
export interface ErrorDeCampoSolicitud {
  campo: string;
  codigo: CodigoCampoSolicitud;
}

/** Error de la solicitud de modificación, con el código estable del contrato. */
export class ErrorSolicitudModificacion extends Error {
  constructor(
    readonly codigo: CodigoErrorSolicitud,
    /** Solo con `validation_failed`. */
    readonly campos: ErrorDeCampoSolicitud[] = [],
    /** Solo con `change_request_open`: la solicitud abierta del mismo tipo. */
    readonly solicitudAbierta: string | null = null,
  ) {
    super(`Error de la solicitud de modificación: ${codigo}`);
    this.name = 'ErrorSolicitudModificacion';
  }
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoSolicitud[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoSolicitud[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    if (typeof field === 'string' && typeof code === 'string' && CODIGOS_CAMPO.includes(code)) {
      campos.push({ campo: field, codigo: code as CodigoCampoSolicitud });
    }
  }
  return campos;
}

/** Traduce un error HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorSolicitud(error: unknown): ErrorSolicitudModificacion {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorSolicitudModificacion('change_request_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const registro = cuerpo as Record<string, unknown>;
    const codigo = registro['error'];
    if (typeof codigo === 'string' && CODIGOS_ERROR.includes(codigo)) {
      const abierta = registro['request_id'];
      return new ErrorSolicitudModificacion(
        codigo as CodigoErrorSolicitud,
        codigo === 'validation_failed' ? extraerCampos(registro) : [],
        codigo === 'change_request_open' && typeof abierta === 'string' ? abierta : null,
      );
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorSolicitudModificacion('invalid_request');
    case 401:
      return new ErrorSolicitudModificacion('unauthorized');
    case 403:
      return new ErrorSolicitudModificacion('forbidden');
    case 404:
      return new ErrorSolicitudModificacion('policy_not_found');
    default:
      return new ErrorSolicitudModificacion('change_request_unavailable');
  }
}

/** Dónde va un campo del contrato en el formulario de A3. */
export interface UbicacionCampo {
  grupo: 'tipo' | 'beneficiarios' | 'valorAsegurado' | 'contacto';
  /** El beneficiario, solo en `beneficiarios[i].…`. */
  indice: number | null;
  /** El control; `null` es el grupo entero (p. ej. la suma de participaciones). */
  control: string | null;
}

const CONTROL_BENEFICIARIO: Readonly<Record<string, string>> = {
  full_name: 'nombreCompleto',
  relationship: 'parentesco',
  document_type: 'tipoDocumento',
  document_number: 'numeroDocumento',
  share_percent: 'participacion',
};

const CONTROL_CONTACTO: Readonly<Record<string, string>> = { address: 'direccion', email: 'correo', phone: 'telefono' };

const PATRON_BENEFICIARIO = /^beneficiaries\[(\d+)\]\.([a-z_]+)$/;

/** Ubica un campo del `422` en el formulario; `null` si este cliente no lo conoce. */
export function ubicarCampo(campo: string): UbicacionCampo | null {
  if (campo === 'change_type' || campo === 'channel') {
    return { grupo: 'tipo', indice: null, control: null };
  }
  if (campo === 'beneficiaries') {
    return { grupo: 'beneficiarios', indice: null, control: null };
  }
  const beneficiario = PATRON_BENEFICIARIO.exec(campo);
  if (beneficiario) {
    const control = CONTROL_BENEFICIARIO[beneficiario[2]];
    return control ? { grupo: 'beneficiarios', indice: Number(beneficiario[1]), control } : null;
  }
  if (campo === 'insured_amount') {
    return { grupo: 'valorAsegurado', indice: null, control: 'valorAsegurado' };
  }
  if (campo === 'personal_data') {
    return { grupo: 'contacto', indice: null, control: null };
  }
  if (campo.startsWith('personal_data.')) {
    const control = CONTROL_CONTACTO[campo.slice('personal_data.'.length)];
    return control ? { grupo: 'contacto', indice: null, control } : null;
  }
  return null;
}
