import { MedioDePago } from '@core/api/originacion/cobro.modelos';
import { CondicionesPoliza } from '@core/api/originacion/renovacion.modelos';

/** Zona de los días civiles de las pólizas: Colombia (como el listado de HU-W1.5-01). */
const ZONA_COLOMBIA = 'America/Bogota';

const SOLO_DIGITOS = /^[0-9]+$/;

/** «02/10/2026»: el día civil de Colombia de un instante, en el orden del idioma; vacío si no es una fecha. */
export function diaColombia(iso: string | null | undefined, idioma: string): string {
  if (!iso) {
    return '';
  }
  const valor = new Date(iso);
  if (Number.isNaN(valor.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(idioma, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA_COLOMBIA }).format(valor);
}

/** «1.020.345.678»: un documento numérico con separadores de miles del idioma; otro, tal cual. */
export function documentoLegible(documento: string | null, tipo: string | null, idioma: string): string {
  if (!documento) {
    return '';
  }
  const numero = SOLO_DIGITOS.test(documento)
    ? new Intl.NumberFormat(idioma, { useGrouping: true }).format(Number(documento))
    : documento;
  return tipo ? `${tipo} ${numero}` : numero;
}

/** «+5,3 %» o «−8 %»: la variación de la prima con signo, en el idioma. */
export function variacionLegible(fraccion: number, idioma: string): string {
  return new Intl.NumberFormat(idioma, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(fraccion);
}

/** «8 %»: un porcentaje sin decimales, en el idioma. */
export function porcentajeLegible(fraccion: number, idioma: string): string {
  return new Intl.NumberFormat(idioma, { style: 'percent', maximumFractionDigits: 1 }).format(fraccion);
}

/** Las coberturas renovadas son las mismas que las vigentes (mismos códigos y valores). */
export function mismasCoberturas(vigente: CondicionesPoliza, renovada: CondicionesPoliza): boolean {
  const clave = (c: CondicionesPoliza) =>
    c.coberturas
      .map((x) => `${x.codigo}:${x.valorAsegurado}`)
      .sort()
      .join('|');
  return clave(vigente) === clave(renovada);
}

/**
 * «Visa •••• 1111»: la marca traducida (o tal cual si no tiene traducción) y los últimos cuatro dígitos de la
 * tarjeta; el banco con PSE. `traducir` es el `translate` de Transloco.
 */
export function medioLegible(medio: MedioDePago, traducir: (clave: string) => string): string {
  if (medio.tipo === 'pse') {
    return traducir('originacion.renovacionAsistida.marcas.pse');
  }
  const clave = `originacion.renovacionAsistida.marcas.${medio.marca ?? ''}`;
  const traducida = medio.marca ? traducir(clave) : '';
  const marca = traducida === clave ? (medio.marca ?? '') : traducida;
  return medio.ultimosCuatro ? `${marca} •••• ${medio.ultimosCuatro}`.trim() : marca;
}
