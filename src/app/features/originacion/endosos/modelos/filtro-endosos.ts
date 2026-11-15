import { Params } from '@angular/router';

import { ESTADOS_FILTRO_ENDOSO, EstadoFiltroEndoso, FiltroEndosos } from '@core/api/originacion/endosos.modelos';
import { TIPOS_CAMBIO, TipoCambio } from '@core/api/originacion/solicitud-modificacion.modelos';

import { esDia } from './filtro-solicitudes';

/**
 * Funciones puras del filtro de O2 · Endosos (HU-W1.4-02). La URL es la fuente del filtro (`?tipo=&estado=&desde=&pagina=`):
 * paginar lo conserva, recargar lo mantiene y «← Endosos» del detalle regresa a la misma bandeja. Sin `estado`, la bandeja
 * muestra las pendientes. Lo que la URL traiga inválido se descarta y nunca rompe la página.
 */

export const TAMANO_PAGINA_ENDOSOS = 20;

/** El filtro sin la página: lo que cambian los controles. */
export type CriteriosEndosos = Pick<FiltroEndosos, 'tipo' | 'estado' | 'desde'>;

function texto(params: Params, clave: string): string {
  const valor: unknown = params[clave];
  if (Array.isArray(valor)) {
    return typeof valor[0] === 'string' ? valor[0].trim() : '';
  }
  return typeof valor === 'string' ? valor.trim() : '';
}

export function filtroEndososDesdeParametros(params: Params): FiltroEndosos {
  const tipo = texto(params, 'tipo');
  const estado = texto(params, 'estado');
  const desde = texto(params, 'desde');
  const pagina = Number(texto(params, 'pagina'));
  return {
    tipo: (TIPOS_CAMBIO as readonly string[]).includes(tipo) ? (tipo as TipoCambio) : null,
    estado: (ESTADOS_FILTRO_ENDOSO as readonly string[]).includes(estado) ? (estado as EstadoFiltroEndoso) : 'pending',
    desde: esDia(desde) ? desde : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
    tamano: TAMANO_PAGINA_ENDOSOS,
  };
}

/** Los parámetros de la URL: solo los que se apartan de lo predeterminado. */
export function parametrosDesdeFiltroEndosos(filtro: CriteriosEndosos & { pagina?: number }): Params {
  const params: Params = {};
  if (filtro.tipo) {
    params['tipo'] = filtro.tipo;
  }
  if (filtro.estado !== 'pending') {
    params['estado'] = filtro.estado;
  }
  if (filtro.desde) {
    params['desde'] = filtro.desde;
  }
  if (filtro.pagina && filtro.pagina > 1) {
    params['pagina'] = String(filtro.pagina);
  }
  return params;
}
