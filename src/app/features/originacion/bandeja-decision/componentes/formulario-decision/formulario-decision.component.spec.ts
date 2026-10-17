import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { RegistroDecision } from '@core/api/originacion/revision.modelos';

import { ErroresServidorDecision, FormularioDecisionComponent } from './formulario-decision.component';

describe('FormularioDecisionComponent (S5 · CA-2 · HU-W1.1-02)', () => {
  let registrar: ReturnType<typeof vi.fn<(registro: RegistroDecision) => void>>;
  let editado: ReturnType<typeof vi.fn<(campo: string) => void>>;

  async function renderizar(entradas: { enviando?: boolean; erroresServidor?: ErroresServidorDecision } = {}) {
    registrar = vi.fn();
    editado = vi.fn();
    return render(FormularioDecisionComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: entradas,
      on: { registrar, campoEditado: editado },
    });
  }

  const boton = () => screen.getByRole('button', { name: 'Registrar decisión' });
  const ajuste = () => screen.getByLabelText('Ajuste de prima (%)') as HTMLInputElement;
  const observaciones = () => screen.getByLabelText('Observaciones') as HTMLTextAreaElement;

  it('ofrece las tres decisiones dentro del grupo «Decisión» y el ajuste deshabilitado', async () => {
    await renderizar();

    expect(screen.getByRole('group', { name: 'Decisión' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Aceptar el riesgo/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Ajustar/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Rechazar/ })).toBeTruthy();
    expect(ajuste().disabled).toBe(true);
    expect(screen.getByText('Solo al ajustar: recargo de 0,01 % a 100 %')).toBeTruthy();
    expect(screen.getByText('Obligatorias al ajustar o rechazar')).toBeTruthy();
  });

  it('sin elegir decisión no envía y lleva el foco a las opciones', async () => {
    await renderizar();

    await userEvent.click(boton());

    expect(registrar).not.toHaveBeenCalled();
    expect(screen.getByText('Elige una decisión.')).toBeTruthy();
    expect(document.activeElement?.getAttribute('name')).toBe('tipo');
  });

  it('aceptar no exige observaciones ni porcentaje', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Aceptar el riesgo/ }));
    await userEvent.click(boton());

    expect(registrar).toHaveBeenCalledWith({ tipo: 'accept', observaciones: '' });
  });

  it('rechazar exige observaciones (no basta con espacios)', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Rechazar/ }));
    await userEvent.type(observaciones(), '   ');
    await userEvent.click(boton());

    expect(registrar).not.toHaveBeenCalled();
    const error = screen.getByText('Escribe las observaciones: son obligatorias al ajustar o rechazar.');
    expect(observaciones().getAttribute('aria-invalid')).toBe('true');
    expect(observaciones().getAttribute('aria-describedby')).toBe(error.id);
    expect(document.activeElement).toBe(observaciones());

    await userEvent.type(observaciones(), 'Riesgo fuera de política');
    await userEvent.click(boton());
    expect(registrar).toHaveBeenCalledWith({ tipo: 'reject', observaciones: 'Riesgo fuera de política' });
  });

  it('ajustar habilita el porcentaje y exige porcentaje y observaciones', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Ajustar/ }));
    expect(ajuste().disabled).toBe(false);
    await userEvent.click(boton());

    expect(registrar).not.toHaveBeenCalled();
    expect(screen.getByText('Indica el recargo para ajustar la prima.')).toBeTruthy();
    expect(document.activeElement).toBe(ajuste());

    await userEvent.type(ajuste(), '12.5');
    await userEvent.type(observaciones(), 'Ingreso declarado sin verificar');
    await userEvent.click(boton());
    expect(registrar).toHaveBeenCalledWith({ tipo: 'adjust', observaciones: 'Ingreso declarado sin verificar', ajustePrimaPct: 12.5 });
  });

  it.each(['0', '100.01', '-5', '10.005'])('un recargo de %s está fuera de rango', async (valor) => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Ajustar/ }));
    await userEvent.type(ajuste(), valor);
    await userEvent.type(observaciones(), 'x');
    await userEvent.click(boton());

    expect(registrar).not.toHaveBeenCalled();
    expect(screen.getByText('El recargo debe ser mayor que 0 y hasta 100, con máximo dos decimales.')).toBeTruthy();
  });

  it('volver de ajustar a aceptar limpia y deshabilita el porcentaje', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Ajustar/ }));
    await userEvent.type(ajuste(), '10');
    await userEvent.click(screen.getByRole('radio', { name: /Aceptar el riesgo/ }));

    expect(ajuste().disabled).toBe(true);
    expect(ajuste().value).toBe('');
    await userEvent.click(boton());
    expect(registrar).toHaveBeenCalledWith({ tipo: 'accept', observaciones: '' });
  });

  it('muestra los errores del backend por campo y avisa cuando el asesor los edita', async () => {
    const { rerender } = await renderizar({ erroresServidor: { observaciones: true } });

    expect(screen.getByText('Escribe las observaciones: son obligatorias al ajustar o rechazar.')).toBeTruthy();
    await userEvent.type(observaciones(), 'a');
    expect(editado).toHaveBeenCalledWith('observaciones');

    await rerender({ inputs: { erroresServidor: { ajustePrimaPct: true } } });
    expect(screen.getByText('El recargo debe ser mayor que 0 y hasta 100, con máximo dos decimales.')).toBeTruthy();
  });

  it('mientras registra deshabilita el botón y no reenvía', async () => {
    await renderizar({ enviando: true });

    const enviando = screen.getByRole('button', { name: 'Registrando la decisión…' }) as HTMLButtonElement;
    expect(enviando.disabled).toBe(true);
  });

  it('limita las observaciones a 1 000 caracteres', async () => {
    await renderizar();

    expect(observaciones().getAttribute('maxlength')).toBe('1000');
  });
});
