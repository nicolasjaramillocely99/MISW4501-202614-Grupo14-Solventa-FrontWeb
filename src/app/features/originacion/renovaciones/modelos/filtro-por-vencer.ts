import { Params } from '@angular/router';

import { ESTADOS_POR_VENCER, EstadoPorVencer, FiltroPorVencer } from '@core/api/originacion/polizas-por-vencer.modelos';

/**
 * Funciones puras del filtro de S6 · Pólizas próximas a vencer (HU-W1.5-01). La URL es la fuente del filtro
 * (`?desde=&hasta=&estado=&pagina=`): así paginar lo conserva, recargar lo mantiene y «← Renovaciones» de la renovación
 * asistida (HU-W1.5-03) regresa al mismo listado. Sin `desde` ni `hasta`, el backend aplica el rango por defecto (la
 * ventana de renovación desde hoy) y la página lo muestra en los campos.
 */

/** Filas por página, como el listado de HU-W4.2-01 (decisión D-9 a). */
export const TAMANO_PAGINA = 20;

/** El filtro sin la página: lo que cambian los controles. */
export type CriteriosPorVencer = Pick<FiltroPorVencer, 'desde' | 'hasta' | 'estado'>;

export const SIN_CRITERIOS: CriteriosPorVencer = { desde: null, hasta: null, estado: null };

const PATRON_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` si el texto es un día real `AAAA-MM-DD` (sin el 30 de febrero). */
export function esDiaValido(texto: string): boolean {
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

/** El filtro de los parámetros de la URL; lo que no es válido se descarta (sin filtro), nunca rompe la página. */
export function filtroDesdeParametros(params: Params): FiltroPorVencer {
  const desde = texto(params, 'desde');
  const hasta = texto(params, 'hasta');
  const estado = texto(params, 'estado');
  const pagina = Number(texto(params, 'pagina'));
  return {
    desde: esDiaValido(desde) ? desde : null,
    hasta: esDiaValido(hasta) ? hasta : null,
    estado: (ESTADOS_POR_VENCER as readonly string[]).includes(estado) ? (estado as EstadoPorVencer) : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
    tamano: TAMANO_PAGINA,
  };
}

/** Los parámetros de la URL del filtro: solo los que tienen valor, y la página solo después de la primera. */
export function parametrosDesdeFiltro(filtro: CriteriosPorVencer & { pagina?: number }): Params {
  const params: Params = {};
  if (filtro.desde) {
    params['desde'] = filtro.desde;
  }
  if (filtro.hasta) {
    params['hasta'] = filtro.hasta;
  }
  if (filtro.estado) {
    params['estado'] = filtro.estado;
  }
  if (filtro.pagina && filtro.pagina > 1) {
    params['pagina'] = String(filtro.pagina);
  }
  return params;
}

/** `false` si «Hasta» es anterior a «Vencen desde»: el listado no se consulta y el campo lo avisa. */
export function rangoValido(filtro: Pick<CriteriosPorVencer, 'desde' | 'hasta'>): boolean {
  return !filtro.desde || !filtro.hasta || filtro.hasta >= filtro.desde;
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, sin pasar por zonas horarias (es un día civil). */
export function diaCorto(dia: string): string {
  const partes = PATRON_DIA.exec(dia);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : dia;
}

/** Número de páginas de un total (al menos 1). */
export function totalPaginas(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, tamano)));
}
