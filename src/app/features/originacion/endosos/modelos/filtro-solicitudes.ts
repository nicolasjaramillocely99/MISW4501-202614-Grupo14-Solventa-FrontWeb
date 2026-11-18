import { Params } from '@angular/router';

import {
  ESTADOS_FILTRO_SOLICITUD,
  EstadoFiltroSolicitud,
  EstadoSolicitud,
  FiltroSolicitudes,
} from '@core/api/originacion/solicitud-modificacion.modelos';

/**
 * Funciones puras del filtro de A11 · Mis solicitudes (HU-W1.4-01). La URL es la fuente del filtro
 * (`?estado=&poliza=&desde=&pagina=`): paginar lo conserva, recargar lo mantiene y «← Mis solicitudes» de A3b regresa al
 * mismo listado. Lo que la URL traiga inválido se descarta (sin filtro) y nunca rompe la página.
 */

export const TAMANO_PAGINA_SOLICITUDES = 20;

/** El filtro sin la página: lo que cambian los controles. */
export type CriteriosSolicitudes = Pick<FiltroSolicitudes, 'estado' | 'polizaId' | 'desde'>;

/** El estado visible de cada valor del filtro (sus etiquetas). */
export const ESTADO_VISIBLE: Readonly<Record<EstadoFiltroSolicitud, Exclude<EstadoSolicitud, 'desconocido'>>> = {
  filed: 'radicada',
  in_review: 'enRevision',
  applied: 'aplicada',
  rejected: 'rechazada',
};

const PATRON_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const PATRON_POLIZA = /^[A-Za-z0-9_.-]{1,128}$/;

/** `true` si el texto es un día real `AAAA-MM-DD`. */
export function esDia(texto: string): boolean {
  const partes = PATRON_DIA.exec(texto);
  if (!partes) {
    return false;
  }
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function texto(params: Params, clave: string): string {
  const valor: unknown = params[clave];
  if (Array.isArray(valor)) {
    return typeof valor[0] === 'string' ? valor[0].trim() : '';
  }
  return typeof valor === 'string' ? valor.trim() : '';
}

/** El filtro de los parámetros de la URL. */
export function filtroDesdeParametros(params: Params): FiltroSolicitudes {
  const estado = texto(params, 'estado');
  const poliza = texto(params, 'poliza');
  const desde = texto(params, 'desde');
  const pagina = Number(texto(params, 'pagina'));
  return {
    estado: (ESTADOS_FILTRO_SOLICITUD as readonly string[]).includes(estado) ? (estado as EstadoFiltroSolicitud) : null,
    polizaId: PATRON_POLIZA.test(poliza) ? poliza : null,
    desde: esDia(desde) ? desde : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
    tamano: TAMANO_PAGINA_SOLICITUDES,
  };
}

/** Los parámetros de la URL: solo los que tienen valor, y la página solo después de la primera. */
export function parametrosDesdeFiltro(filtro: CriteriosSolicitudes & { pagina?: number }): Params {
  const params: Params = {};
  if (filtro.estado) {
    params['estado'] = filtro.estado;
  }
  if (filtro.polizaId) {
    params['poliza'] = filtro.polizaId;
  }
  if (filtro.desde) {
    params['desde'] = filtro.desde;
  }
  if (filtro.pagina && filtro.pagina > 1) {
    params['pagina'] = String(filtro.pagina);
  }
  return params;
}

/** `true` si el filtro tiene algún criterio. */
export function conCriterios(filtro: CriteriosSolicitudes): boolean {
  return filtro.estado !== null || filtro.polizaId !== null || filtro.desde !== null;
}
