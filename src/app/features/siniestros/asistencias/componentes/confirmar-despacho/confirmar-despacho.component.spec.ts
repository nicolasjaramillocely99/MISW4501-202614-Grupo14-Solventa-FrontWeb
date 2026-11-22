import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  DETALLE_CON_SUGERENCIA_DTO,
  DETALLE_UBICADA_POR_VOZ_DTO,
} from '@testing/asistencia-pruebas';
import { pulsarEscapeEnDialogo, simularDialogoNativo } from '@testing/dialogo-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import {
  DetalleAsistencia,
  DetalleAsistenciaDto,
  mapearDetalleAsistencia,
} from '@core/api/siniestros/asistencia.modelos';

import { ConfirmarDespachoComponent } from './confirmar-despacho.component';

describe('ConfirmarDespachoComponent (O9b · HU-W2.3-03, S15, CA-3)', () => {
  beforeAll(() => simularDialogoNativo());

  const renderizar = async (dto: DetalleAsistenciaDto, despachando = false) => {
    const detalle: DetalleAsistencia = mapearDetalleAsistencia(dto);
    const confirmar = vi.fn();
    const vista = await render(ConfirmarDespachoComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: {
        necesidad: detalle.necesidad?.codigo ?? null,
        ubicacion: detalle.ubicacion,
        despachando,
      },
      on: { confirmar },
    });
    const candidato = detalle.sugerencia.candidatos[0];
    vista.fixture.componentInstance.abrir(candidato);
    vista.fixture.detectChanges();
    return { ...vista, confirmar, candidato };
  };

  const dialogo = () => document.querySelector('dialog') as HTMLDialogElement;

  it('muestra el prestador, la distancia, la llegada, la necesidad y la ubicación del teléfono', async () => {
    const { confirmar, candidato } = await renderizar(DETALLE_CON_SUGERENCIA_DTO);

    expect(dialogo().open).toBe(true);
    expect(
      screen.getByRole('heading', { name: '¿Despachar a Grúas Autopista Norte?' }),
    ).toBeTruthy();
    expect(screen.getByText('0,9 km')).toBeTruthy();
    expect(screen.getByText('12 min')).toBeTruthy();
    expect(screen.getByText('Grúa')).toBeTruthy();
    expect(screen.getByText('4,7712 N · 74,0452 O · precisión 8 m')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar despacho' }));
    expect(confirmar).toHaveBeenCalledWith(candidato);
  });

  it('sin GPS comparte la dirección indicada por voz', async () => {
    await renderizar(DETALLE_UBICADA_POR_VOZ_DTO);

    expect(screen.getByRole('heading', { name: '¿Despachar a Grúas del Valle?' })).toBeTruthy();
    expect(
      screen.getByText('Vía Cali–Palmira km 4 · 3,4921 N · 76,4203 O (indicada por voz)'),
    ).toBeTruthy();
  });

  it('«Cancelar», la X y Escape cierran sin confirmar', async () => {
    const { confirmar, fixture, candidato } = await renderizar(DETALLE_CON_SUGERENCIA_DTO);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(dialogo().open).toBe(false);

    fixture.componentInstance.abrir(candidato);
    fixture.detectChanges();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(dialogo().open).toBe(false);

    fixture.componentInstance.abrir(candidato);
    fixture.detectChanges();
    pulsarEscapeEnDialogo(dialogo());
    expect(dialogo().open).toBe(false);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('el foco vuelve al botón que lo abrió', async () => {
    const boton = document.createElement('button');
    document.body.append(boton);
    boton.focus();
    await renderizar(DETALLE_CON_SUGERENCIA_DTO);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(document.activeElement).toBe(boton);
    boton.remove();
  });

  it('mientras despacha no se cierra ni se confirma dos veces', async () => {
    const { confirmar } = await renderizar(DETALLE_CON_SUGERENCIA_DTO, true);

    expect(
      (screen.getByRole('button', { name: 'Despachando…' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    pulsarEscapeEnDialogo(dialogo());
    expect(dialogo().open).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });
});
