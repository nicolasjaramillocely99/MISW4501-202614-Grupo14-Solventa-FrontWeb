import { render, screen } from '@testing-library/angular';
import { LeafletFalso, crearLeafletFalso } from '@testing/leaflet-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CARGAR_LEAFLET, Coordenadas, MarcadorMapa } from '../../modelos/mapa';
import { MapaAsignacionComponent } from './mapa-asignacion.component';

const INCIDENTE: Coordenadas = { latitud: 4.6771, longitud: -74.0483 };
const MARCADORES: MarcadorMapa[] = [
  {
    id: 'prv-a',
    latitud: 4.6912,
    longitud: -74.0391,
    etiqueta: 'Servicios Hogar Norte · 2,3 km',
    tipo: 'candidato',
  },
  {
    id: 'prv-b',
    latitud: 4.6452,
    longitud: -74.0602,
    etiqueta: '<b>Reparaciones</b> · 3,8 km',
    tipo: 'candidato',
  },
];

describe('MapaAsignacionComponent (O7 · HU-W2.3-01, F1)', () => {
  let leaflet: LeafletFalso;

  const renderizar = async (
    inputs: Partial<{
      incidente: Coordenadas | null;
      radioKm: number | null;
      marcadores: MarcadorMapa[];
      editable: boolean;
    }>,
    cargar: () => Promise<unknown> = () => Promise.resolve(leaflet.modulo),
  ) => {
    const pinMovido = vi.fn();
    const vista = await render(MapaAsignacionComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [{ provide: CARGAR_LEAFLET, useValue: cargar }],
      inputs,
      on: { pinMovido },
    });
    await vista.fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver));
    vista.fixture.detectChanges();
    return { ...vista, pinMovido };
  };

  beforeEach(() => {
    leaflet = crearLeafletFalso();
  });

  it('pinta el incidente, el círculo del radio y los prestadores, centrado con el zoom del radio', async () => {
    await renderizar({ incidente: INCIDENTE, radioKm: 5, marcadores: MARCADORES });

    const circulo = leaflet.capas.find((c) => c.tipo === 'circle');
    expect(circulo?.centro).toEqual([4.6771, -74.0483]);
    expect(circulo?.opciones['radius']).toBe(5000);
    const marcadores = leaflet.capas.filter((c) => c.tipo === 'marker');
    expect(marcadores.map((m) => m.etiqueta)).toEqual([
      'Incidente',
      'Servicios Hogar Norte · 2,3 km',
      '<b>Reparaciones</b> · 3,8 km',
    ]);
    expect(marcadores[0].clase).toContain('mapa-asignacion__marcador--incidente');
    expect(marcadores.every((m) => m.opciones['keyboard'] === false)).toBe(true);
    expect(leaflet.vistas.at(-1)).toEqual({ centro: [4.6771, -74.0483], zoom: 12 });
    expect(screen.getByText('Radio de búsqueda 5 km')).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Mapa del incidente y de los prestadores' }),
    ).toBeTruthy();
  });

  it('traduce los controles de Leaflet y atribuye las teselas de OpenStreetMap', async () => {
    await renderizar({ incidente: INCIDENTE, radioKm: 5 });

    expect(leaflet.controles).toContainEqual({
      tipo: 'zoom',
      zoomInTitle: 'Acercar',
      zoomOutTitle: 'Alejar',
    });
    expect(leaflet.controles).toContainEqual({ tipo: 'attribution', prefix: 'Leaflet' });
    expect(leaflet.teselas[0].url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(leaflet.teselas[0].opciones['attribution']).toContain('colaboradores de OpenStreetMap');
  });

  it('sin incidente arranca en Bogotá y, al editar, pide hacer clic', async () => {
    await renderizar({ incidente: null, editable: true });

    expect(leaflet.capas).toEqual([]);
    expect(leaflet.vistas.at(-1)).toEqual({ centro: [4.6533, -74.0836], zoom: 11 });
    expect(screen.getByText('Haz clic en el mapa para ubicar el incidente')).toBeTruthy();
  });

  it('en modo edición emite el pin con el clic y con el arrastre', async () => {
    const { pinMovido, fixture } = await renderizar({ incidente: null, editable: true });

    leaflet.clic(4.7, -74.05);
    expect(pinMovido).toHaveBeenLastCalledWith({ latitud: 4.7, longitud: -74.05 });

    fixture.componentRef.setInput('incidente', { latitud: 4.7, longitud: -74.05 });
    fixture.detectChanges();
    const pin = leaflet.capas.find((c) => c.tipo === 'marker');
    expect(pin?.opciones['draggable']).toBe(true);
    pin?.arrastrar(4.71, -74.06);
    expect(pinMovido).toHaveBeenLastCalledWith({ latitud: 4.71, longitud: -74.06 });

    // Al editar, la vista no salta con cada clic: solo al aparecer el primer pin.
    const vistas = leaflet.vistas.length;
    fixture.componentRef.setInput('incidente', { latitud: 4.71, longitud: -74.06 });
    fixture.detectChanges();
    expect(leaflet.vistas).toHaveLength(vistas);
  });

  it('fuera del modo edición ignora el clic y el pin no se arrastra', async () => {
    const { pinMovido } = await renderizar({ incidente: INCIDENTE, radioKm: 5 });

    leaflet.clic(4.7, -74.05);
    expect(pinMovido).not.toHaveBeenCalled();
    expect(leaflet.capas.find((c) => c.tipo === 'marker')?.opciones['draggable']).toBe(false);
  });

  it('repinta las capas al cambiar el radio sin recrear el mapa', async () => {
    const { fixture } = await renderizar({
      incidente: INCIDENTE,
      radioKm: 5,
      marcadores: MARCADORES,
    });

    fixture.componentRef.setInput('radioKm', 20);
    fixture.detectChanges();

    expect(leaflet.capas.filter((c) => c.tipo === 'circle')).toHaveLength(1);
    expect(leaflet.capas.find((c) => c.tipo === 'circle')?.opciones['radius']).toBe(20000);
    expect(leaflet.vistas.at(-1)?.zoom).toBe(10);
    expect(leaflet.teselas).toHaveLength(1);
  });

  it('elimina el mapa al destruirse', async () => {
    const { fixture } = await renderizar({ incidente: INCIDENTE });
    fixture.destroy();
    expect(leaflet.eliminado).toBe(true);
  });

  it('si Leaflet no carga, avisa y la página sigue', async () => {
    await renderizar({ incidente: INCIDENTE, radioKm: 5 }, () =>
      Promise.reject(new Error('sin red')),
    );

    expect(
      screen.getByText('El mapa no está disponible: continúa con la tabla y las coordenadas'),
    ).toBeTruthy();
  });
});
