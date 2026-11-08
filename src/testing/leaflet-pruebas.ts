/**
 * Doble mínimo de Leaflet para las pruebas unitarias del mapa de la asignación (HU-W2.3-01). jsdom no tiene diseño, así
 * que el doble registra lo que el componente pide (capas, vista, controles) y deja simular el clic y el arrastre. El
 * mapa real se prueba en Chromium con las E2E.
 *
 * Uso: `const leaflet = crearLeafletFalso();` y en los *providers*
 * `{ provide: CARGAR_LEAFLET, useValue: () => Promise.resolve(leaflet.modulo) }`.
 */

export interface CapaFalsa {
  tipo: 'circle' | 'marker';
  centro: [number, number];
  opciones: Record<string, unknown>;
  /** Clase del ícono (`mapa-asignacion__marcador--incidente`…) y su texto, para los marcadores. */
  clase?: string;
  etiqueta?: string;
  /** Simula soltar el marcador en otra posición (`dragend`). */
  arrastrar(latitud: number, longitud: number): void;
}

export interface LeafletFalso {
  /** Se pasa como el módulo de Leaflet (`ModuloLeaflet`). */
  modulo: never;
  capas: CapaFalsa[];
  vistas: { centro: [number, number]; zoom: number }[];
  controles: Record<string, unknown>[];
  teselas: { url: string; opciones: Record<string, unknown> }[];
  eliminado: boolean;
  /** Simula un clic en el mapa. */
  clic(latitud: number, longitud: number): void;
}

type Manejador = (evento: { latlng: { lat: number; lng: number } }) => void;

export function crearLeafletFalso(): LeafletFalso {
  const estado: Omit<LeafletFalso, 'modulo' | 'clic'> = {
    capas: [],
    vistas: [],
    controles: [],
    teselas: [],
    eliminado: false,
  };
  const manejadoresMapa: Record<string, Manejador> = {};

  const aPunto = (centro: unknown): [number, number] => {
    if (Array.isArray(centro)) {
      return [centro[0], centro[1]];
    }
    const { lat, lng } = centro as { lat: number; lng: number };
    return [lat, lng];
  };

  const grupo = {
    addTo: () => grupo,
    clearLayers: () => {
      estado.capas = [];
      return grupo;
    },
  };

  const capa = (
    tipo: CapaFalsa['tipo'],
    centro: unknown,
    opciones: Record<string, unknown> = {},
  ) => {
    const manejadores: Record<string, () => void> = {};
    let posicion = aPunto(centro);
    const icono = opciones['icon'] as { className?: string; html?: HTMLElement } | undefined;
    const registro: CapaFalsa = {
      tipo,
      centro: posicion,
      opciones,
      clase: icono?.className,
      etiqueta: icono?.html?.textContent ?? undefined,
      arrastrar: (latitud, longitud) => {
        posicion = [latitud, longitud];
        manejadores['dragend']?.();
      },
    };
    const objeto = {
      on: (evento: string, manejador: () => void) => {
        manejadores[evento] = manejador;
        return objeto;
      },
      getLatLng: () => ({ lat: posicion[0], lng: posicion[1] }),
      addTo: () => {
        estado.capas.push(registro);
        return objeto;
      },
    };
    return objeto;
  };

  const control = (tipo: string) => (opciones: Record<string, unknown>) => ({
    addTo: () => estado.controles.push({ tipo, ...opciones }),
  });

  const mapa = {
    on: (evento: string, manejador: Manejador) => {
      manejadoresMapa[evento] = manejador;
      return mapa;
    },
    setView: (centro: unknown, zoom: number) => {
      estado.vistas.push({ centro: aPunto(centro), zoom });
      return mapa;
    },
    remove: () => {
      estado.eliminado = true;
    },
  };

  const modulo = {
    map: () => mapa,
    tileLayer: (url: string, opciones: Record<string, unknown>) => ({
      addTo: () => estado.teselas.push({ url, opciones }),
    }),
    layerGroup: () => grupo,
    latLng: (lat: number, lng: number) => ({ lat, lng }),
    circle: (centro: unknown, opciones: Record<string, unknown>) =>
      capa('circle', centro, opciones),
    marker: (centro: unknown, opciones: Record<string, unknown>) =>
      capa('marker', centro, opciones),
    divIcon: (opciones: Record<string, unknown>) => opciones,
    control: { zoom: control('zoom'), attribution: control('attribution') },
  };

  return Object.assign(estado, {
    modulo: modulo as never,
    clic: (latitud: number, longitud: number) =>
      manejadoresMapa['click']?.({ latlng: { lat: latitud, lng: longitud } }),
  });
}
