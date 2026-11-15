import { HttpErrorResponse, HttpParams } from '@angular/common/http';

/**
 * Modelos del resumen del tablero del socio comercial (HU-W3.2-01, pantalla B1), tipados según
 * `services/origination/api/openapi.yaml` 0.16.0 del backend y su contrato para el front (`HU-W3.2-01-api.md`). El cliente
 * traduce el JSON del contrato (snake_case) a estos tipos (camelCase). El socio nunca viaja en la petición: el backend lo
 * toma del claim `custom:partner_id` del token (CA-4).
 */

/** Rango del resumen: días civiles de Colombia `AAAA-MM-DD`, los dos incluidos (CA-2). */
export interface RangoResumen {
  desde: string;
  hasta: string;
}

/** Resumen del socio en el rango (CA-1). */
export interface ResumenSocio {
  socioId: string;
  /** Rango aplicado, `AAAA-MM-DD`. */
  desde: string;
  hasta: string;
  cotizaciones: number;
  polizasEmitidas: number;
  /** Pólizas / cotizaciones × 100 con un decimal; 0 sin cotizaciones. */
  tasaConversion: number;
}

/** Respuesta cruda del contrato (snake_case). */
export interface ResumenSocioDto {
  partner_id: string;
  from: string;
  to: string;
  quotes_requested: number;
  policies_issued: number;
  conversion_rate: number;
}

/** Parámetros de `GET /v1/partner-metrics/summary`. */
export function aParametrosResumen(rango: RangoResumen): HttpParams {
  return new HttpParams().set('from', rango.desde).set('to', rango.hasta);
}

export function mapearResumenSocio(dto: ResumenSocioDto): ResumenSocio {
  return {
    socioId: dto.partner_id,
    desde: dto.from,
    hasta: dto.to,
    cotizaciones: dto.quotes_requested,
    polizasEmitidas: dto.policies_issued,
    tasaConversion: dto.conversion_rate,
  };
}

/** Códigos estables del contrato. La pantalla decide por el código, nunca por `message`. */
export type CodigoErrorResumenSocio =
  /** La fecha final es anterior a la inicial. */
  | 'out_of_range'
  /** El rango pasa de 366 días. */
  | 'range_too_long'
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  /** La base de originación no respondió: reintentar es seguro, el resumen solo lee. */
  | 'metrics_unavailable';

const CODIGOS_ERROR: readonly string[] = [
  'out_of_range',
  'range_too_long',
  'invalid_request',
  'unauthorized',
  'forbidden',
  'metrics_unavailable',
];

/** Error del resumen del tablero, con el código estable del contrato. */
export class ErrorResumenSocio extends Error {
  constructor(readonly codigo: CodigoErrorResumenSocio) {
    super(`Error del resumen del tablero: ${codigo}`);
    this.name = 'ErrorResumenSocio';
  }
}

/** Traduce un error HTTP al código del contrato; sin cuerpo del contrato decide por el estado. */
export function traducirErrorResumenSocio(error: unknown): ErrorResumenSocio {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorResumenSocio('metrics_unavailable');
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const codigo = (cuerpo as Record<string, unknown>)['error'];
    if (typeof codigo === 'string' && CODIGOS_ERROR.includes(codigo)) {
      return new ErrorResumenSocio(codigo as CodigoErrorResumenSocio);
    }
  }
  switch (error.status) {
    case 400:
      return new ErrorResumenSocio('invalid_request');
    case 401:
      return new ErrorResumenSocio('unauthorized');
    case 403:
      return new ErrorResumenSocio('forbidden');
    default:
      return new ErrorResumenSocio('metrics_unavailable');
  }
}
