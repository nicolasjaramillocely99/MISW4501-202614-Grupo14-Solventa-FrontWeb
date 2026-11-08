import { HttpErrorResponse, HttpParams } from '@angular/common/http';

import { ResumenRenovacion, ResumenRenovacionDto, VentanaRenovacion, mapearResumenRenovacion } from './renovacion.modelos';

/**
 * Modelos del listado de pólizas próximas a vencer del asesor (HU-W1.5-01, pantalla S6), tipados según
 * `services/origination/api/openapi.yaml` 0.14.0 del backend y su contrato para el front (`HU-W1.5-01-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase). Reutiliza el resumen de la renovación de HU-W1.5-02.
 */

/**
 * Estado del periodo vigente de la póliza: `expiring` sin renovación («Por vencer»); `renewal_in_progress` con la
 * renovación aceptada y en cobro («Renovación en curso»).
 */
export type EstadoPorVencer = 'expiring' | 'renewal_in_progress';

export const ESTADOS_POR_VENCER: readonly EstadoPorVencer[] = ['expiring', 'renewal_in_progress'];

/**
 * El contrato es ampliable (decisión D-6 a): HU-W1.6-02 agregará las canceladas por no pago. Un valor que este cliente no
 * conoce llega como `desconocido` y se muestra con una insignia neutra.
 */
export type EstadoPolizaPorVencer = EstadoPorVencer | 'desconocido';

/** Filtro del listado. Las fechas son días civiles de Colombia `AAAA-MM-DD`; `null` es «sin filtro» (el backend aplica el rango por defecto). */
export interface FiltroPorVencer {
  desde: string | null;
  hasta: string | null;
  estado: EstadoPorVencer | null;
  /** Empieza en 1. */
  pagina: number;
  tamano: number;
}

/** Una fila del listado (CA-1). Las fechas son RFC 3339 en UTC. */
export interface PolizaPorVencer {
  polizaId: string;
  /** Tipo de seguro (`life`, `auto`, `home`, `travel`); la columna «Producto» lo traduce (decisión D-8 b). */
  linea: string;
  producto: string | null;
  titular: { nombreCompleto: string; tipoDocumento: string | null; documento: string | null };
  prima: number;
  moneda: string;
  venceEn: string;
  estado: EstadoPolizaPorVencer;
  /** Solo dentro de la ventana de renovación y sin renovación del periodo (la regla de HU-W1.5-02). */
  puedeRenovar: boolean;
  ventana: VentanaRenovacion;
  renovacion: ResumenRenovacion | null;
}

/** Una página del listado con lo que la pantalla muestra alrededor. */
export interface PaginaPorVencer {
  items: PolizaPorVencer[];
  /** Rango aplicado (el de la consulta o el por defecto), `AAAA-MM-DD`. */
  desde: string;
  hasta: string;
  /** Días de la ventana de renovación (`RENEWAL_WINDOW_DAYS`). */
  diasVentana: number;
  /** Pólizas con el periodo abierto que vencen dentro de la ventana, sin los filtros (la tarjeta). */
  vencenEnVentana: number;
  /** Pólizas que cumplen el filtro, en todas las páginas. */
  total: number;
  pagina: number;
  tamano: number;
}

/** Respuestas crudas del contrato (snake_case). */
export interface PolizaPorVencerDto {
  policy_id: string;
  line: string;
  product: string | null;
  holder: { full_name: string; document_type: string | null; document_id: string | null };
  premium: number;
  currency: string;
  coverage_end: string;
  status: string;
  can_renew: boolean;
  renewal_window: { opens_at: string; closes_at: string };
  renewal: ResumenRenovacionDto | null;
}

export interface PaginaPorVencerDto {
  items: PolizaPorVencerDto[];
  expires_from: string;
  expires_to: string;
  window_days: number;
  due_within_window: number;
  total: number;
  page: number;
  page_size: number;
}

/** Parámetros de `GET /v1/policies/expiring`: solo los que tienen valor, la página y su tamaño siempre. */
export function aParametrosPorVencer(filtro: FiltroPorVencer): HttpParams {
  let parametros = new HttpParams().set('page', String(filtro.pagina)).set('page_size', String(filtro.tamano));
  if (filtro.desde) {
    parametros = parametros.set('expires_from', filtro.desde);
  }
  if (filtro.hasta) {
    parametros = parametros.set('expires_to', filtro.hasta);
  }
  if (filtro.estado) {
    parametros = parametros.set('status', filtro.estado);
  }
  return parametros;
}

function estadoDe(valor: string): EstadoPolizaPorVencer {
  return (ESTADOS_POR_VENCER as readonly string[]).includes(valor) ? (valor as EstadoPorVencer) : 'desconocido';
}

export function mapearPolizaPorVencer(dto: PolizaPorVencerDto): PolizaPorVencer {
  return {
    polizaId: dto.policy_id,
    linea: dto.line,
    producto: dto.product,
    titular: {
      nombreCompleto: dto.holder.full_name,
      tipoDocumento: dto.holder.document_type,
      documento: dto.holder.document_id,
    },
    prima: dto.premium,
    moneda: dto.currency,
    venceEn: dto.coverage_end,
    estado: estadoDe(dto.status),
    puedeRenovar: dto.can_renew,
    ventana: { abreEn: dto.renewal_window.opens_at, cierraEn: dto.renewal_window.closes_at },
    renovacion: dto.renewal ? mapearResumenRenovacion(dto.renewal) : null,
  };
}

export function mapearPaginaPorVencer(dto: PaginaPorVencerDto): PaginaPorVencer {
  return {
    items: dto.items.map(mapearPolizaPorVencer),
    desde: dto.expires_from,
    hasta: dto.expires_to,
    diasVentana: dto.window_days,
    vencenEnVentana: dto.due_within_window,
    total: dto.total,
    pagina: dto.page,
    tamano: dto.page_size,
  };
}

/** Códigos estables del contrato. La pantalla decide por el código, nunca por `message`. */
export type CodigoErrorPorVencer =
  /** «Hasta» es anterior a «Vencen desde». */
  | 'out_of_range'
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  /** La base de originación no respondió: reintentar es seguro, el listado solo lee. */
  | 'renewal_unavailable';

const CODIGOS_ERROR: readonly string[] = ['out_of_range', 'invalid_request', 'unauthorized', 'forbidden', 'renewal_unavailable'];

/** Error del listado de pólizas próximas a vencer, con el código estable del contrato. */
export class ErrorPorVencer extends Error {
  constructor(readonly codigo: CodigoErrorPorVencer) {
    super(`Error del listado de pólizas por vencer: ${codigo}`);
    this.name = 'ErrorPorVencer';
  }
}

/** Traduce un error HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorPorVencer(error: unknown): ErrorPorVencer {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorPorVencer('renewal_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_ERROR.includes(codigo)) {
      return new ErrorPorVencer(codigo as CodigoErrorPorVencer);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorPorVencer('invalid_request');
    case 401:
      return new ErrorPorVencer('unauthorized');
    case 403:
      return new ErrorPorVencer('forbidden');
    default:
      return new ErrorPorVencer('renewal_unavailable');
  }
}
