import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ASIGNACION_PROPUESTA_DTO } from '@testing/asignacion-pruebas';
import { pulsarEscapeEnDialogo, simularDialogoNativo } from '@testing/dialogo-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { Candidato, mapearAsignacionSiniestro } from '@core/api/siniestros/asignacion.modelos';

import { ConfirmarAsignacionComponent } from './confirmar-asignacion.component';

const SUGERIDO = mapearAsignacionSiniestro(ASIGNACION_PROPUESTA_DTO).ultimaBusqueda
  ?.candidatos[0] as Candidato;

describe('ConfirmarAsignacionComponent (HU-W2.3-01, CA-5)', () => {
  beforeAll(() => simularDialogoNativo());

  const renderizar = async (asignando = false) => {
    const confirmar = vi.fn();
    const vista = await render(ConfirmarAsignacionComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { asignando },
      on: { confirmar },
    });
    vista.fixture.componentInstance.abrir(SUGERIDO);
    vista.fixture.detectChanges();
    return { ...vista, confirmar };
  };

  const dialogo = () => document.querySelector('dialog') as HTMLDialogElement;

  it('pregunta por el prestador con su distancia y confirma con él', async () => {
    const { confirmar } = await renderizar();

    expect(dialogo().open).toBe(true);
    expect(screen.getByRole('heading', { name: '¿Asignar a Servicios Hogar Norte?' })).toBeTruthy();
    expect(screen.getByText(/Está a 2,3 km del incidente/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
    expect(confirmar).toHaveBeenCalledWith(SUGERIDO);
  });

  it('«Cancelar» y Escape cierran sin confirmar', async () => {
    const { confirmar, fixture } = await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(dialogo().open).toBe(false);

    fixture.componentInstance.abrir(SUGERIDO);
    fixture.detectChanges();
    pulsarEscapeEnDialogo(dialogo());
    expect(dialogo().open).toBe(false);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('mientras asigna no se cierra ni se confirma dos veces', async () => {
    const { confirmar } = await renderizar(true);

    expect((screen.getByRole('button', { name: 'Asignando…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    pulsarEscapeEnDialogo(dialogo());
    expect(dialogo().open).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });
});
