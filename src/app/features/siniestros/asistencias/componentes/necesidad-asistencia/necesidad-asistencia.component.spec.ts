import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DETALLE_CON_SUGERENCIA_DTO, POLITICA_ASISTENCIA_DTO } from '@testing/asistencia-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import {
  EstadoAsistencia,
  NecesidadRegistrada,
  PoliticaAsistencia,
  mapearDetalleAsistencia,
  mapearPoliticaAsistencia,
} from '@core/api/siniestros/asistencia.modelos';

import { necesidadesDeLinea } from '../../modelos/presentacion-asistencia';
import { NecesidadAsistenciaComponent } from './necesidad-asistencia.component';

const DE_AUTOS = necesidadesDeLinea(mapearPoliticaAsistencia(POLITICA_ASISTENCIA_DTO), 'auto');
const GRUA = mapearDetalleAsistencia(DETALLE_CON_SUGERENCIA_DTO).necesidad as NecesidadRegistrada;

describe('NecesidadAsistenciaComponent (O9b · HU-W2.3-03, S13)', () => {
  afterEach(() => vi.useRealTimers());

  const renderizar = async (
    entradas: {
      estado?: EstadoAsistencia;
      necesidad?: NecesidadRegistrada | null;
      opciones?: PoliticaAsistencia['necesidades'] | null;
      politicaFallida?: boolean;
      registrando?: boolean;
    } = {},
  ) => {
    const registrar = vi.fn();
    const reintentar = vi.fn();
    const vista = await render(NecesidadAsistenciaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { estado: 'in_call', necesidad: null, opciones: DE_AUTOS, ...entradas },
      on: { registrar, reintentar },
    });
    return { ...vista, registrar, reintentar, usuario: userEvent.setup() };
  };

  const selector = () =>
    screen.getByRole('combobox', { name: 'Necesidad reportada' }) as HTMLSelectElement;

  it('en llamada sin necesidad: elige entre las de la línea y la registra', async () => {
    const { registrar, usuario } = await renderizar();

    const opciones = [...selector().options].map((o) => o.textContent?.trim());
    expect(opciones).toEqual([
      'Selecciona la necesidad',
      'Grúa',
      'Batería',
      'Cambio de llanta',
      'Combustible',
      'Llaves dentro del vehículo',
    ]);

    await usuario.selectOptions(selector(), 'battery');
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(registrar).toHaveBeenCalledWith('battery');
  });

  it('sin elegir no envía: marca el campo y le lleva el foco', async () => {
    const { registrar, usuario } = await renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(registrar).not.toHaveBeenCalled();
    expect(selector().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Elige la necesidad.')).toBeTruthy();
    expect(document.activeElement).toBe(selector());
  });

  it('registrada: muestra quién y cuándo, y «Cambiar» la vuelve a abrir con la actual', async () => {
    // Los datos son del 21/11/2026: la hora va sin fecha solo si el evento es de hoy.
    vi.useFakeTimers({ now: new Date('2026-11-21T17:00:00Z'), toFake: ['Date'] });
    const { registrar, usuario, fixture } = await renderizar({ necesidad: GRUA });

    expect(screen.getByText('Grúa')).toBeTruthy();
    expect(screen.getByText(/^Registrada por Andrés Ruiz \d\d:\d\d$/)).toBeTruthy();

    await usuario.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(selector().value).toBe('towing');

    // Elegir la misma no envía nada.
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(registrar).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Cambiar' }));
    await usuario.selectOptions(selector(), 'fuel');
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(registrar).toHaveBeenCalledWith('fuel');

    // La respuesta trae la necesidad nueva: el cambio se cierra.
    fixture.componentRef.setInput('necesidad', { ...GRUA, codigo: 'fuel' });
    fixture.detectChanges();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Combustible')).toBeTruthy();
  });

  it('«Cancelar» deja la necesidad registrada', async () => {
    const { usuario } = await renderizar({ necesidad: GRUA });

    await usuario.click(screen.getByRole('button', { name: 'Cambiar' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Grúa')).toBeTruthy();
  });

  it('mientras registra, el botón lo dice y nada responde', async () => {
    await renderizar({ registrando: true });

    expect(
      (screen.getByRole('button', { name: 'Registrando…' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(selector().disabled).toBe(true);
  });

  it('una póliza sin necesidades (Viaje) se cierra con un motivo', async () => {
    await renderizar({ opciones: [] });

    expect(
      screen.getByText('Sin asistencia en sitio para esta póliza: ciérrala con un motivo.'),
    ).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('sin política ofrece reintentar', async () => {
    const { reintentar, usuario } = await renderizar({ opciones: null, politicaFallida: true });

    expect(screen.getByText('No pudimos cargar las necesidades.')).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalled();
  });

  it('nueva: pide atenderla primero', async () => {
    await renderizar({ estado: 'new' });

    expect(screen.getByText('Atiende la solicitud para registrarla.')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('despachada: la necesidad sin «Cambiar»; cerrada sin necesidad: «—»', async () => {
    const { fixture } = await renderizar({ estado: 'dispatched', necesidad: GRUA });

    expect(screen.getByText('Grúa')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cambiar' })).toBeNull();

    fixture.componentRef.setInput('estado', 'closed');
    fixture.componentRef.setInput('necesidad', null);
    fixture.detectChanges();
    expect(screen.getByText('—')).toBeTruthy();
  });
});
