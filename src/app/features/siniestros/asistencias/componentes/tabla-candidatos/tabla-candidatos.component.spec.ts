import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ASIGNACION_PENDIENTE_DTO, ASIGNACION_PROPUESTA_DTO } from '@testing/asignacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import {
  BusquedaPrestador,
  mapearAsignacionSiniestro,
} from '@core/api/siniestros/asignacion.modelos';

import { TablaCandidatosComponent } from './tabla-candidatos.component';

const PROPUESTA = mapearAsignacionSiniestro(ASIGNACION_PROPUESTA_DTO)
  .ultimaBusqueda as BusquedaPrestador;
const AGOTADA = mapearAsignacionSiniestro(ASIGNACION_PENDIENTE_DTO)
  .ultimaBusqueda as BusquedaPrestador;

describe('TablaCandidatosComponent (O7/O7b · HU-W2.3-01, CA-2, CA-3 y CA-6)', () => {
  const renderizar = (busqueda: BusquedaPrestador, deshabilitado = false) => {
    const asignar = vi.fn();
    return render(TablaCandidatosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { busqueda, hoy: '2026-09-06', deshabilitado },
      on: { asignar },
    }).then((vista) => ({ ...vista, asignar }));
  };

  const fila = (nombre: string) =>
    screen.getByRole('rowheader', { name: nombre }).closest('tr') as HTMLElement;

  it('titula con la especialidad requerida y lista del más cercano al más lejano', async () => {
    await renderizar(PROPUESTA);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Prestadores con la especialidad requerida (plomería)',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('rowheader').map((c) => c.textContent?.trim())).toEqual([
      'Servicios Hogar Norte',
      'Reparaciones Chapinero',
      'Técnicos Unidos',
    ]);
    expect(within(fila('Servicios Hogar Norte')).getByText('Plomería · Humedades')).toBeTruthy();
    expect(within(fila('Servicios Hogar Norte')).getByText('2,3 km')).toBeTruthy();
  });

  it('marca el sugerido con texto, no solo con el color de la fila', async () => {
    await renderizar(PROPUESTA);

    expect(within(fila('Servicios Hogar Norte')).getByText('Sugerido')).toBeTruthy();
    expect(within(fila('Servicios Hogar Norte')).getByText('Disponible hoy')).toBeTruthy();
    expect(fila('Servicios Hogar Norte').className).toContain('candidatos__fila--sugerida');
    expect(within(fila('Técnicos Unidos')).queryByText('Sugerido')).toBeNull();
  });

  it('solo habilita «Asignar» para los elegibles (P8 y P9)', async () => {
    const { asignar } = await renderizar(PROPUESTA);

    expect(within(fila('Reparaciones Chapinero')).getByText('Disponible mañana')).toBeTruthy();
    expect(within(fila('Técnicos Unidos')).getByText('Fuera del radio')).toBeTruthy();
    const boton = (nombre: string) =>
      screen.getByRole('button', { name: `Asignar a ${nombre}` }) as HTMLButtonElement;
    expect(boton('Servicios Hogar Norte').disabled).toBe(false);
    expect(boton('Reparaciones Chapinero').disabled).toBe(true);
    expect(boton('Técnicos Unidos').disabled).toBe(true);

    await userEvent.click(boton('Servicios Hogar Norte'));
    expect(asignar).toHaveBeenCalledWith(
      expect.objectContaining({ prestadorId: 'prv-servicios-hogar-norte' }),
    );
  });

  it('en la búsqueda agotada dice el radio y por qué nadie está disponible', async () => {
    await renderizar(AGOTADA);

    expect(
      screen.getByRole('heading', {
        name: 'Prestadores con la especialidad requerida (plomería) · ninguno disponible dentro de 20 km',
      }),
    ).toBeTruthy();
    expect(
      within(fila('Servicios Hogar Norte')).getByText('No disponible · en otro caso'),
    ).toBeTruthy();
    expect(
      within(fila('Reparaciones Chapinero')).getByText(
        'No disponible · hasta 22 de septiembre de 2026',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getAllByRole('button', { name: /^Asignar a/ })
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
  });

  it('deshabilita todo mientras la página busca o asigna', async () => {
    await renderizar(PROPUESTA, true);

    expect(
      (screen.getByRole('button', { name: 'Asignar a Servicios Hogar Norte' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('sin candidatos lo dice', async () => {
    await renderizar({ ...PROPUESTA, candidatos: [] });

    expect(screen.getByText('No hay prestadores registrados con esta especialidad.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
