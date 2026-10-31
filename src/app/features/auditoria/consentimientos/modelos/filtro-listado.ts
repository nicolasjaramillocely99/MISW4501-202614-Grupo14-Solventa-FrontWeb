import { Params } from '@angular/router';

import {
  ESTADOS_FILTRO,
  EstadoFiltroConsentimiento,
  FiltroConsentimientos,
  PaginaConsentimientos,
} from '@core/api/auditoria/listado-consentimientos.modelos';
import { EntidadConsentimiento } from '@core/api/auditoria/revocacion.modelos';

/**
 * Funciones puras del filtro del listado O14 (HU-W4.2-01). La URL es la fuente del filtro
 * (`?estado=&desde=&hasta=&entidad=&cliente=&pagina=`): así paginar lo conserva, recargar lo mantiene y «Volver» del
 * detalle regresa al mismo listado (CA-2).
 */

/** Filas por página, como el frame `44:4954`. */
export const TAMANO_PAGINA = 6;

/** Longitud máxima de la búsqueda, la del contrato. */
export const LONGITUD_MAXIMA_CLIENTE = 100;

/** El filtro sin la página: lo que cambian los controles. */
export type CriteriosListado = Pick<FiltroConsentimientos, 'estado' | 'desde' | 'hasta' | 'entidad' | 'cliente'>;

export const SIN_CRITERIOS: CriteriosListado = { estado: null, desde: null, hasta: null, entidad: null, cliente: null };

const PATRON_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const PATRON_ENTIDAD = /^[A-Za-z0-9_-]{1,128}$/;

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
export function filtroDesdeParametros(params: Params): FiltroConsentimientos {
  const estado = texto(params, 'estado');
  const desde = texto(params, 'desde');
  const hasta = texto(params, 'hasta');
  const entidad = texto(params, 'entidad');
  const cliente = texto(params, 'cliente').slice(0, LONGITUD_MAXIMA_CLIENTE);
  const pagina = Number(texto(params, 'pagina'));
  return {
    estado: (ESTADOS_FILTRO as readonly string[]).includes(estado) ? (estado as EstadoFiltroConsentimiento) : null,
    desde: esDiaValido(desde) ? desde : null,
    hasta: esDiaValido(hasta) ? hasta : null,
    entidad: PATRON_ENTIDAD.test(entidad) ? entidad : null,
    cliente: cliente || null,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
    tamano: TAMANO_PAGINA,
  };
}

/** Los parámetros de la URL del filtro: solo los que tienen valor, y la página solo después de la primera. */
export function parametrosDesdeFiltro(filtro: CriteriosListado & { pagina?: number }): Params {
  const params: Params = {};
  if (filtro.estado) {
    params['estado'] = filtro.estado;
  }
  if (filtro.desde) {
    params['desde'] = filtro.desde;
  }
  if (filtro.hasta) {
    params['hasta'] = filtro.hasta;
  }
  if (filtro.entidad) {
    params['entidad'] = filtro.entidad;
  }
  const cliente = filtro.cliente?.trim();
  if (cliente) {
    params['cliente'] = cliente;
  }
  if (filtro.pagina && filtro.pagina > 1) {
    params['pagina'] = String(filtro.pagina);
  }
  return params;
}

/** `false` si «Hasta» es anterior a «Otorgado desde»: el listado no se consulta y el campo lo avisa. */
export function rangoValido(filtro: Pick<CriteriosListado, 'desde' | 'hasta'>): boolean {
  return !filtro.desde || !filtro.hasta || filtro.hasta >= filtro.desde;
}

/** `true` si el filtro tiene algún criterio. */
export function hayCriterios(filtro: CriteriosListado): boolean {
  return !!(filtro.estado || filtro.desde || filtro.hasta || filtro.entidad || filtro.cliente?.trim());
}

/** «1 a 6 de 1.433»: el primer y el último registro de la página; 0 y 0 sin registros. */
export function rangoRegistros(
  pagina: Pick<PaginaConsentimientos, 'pagina' | 'tamano' | 'totalRegistros'> & { items: readonly unknown[] },
): {
  primero: number;
  ultimo: number;
} {
  if (pagina.totalRegistros === 0 || pagina.items.length === 0) {
    return { primero: 0, ultimo: 0 };
  }
  const primero = (pagina.pagina - 1) * pagina.tamano + 1;
  return { primero, ultimo: primero + pagina.items.length - 1 };
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, sin pasar por zonas horarias (es un día civil). */
export function diaCorto(dia: string): string {
  const partes = PATRON_DIA.exec(dia);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : dia;
}

/** Lo que el estado vacío dice del filtro aplicado (frame `877:9304`). */
export interface DescripcionFiltro {
  /** Nombre visible de la entidad (o su código si no está en el catálogo). */
  entidad: string | null;
  estado: EstadoFiltroConsentimiento | null;
  /** `DD/MM/AAAA`. */
  desde: string | null;
  hasta: string | null;
  cliente: boolean;
}

export function describirFiltro(filtro: CriteriosListado, entidades: readonly EntidadConsentimiento[]): DescripcionFiltro {
  const entidad = filtro.entidad ? (entidades.find((e) => e.codigo === filtro.entidad)?.nombre ?? filtro.entidad) : null;
  return {
    entidad,
    estado: filtro.estado,
    desde: filtro.desde ? diaCorto(filtro.desde) : null,
    hasta: filtro.hasta ? diaCorto(filtro.hasta) : null,
    cliente: !!filtro.cliente?.trim(),
  };
}
