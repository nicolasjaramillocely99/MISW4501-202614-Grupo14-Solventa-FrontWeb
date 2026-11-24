import { render, screen } from '@testing-library/angular';
import { ASIGNACION_PENDIENTE_DTO, ASIGNACION_PROPUESTA_DTO } from '@testing/asignacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import {
  BusquedaPrestador,
  mapearAsignacionSiniestro,
} from '@core/api/siniestros/asignacion.modelos';

import { RegistroIntentosComponent } from './registro-intentos.component';

const PROPUESTA = mapearAsignacionSiniestro(ASIGNACION_PROPUESTA_DTO)
  .ultimaBusqueda as BusquedaPrestador;
const AGOTADA = mapearAsignacionSiniestro(ASIGNACION_PENDIENTE_DTO)
  .ultimaBusqueda as BusquedaPrestador;

describe('RegistroIntentosComponent (O7b · HU-W2.3-01, CA-4)', () => {
  const renderizar = (busqueda: BusquedaPrestador, radioMaximoKm: number | null = 20) =>
    render(RegistroIntentosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { busqueda, radioMaximoKm },
    });

  const lineas = () =>
    screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/\s+/g, ' ').trim());

  it('una línea por radio, con la hora, el máximo y el resultado', async () => {
    await renderizar(AGOTADA);

    expect(screen.getByRole('heading', { name: 'Registro de intentos' })).toBeTruthy();
    expect(lineas()).toEqual([
      expect.stringMatching(/^\d{2}:\d{2} · 5 km · sin prestadores disponibles$/),
      expect.stringMatching(/^\d{2}:\d{2} · 10 km · sin prestadores disponibles$/),
      expect.stringMatching(/^\d{2}:\d{2} · 20 km \(máximo\) · sin prestadores disponibles$/),
    ]);
    expect(screen.getByText(/Búsqueda de Andrés Ruiz/)).toBeTruthy();
  });

  it('cuenta los prestadores disponibles en singular y plural', async () => {
    const { rerender } = await renderizar(PROPUESTA);
    expect(lineas()[0]).toMatch(/5 km · 1 prestador disponible$/);

    await rerender({
      inputs: {
        busqueda: { ...PROPUESTA, intentos: [{ ...PROPUESTA.intentos[0], elegibles: 2 }] },
        radioMaximoKm: 20,
      },
    });
    expect(lineas()[0]).toMatch(/5 km · 2 prestadores disponibles$/);
  });

  it('rotula la búsqueda automática del caso pendiente', async () => {
    await renderizar({ ...AGOTADA, disparo: 'automatic_retry', buscadaPor: null });

    expect(screen.getByText(/Búsqueda automática/)).toBeTruthy();
  });

  it('sin política no marca el máximo', async () => {
    await renderizar(AGOTADA, null);

    expect(lineas()[2]).not.toContain('máximo');
  });
});
