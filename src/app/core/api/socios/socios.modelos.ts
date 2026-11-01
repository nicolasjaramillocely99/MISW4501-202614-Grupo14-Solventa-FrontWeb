import { HttpErrorResponse } from '@angular/common/http';

/**
 * Modelos de la gestión de socios comerciales y sus credenciales (HU-W3.1-01), tipados según el contrato del backend
 * `docs/contratos/HU-W3.1-01-api.md` (servicio `partners`). El cliente traduce el JSON del contrato (snake_case) a estos
 * tipos (camelCase). El secreto de una credencial solo existe en `SecretoEmitido`, que devuelven la aprobación y la
 * rotación (CA-4): ningún otro modelo lo trae.
 */

export type TipoSocio = 'bank' | 'airline' | 'ecommerce' | 'fintech' | 'cooperative' | 'retail' | 'other';

export const TIPOS_SOCIO: readonly TipoSocio[] = ['bank', 'airline', 'ecommerce', 'fintech', 'cooperative', 'retail', 'other'];

/** `offboarded` queda reservado para la baja (HU-W3.1-02). */
export type EstadoSocio = 'pending_approval' | 'active' | 'offboarded';

export type EstadoCredenciales = 'none' | 'active' | 'rotation_in_progress' | 'disabled';

export type EstadoConsumo = 'normal' | 'near_limit' | 'exceeded' | 'unknown' | 'none';

export interface CuotaSocio {
  /** Hoy siempre `day`: los usage plans de API Gateway llevan la cuota por día (decisión del equipo). */
  periodo: string;
  limiteDiario: number;
  /** Solicitudes por segundo. */
  limiteRafaga: number;
  rafagaMaxima: number;
}

/** Consumo de hoy (día UTC del gateway). */
export interface ConsumoSocio {
  fecha: string;
  usadas: number;
  restantes: number;
  /** Con un decimal. */
  porcentaje: number;
}

/** Quién hizo algo: un analista (`operations`, con su `sub` y su correo o usuario) o el proceso (`system`). */
export interface ActorSocio {
  tipo: string;
  id: string;
  etiqueta: string;
}

/** Una fila del listado. */
export interface ResumenSocio {
  socioId: string;
  codigo: string;
  nombre: string;
  tipo: TipoSocio;
  estado: EstadoSocio;
  estadoCredenciales: EstadoCredenciales;
  estadoConsumo: EstadoConsumo;
  registradoEn: string;
  aprobadoEn: string | null;
  cuota: CuotaSocio;
  /** `null` sin credenciales o si el gateway no respondió («Sin dato»). */
  consumo: ConsumoSocio | null;
}

export interface CredencialActiva {
  credencialId: string;
  clientId: string;
  /** Últimos 4 caracteres del secreto: lo único que el servicio conserva de él. */
  pistaSecreto: string;
  emitidaEn: string;
  emitidaPor: ActorSocio;
}

/** La credencial anterior durante el periodo de transición de una rotación (CA-5). */
export interface CredencialAnterior {
  credencialId: string;
  clientId: string;
  pistaSecreto: string;
  emitidaEn: string;
  venceEn: string;
}

export interface CredencialesSocio {
  autenticacion: string;
  cabecera: string;
  horasTransicionPorDefecto: number;
  activa: CredencialActiva | null;
  anterior: CredencialAnterior | null;
  primeraEmisionEn: string | null;
  primeraEmisionPor: ActorSocio | null;
  ultimaRotacionEn: string | null;
  ultimaRotacionPor: ActorSocio | null;
}

export type TipoEventoSocio = 'registered' | 'credentials_issued' | 'credentials_rotated' | 'credentials_revoked';

export interface EventoSocio {
  eventoId: string;
  tipo: TipoEventoSocio;
  ocurridoEn: string;
  actor: ActorSocio;
  /** `in_progress` para una rotación cuya transición no ha terminado. */
  estado: 'applied' | 'in_progress';
  detalles: Readonly<Record<string, unknown>>;
}

export interface DetalleSocio extends ResumenSocio {
  productos: string[];
  correoContactoTecnico: string;
  entorno: string;
  registradoPor: ActorSocio | null;
  /** `null` mientras el socio está pendiente de aprobación. */
  credenciales: CredencialesSocio | null;
  /** Del más reciente al más antiguo. */
  historial: EventoSocio[];
}

export interface IndicadoresSocios {
  sociosActivos: number;
  /** `null` si ningún socio activo tiene dato del gateway. */
  cuotaMediaUsada: number | null;
  cercaDelLimite: number;
  nombresCercaDelLimite: string[];
}

export interface ListadoSocios {
  items: ResumenSocio[];
  indicadores: IndicadoresSocios;
}

/** Secreto recién emitido: se muestra una sola vez y nunca se vuelve a poder leer (CA-4). */
export interface SecretoEmitido {
  clientId: string;
  clientSecret: string;
  cabecera: string;
}

/** Respuesta `201` de la aprobación y de la rotación. */
export interface CredencialesEmitidas {
  socio: DetalleSocio;
  secreto: SecretoEmitido;
}

/** Cuerpo de `POST /v1/partners`. */
export interface SolicitudRegistroSocio {
  nombre: string;
  codigo: string;
  tipo: TipoSocio;
  productos: string[];
  correoContactoTecnico: string;
  cuota: { limiteDiario: number; limiteRafaga: number; rafagaMaxima: number };
}

// --- DTO del contrato ---------------------------------------------------------------------------------------------

interface CuotaDto {
  period: string;
  daily_limit: number;
  rate_limit: number;
  burst_limit: number;
}

interface ActorDto {
  type: string;
  id: string;
  label: string;
}

export interface ResumenSocioDto {
  partner_id: string;
  code: string;
  name: string;
  type: TipoSocio;
  status: EstadoSocio;
  credentials_status: EstadoCredenciales;
  usage_status: EstadoConsumo;
  registered_at: string;
  approved_at: string | null;
  quota: CuotaDto;
  usage: { date: string; used: number; remaining: number; percent: number } | null;
}

export interface DetalleSocioDto extends ResumenSocioDto {
  products: string[];
  technical_contact_email: string;
  environment: string;
  registered_by?: ActorDto | null;
  credentials: {
    authentication: string;
    header: string;
    default_grace_period_hours: number;
    active: { credential_id: string; client_id: string; secret_hint: string; issued_at: string; issued_by: ActorDto } | null;
    previous: { credential_id: string; client_id: string; secret_hint: string; issued_at: string; expires_at: string } | null;
    first_issued_at: string | null;
    first_issued_by: ActorDto | null;
    last_rotated_at: string | null;
    last_rotated_by: ActorDto | null;
  } | null;
  history: {
    event_id: string;
    type: TipoEventoSocio;
    occurred_at: string;
    actor: ActorDto;
    status: 'applied' | 'in_progress';
    details?: Record<string, unknown> | null;
  }[];
}

export interface ListadoSociosDto {
  items: ResumenSocioDto[];
  indicators: {
    active_partners: number;
    average_quota_used_percent: number | null;
    near_limit_partners: number;
    near_limit_names: string[];
  };
}

export interface CredencialesEmitidasDto {
  partner: DetalleSocioDto;
  secret: { client_id: string; client_secret: string; header: string };
}

// --- Traducción -----------------------------------------------------------------------------------------------------

function mapearActor(dto: ActorDto | null | undefined): ActorSocio | null {
  return dto ? { tipo: dto.type, id: dto.id, etiqueta: dto.label } : null;
}

/** Actor que el contrato siempre trae; si faltara, se muestra como el proceso. */
function mapearActorObligatorio(dto: ActorDto | null | undefined): ActorSocio {
  return mapearActor(dto) ?? { tipo: 'system', id: 'partners', etiqueta: '' };
}

function mapearResumen(dto: ResumenSocioDto): ResumenSocio {
  return {
    socioId: dto.partner_id,
    codigo: dto.code,
    nombre: dto.name,
    tipo: dto.type,
    estado: dto.status,
    estadoCredenciales: dto.credentials_status,
    estadoConsumo: dto.usage_status,
    registradoEn: dto.registered_at,
    aprobadoEn: dto.approved_at ?? null,
    cuota: {
      periodo: dto.quota.period,
      limiteDiario: dto.quota.daily_limit,
      limiteRafaga: dto.quota.rate_limit,
      rafagaMaxima: dto.quota.burst_limit,
    },
    consumo: dto.usage
      ? { fecha: dto.usage.date, usadas: dto.usage.used, restantes: dto.usage.remaining, porcentaje: dto.usage.percent }
      : null,
  };
}

export function mapearListadoSocios(dto: ListadoSociosDto): ListadoSocios {
  return {
    items: dto.items.map(mapearResumen),
    indicadores: {
      sociosActivos: dto.indicators.active_partners,
      cuotaMediaUsada: dto.indicators.average_quota_used_percent ?? null,
      cercaDelLimite: dto.indicators.near_limit_partners,
      nombresCercaDelLimite: dto.indicators.near_limit_names ?? [],
    },
  };
}

export function mapearDetalleSocio(dto: DetalleSocioDto): DetalleSocio {
  const c = dto.credentials;
  return {
    ...mapearResumen(dto),
    productos: dto.products ?? [],
    correoContactoTecnico: dto.technical_contact_email,
    entorno: dto.environment,
    registradoPor: mapearActor(dto.registered_by),
    credenciales: c
      ? {
          autenticacion: c.authentication,
          cabecera: c.header,
          horasTransicionPorDefecto: c.default_grace_period_hours,
          activa: c.active
            ? {
                credencialId: c.active.credential_id,
                clientId: c.active.client_id,
                pistaSecreto: c.active.secret_hint,
                emitidaEn: c.active.issued_at,
                emitidaPor: mapearActorObligatorio(c.active.issued_by),
              }
            : null,
          anterior: c.previous
            ? {
                credencialId: c.previous.credential_id,
                clientId: c.previous.client_id,
                pistaSecreto: c.previous.secret_hint,
                emitidaEn: c.previous.issued_at,
                venceEn: c.previous.expires_at,
              }
            : null,
          primeraEmisionEn: c.first_issued_at ?? null,
          primeraEmisionPor: mapearActor(c.first_issued_by),
          ultimaRotacionEn: c.last_rotated_at ?? null,
          ultimaRotacionPor: mapearActor(c.last_rotated_by),
        }
      : null,
    historial: dto.history.map((e) => ({
      eventoId: e.event_id,
      tipo: e.type,
      ocurridoEn: e.occurred_at,
      actor: mapearActorObligatorio(e.actor),
      estado: e.status,
      detalles: e.details ?? {},
    })),
  };
}

export function mapearCredencialesEmitidas(dto: CredencialesEmitidasDto): CredencialesEmitidas {
  return {
    socio: mapearDetalleSocio(dto.partner),
    secreto: { clientId: dto.secret.client_id, clientSecret: dto.secret.client_secret, cabecera: dto.secret.header },
  };
}

export function aSolicitudRegistroDto(solicitud: SolicitudRegistroSocio): Record<string, unknown> {
  return {
    name: solicitud.nombre.trim(),
    code: solicitud.codigo.trim(),
    type: solicitud.tipo,
    products: solicitud.productos.map((p) => p.trim()).filter((p) => p.length > 0),
    technical_contact_email: solicitud.correoContactoTecnico.trim(),
    quota: {
      daily_limit: solicitud.cuota.limiteDiario,
      rate_limit: solicitud.cuota.limiteRafaga,
      burst_limit: solicitud.cuota.rafagaMaxima,
    },
  };
}

// --- Errores --------------------------------------------------------------------------------------------------------

/** Códigos estables del contrato (`Error.error`) más los dos que resuelve el interceptor. */
export type CodigoErrorSocios =
  | 'validation_failed'
  | 'partner_not_found'
  | 'partner_code_taken'
  | 'partner_not_pending'
  | 'partner_not_active'
  | 'rotation_in_progress'
  | 'gateway_unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'service_unavailable';

const CODIGOS_CONOCIDOS: readonly CodigoErrorSocios[] = [
  'validation_failed',
  'partner_not_found',
  'partner_code_taken',
  'partner_not_pending',
  'partner_not_active',
  'rotation_in_progress',
  'gateway_unavailable',
];

/** Campo del formulario de registro o de la rotación al que apunta un error de validación. */
export type CampoSocio =
  | 'nombre'
  | 'codigo'
  | 'tipo'
  | 'productos'
  | 'correoContactoTecnico'
  | 'limiteDiario'
  | 'limiteRafaga'
  | 'rafagaMaxima'
  | 'horasTransicion';

const CAMPO_DEL_CONTRATO: Readonly<Record<string, CampoSocio>> = {
  name: 'nombre',
  code: 'codigo',
  type: 'tipo',
  products: 'productos',
  technical_contact_email: 'correoContactoTecnico',
  'quota.daily_limit': 'limiteDiario',
  'quota.rate_limit': 'limiteRafaga',
  'quota.burst_limit': 'rafagaMaxima',
  grace_period_hours: 'horasTransicion',
};

export interface ErrorDeCampoSocio {
  campo: CampoSocio;
  codigo: string;
}

export class ErrorSocios extends Error {
  constructor(
    readonly codigo: CodigoErrorSocios,
    /** Solo con `validation_failed`: todos los campos con error a la vez. */
    readonly campos: ErrorDeCampoSocio[] = [],
  ) {
    super(`Error de la gestión de socios: ${codigo}`);
    this.name = 'ErrorSocios';
  }
}

function campoDelContrato(field: string): CampoSocio | undefined {
  // `products[2]` y `products` apuntan al mismo campo del formulario.
  return CAMPO_DEL_CONTRATO[field] ?? CAMPO_DEL_CONTRATO[field.replace(/\[\d+\]$/, '')];
}

function extraerCampos(cuerpo: Record<string, unknown>): ErrorDeCampoSocio[] {
  const lista = cuerpo['fields'];
  if (!Array.isArray(lista)) {
    return [];
  }
  const campos: ErrorDeCampoSocio[] = [];
  for (const item of lista as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { field, code } = item as Record<string, unknown>;
    const campo = typeof field === 'string' ? campoDelContrato(field) : undefined;
    if (campo && typeof code === 'string') {
      campos.push({ campo, codigo: code });
    }
  }
  return campos;
}

/**
 * Traduce un error HTTP al código del contrato. Sin cuerpo JSON (error de red o un 5xx del API Gateway) se trata como
 * `service_unavailable`.
 */
export function traducirErrorSocios(error: unknown): ErrorSocios {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorSocios('service_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && (CODIGOS_CONOCIDOS as readonly string[]).includes(codigo)) {
      const campos = codigo === 'validation_failed' ? extraerCampos(cuerpo as Record<string, unknown>) : [];
      return new ErrorSocios(codigo as CodigoErrorSocios, campos);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorSocios('validation_failed');
    case 401:
      return new ErrorSocios('unauthorized');
    case 403:
      return new ErrorSocios('forbidden');
    case 404:
      return new ErrorSocios('partner_not_found');
    default:
      return new ErrorSocios('service_unavailable');
  }
}
