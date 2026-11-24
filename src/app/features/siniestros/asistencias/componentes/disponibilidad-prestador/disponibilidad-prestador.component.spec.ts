import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PRESTADORES_DTO } from '@testing/asignacion-pruebas';
import { pulsarEscapeEnDialogo, simularDialogoNativo } from '@testing/dialogo-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { Prestador, mapearListaPrestadores } from '@core/api/siniestros/asignacion.modelos';

import { DisponibilidadPrestadorComponent } from './disponibilidad-prestador.component';

const [DISPONIBLE, NO_DISPONIBLE, OCUPADO] = mapearListaPrestadores({ items: PRESTADORES_DTO });

describe('DisponibilidadPrestadorComponent (HU-W2.3-01, F2 y D13)', () => {
  beforeAll(() => simularDialogoNativo());

  const renderizar = async (
    prestador: Prestador,
    inputs: Partial<{ guardando: boolean; error: boolean }> = {},
  ) => {
    const guardar = vi.fn();
    const vista = await render(DisponibilidadPrestadorComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { hoy: '2026-11-07', ...inputs },
      on: { guardar },
    });
    vista.fixture.componentInstance.abrir(prestador);
    vista.fixture.detectChanges();
    return { ...vista, guardar, usuario: userEvent.setup() };
  };

  const dialogo = () => document.querySelector('dialog') as HTMLDialogElement;

  it('a un disponible propone «No disponible», con fecha opcional', async () => {
    const { guardar, usuario } = await renderizar(DISPONIBLE);

    expect(
      screen.getByRole('heading', { name: 'Disponibilidad de Servicios Hogar Norte' }),
    ).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'No disponible' }) as HTMLInputElement).checked).toBe(
      true,
    );
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(guardar).toHaveBeenCalledWith({
      prestador: DISPONIBLE,
      solicitud: { disponibilidad: 'unavailable' },
    });
  });

  it('envía la fecha «Hasta» y rechaza una pasada', async () => {
    const { guardar, usuario } = await renderizar(DISPONIBLE);
    const hasta = screen.getByLabelText('Hasta (opcional)') as HTMLInputElement;
    expect(hasta.min).toBe('2026-11-07');

    await usuario.type(hasta, '2026-11-06');
    expect(screen.getByText('La fecha no puede ser anterior a hoy.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await usuario.clear(hasta);
    await usuario.type(hasta, '2026-11-07');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(guardar).toHaveBeenCalledWith({
      prestador: DISPONIBLE,
      solicitud: { disponibilidad: 'unavailable', hasta: '2026-11-07' },
    });
  });

  it('a uno no disponible propone «Disponible» y precarga su fecha', async () => {
    const { guardar, usuario } = await renderizar(NO_DISPONIBLE);

    expect((screen.getByRole('radio', { name: 'Disponible' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.queryByLabelText('Hasta (opcional)')).toBeNull();
    await usuario.click(screen.getByRole('radio', { name: 'No disponible' }));
    expect((screen.getByLabelText('Hasta (opcional)') as HTMLInputElement).value).toBe(
      '2026-09-07',
    );

    await usuario.click(screen.getByRole('radio', { name: 'Disponible' }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(guardar).toHaveBeenCalledWith({
      prestador: NO_DISPONIBLE,
      solicitud: { disponibilidad: 'available' },
    });
  });

  it('a uno ocupado explica que marcarlo disponible lo libera', async () => {
    await renderizar(OCUPADO);

    expect(screen.getByText(/Está asignado a un caso/)).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Disponible' }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('muestra el error del servidor y, mientras guarda, no se cierra', async () => {
    await renderizar(DISPONIBLE, { guardando: true, error: true });

    expect(screen.getByRole('alert').textContent).toContain('No pudimos guardar la disponibilidad');
    expect((screen.getByRole('button', { name: 'Guardando…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    pulsarEscapeEnDialogo(dialogo());
    expect(dialogo().open).toBe(true);
  });

  it('«Cancelar» cierra sin guardar', async () => {
    const { guardar, usuario } = await renderizar(DISPONIBLE);

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(dialogo().open).toBe(false);
    expect(guardar).not.toHaveBeenCalled();
  });
});
