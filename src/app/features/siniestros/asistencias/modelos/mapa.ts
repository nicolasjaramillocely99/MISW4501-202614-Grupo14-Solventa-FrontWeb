import { InjectionToken } from '@angular/core';

/**
 * Mapa de la asignación del prestador (HU-W2.3-01, decisión F1): Leaflet con teselas de OpenStreetMap, cargado de forma
 * perezosa, sin geocodificador. La dirección que escribe el analista no sale a terceros: solo se piden teselas.
 *
 * La URL de las teselas no es configuración del ambiente (es pública y no cambia entre staging y production-demo):
 * cambiar de proveedor es cambiar esta constante y su atribución. La política de uso de OpenStreetMap exige la
 * atribución visible.
 */
export const URL_TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const URL_DERECHOS_OSM = 'https://www.openstreetmap.org/copyright';

/** Centro de la vista sin pin (Bogotá): solo es dónde arranca el mapa, no un dato de negocio. */
export const CENTRO_SIN_PIN: Coordenadas = { latitud: 4.6533, longitud: -74.0836 };
export const ZOOM_SIN_PIN = 11;

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

/** Un prestador sobre el mapa, con su etiqueta «Nombre · 2,3 km». */
export interface MarcadorMapa extends Coordenadas {
  id: string;
  etiqueta: string;
  tipo: 'candidato' | 'asignado';
}

/** Zoom que encuadra el círculo del radio en el contenedor del mapa: 5 km → 12, 10 km → 11, 20 km → 10. */
export function zoomParaRadio(radioKm: number | null): number {
  if (!radioKm || radioKm <= 0) {
    return 14;
  }
  return Math.min(17, Math.max(3, Math.round(14 - Math.log2(radioKm))));
}

/** El módulo de Leaflet que usa el mapa (`import('leaflet')`). */
export type ModuloLeaflet = typeof import('leaflet');

/**
 * Carga Leaflet bajo demanda, fuera del *chunk* del dominio, desde su versión ESM (`leaflet-esm.d.ts`). Las pruebas lo
 * sustituyen por un doble (`src/testing/leaflet-pruebas.ts`): jsdom no tiene diseño y el mapa real se prueba en E2E.
 */
export const CARGAR_LEAFLET = new InjectionToken<() => Promise<ModuloLeaflet>>('CARGAR_LEAFLET', {
  providedIn: 'root',
  factory: () => () => import('leaflet/dist/leaflet-src.esm.js'),
});
