import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CampoInvalido } from '@core/api/siniestros/asignacion.modelos';

import { Coordenadas } from '../../modelos/mapa';
import { UbicacionIncidenteComponent } from './ubicacion-incidente.component';

describe('UbicacionIncidenteComponent (HU-W2.3-01, CA-1)', () => {
  const renderizar = async (
    inputs: Partial<{
      pin: Coordenadas | null;
      direccionInicial: string;
      erroresServidor: CampoInvalido[];
      cancelable: boolean;
      guardando: boolean;
    }> = {},
  ) => {
    const guardar = vi.fn();
    const pinEscrito = vi.fn();
    const cancelar = vi.fn();
    const vista = await render(UbicacionIncidenteComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs,
      on: { guardar, pinEscrito, cancelar },
    });
    return { ...vista, guardar, pinEscrito, cancelar };
  };

  const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement;

  it('los campos siguen al pin del mapa', async () => {
    const { fixture } = await renderizar({ pin: { latitud: 4.6771, longitud: -74.0483 } });

    expect(campo('Latitud').value).toBe('4.677100');
    expect(campo('Longitud').value).toBe('-74.048300');

    fixture.componentRef.setInput('pin', { latitud: 4.7, longitud: -74.05 });
    fixture.detectChanges();
    expect(campo('Latitud').value).toBe('4.700000');
  });

  it('escribir coordenadas válidas mueve el pin; inválidas no', async () => {
    const { pinEscrito } = await renderizar();

    await userEvent.type(campo('Latitud'), '4,6771');
    expect(pinEscrito).not.toHaveBeenCalled();
    await userEvent.type(campo('Longitud'), '-74.0483');
    expect(pinEscrito).toHaveBeenLastCalledWith({ latitud: 4.6771, longitud: -74.0483 });

    // Al teclear «91», el «9» intermedio sí es válido; el 91 (fuera de rango) nunca mueve el pin.
    pinEscrito.mockClear();
    await userEvent.clear(campo('Latitud'));
    await userEvent.type(campo('Latitud'), '91');
    expect(pinEscrito).toHaveBeenLastCalledWith({ latitud: 9, longitud: -74.0483 });
    expect(pinEscrito).not.toHaveBeenCalledWith(expect.objectContaining({ latitud: 91 }));
  });

  it('no reescribe lo que el analista teclea cuando el pin ya coincide', async () => {
    const { fixture } = await renderizar({ pin: { latitud: 4.6771, longitud: -74.0483 } });

    await userEvent.clear(campo('Latitud'));
    await userEvent.type(campo('Latitud'), '4.6');
    fixture.componentRef.setInput('pin', { latitud: 4.6, longitud: -74.0483 });
    fixture.detectChanges();

    expect(campo('Latitud').value).toBe('4.6');
  });

  it('valida todo al guardar y no envía con errores', async () => {
    const { guardar } = await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar ubicación' }));

    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe la dirección del incidente.')).toBeTruthy();
    expect(screen.getByText('Escribe la latitud o haz clic en el mapa.')).toBeTruthy();
    expect(screen.getByText('Escribe la longitud o haz clic en el mapa.')).toBeTruthy();
    expect(campo('Dirección').getAttribute('aria-invalid')).toBe('true');
  });

  it('muestra el error de un campo al salir de él', async () => {
    await renderizar();

    await userEvent.type(campo('Dirección'), 'Cra');
    await userEvent.tab();

    expect(screen.getByText('La dirección debe tener entre 5 y 200 caracteres.')).toBeTruthy();
    expect(screen.queryByText('Escribe la latitud o haz clic en el mapa.')).toBeNull();
  });

  it('envía la dirección y las coordenadas del pin', async () => {
    const { guardar } = await renderizar({ pin: { latitud: 4.6771, longitud: -74.0483 } });

    await userEvent.type(campo('Dirección'), '  Carrera 15 # 93-40, Bogotá ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ubicación' }));

    expect(guardar).toHaveBeenCalledWith({
      direccion: 'Carrera 15 # 93-40, Bogotá',
      latitud: 4.6771,
      longitud: -74.0483,
    });
  });

  it('marca en el campo lo que rechazó el servidor', async () => {
    await renderizar({
      erroresServidor: [
        { campo: 'latitude', codigo: 'out_of_range' },
        { campo: 'address', codigo: 'invalid_format' },
        { campo: 'otro', codigo: 'required' },
      ],
    });

    expect(screen.getByText('La latitud va de −90 a 90.')).toBeTruthy();
    expect(screen.getByText('La dirección debe tener entre 5 y 200 caracteres.')).toBeTruthy();
  });

  it('al corregir, arranca con la dirección registrada y se puede cancelar', async () => {
    const { cancelar } = await renderizar({
      direccionInicial: 'Carrera 15 # 93-40',
      cancelable: true,
    });

    expect(campo('Dirección').value).toBe('Carrera 15 # 93-40');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelar).toHaveBeenCalled();
  });

  it('mientras guarda, el botón lo dice y no responde', async () => {
    await renderizar({ guardando: true });

    expect((screen.getByRole('button', { name: 'Guardando…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });
});
