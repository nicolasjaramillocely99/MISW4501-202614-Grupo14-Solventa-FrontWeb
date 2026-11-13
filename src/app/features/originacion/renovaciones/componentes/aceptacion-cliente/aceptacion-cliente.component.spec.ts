import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RENOVACION_FORMALIZADA_DTO, RENOVACION_RECOTIZADA_DTO } from '@testing/renovacion-asistida-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { SolicitudFormalizacion } from '@core/api/originacion/formalizacion.modelos';
import { mapearRenovacionAsistida } from '@core/api/originacion/renovacion-asistida.modelos';

import { AceptacionClienteComponent } from './aceptacion-cliente.component';

const VISTA = mapearRenovacionAsistida(RENOVACION_RECOTIZADA_DTO);

async function renderizar(inputs: Record<string, unknown> = {}) {
  const emitidas: (SolicitudFormalizacion | null)[] = [];
  let envios = 0;
  // Las mismas funciones se pasan en cada `rerender`: sin ellas, Testing Library cancela las suscripciones.
  const on = {
    solicitud: (s: SolicitudFormalizacion | null) => emitidas.push(s),
    enviarCodigo: () => envios++,
  };
  const resultado = await render(AceptacionClienteComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { medioDePago: VISTA.medioDePago, ...inputs },
    on,
  });
  return { ...resultado, on, emitidas, envios: () => envios };
}

describe('AceptacionClienteComponent (HU-W1.5-03 · CA-2, D-9)', () => {
  it('con llamada grabada pide la referencia y la casilla antes de emitir la solicitud', async () => {
    const { emitidas } = await renderizar();
    const usuario = userEvent.setup();

    expect(emitidas.at(-1)).toBeNull();
    await usuario.type(screen.getByLabelText('Referencia'), 'GRAB-2026-88931');
    expect(emitidas.at(-1)).toBeNull();
    await usuario.click(
      screen.getByRole('checkbox', {
        name: 'El cliente aceptó las condiciones recotizadas y autorizó el cobro con su medio de pago registrado (Visa •••• 1111).',
      }),
    );

    expect(emitidas.at(-1)).toMatchObject({ metodo: 'recorded_call', referencia: 'GRAB-2026-88931' });
    expect(emitidas.at(-1)?.aceptadaEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('muestra el error de cada campo que el asesor tocó', async () => {
    await renderizar();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByLabelText('Referencia'));
    await usuario.tab();
    expect(screen.getByText('Indica la referencia de la grabación o de la firma.')).toBeTruthy();

    await usuario.type(screen.getByLabelText('Referencia'), 'GRAB 1;');
    expect(screen.getByText(/Hasta 64 caracteres/)).toBeTruthy();

    const casilla = screen.getByRole('checkbox');
    await usuario.click(casilla);
    await usuario.click(casilla);
    expect(screen.getByText('Confirma que el cliente aceptó y autorizó el cobro.')).toBeTruthy();
  });

  it('una fecha futura o anterior a la recotización está fuera de rango', async () => {
    await renderizar({ recotizadaEn: '2099-01-01T10:00:00Z' });
    const usuario = userEvent.setup();

    await usuario.click(screen.getByLabelText('Fecha y hora'));
    await usuario.tab();

    expect(screen.getByText('La fecha no puede ser futura ni anterior a la recotización.')).toBeTruthy();
  });

  it('con el código de confirmación pide enviarlo y los 6 dígitos, sin referencia', async () => {
    const { emitidas, envios, rerender, on } = await renderizar();
    const usuario = userEvent.setup();

    await usuario.selectOptions(screen.getByLabelText('Medio por el que aceptó'), 'confirmation_code');
    expect(screen.queryByLabelText('Referencia')).toBeNull();
    await usuario.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(envios()).toBe(1);

    await rerender({
      inputs: {
        medioDePago: VISTA.medioDePago,
        envios: 1,
        codigoEnviado: { recotizacionId: 'rq-1', enviadoA: 'ca***@example.com', venceEn: '2026-09-16T21:12:00Z' },
      },
      on,
      partialUpdate: true,
    });
    expect(screen.getByRole('status').textContent).toMatch(/Enviado a ca\*\*\*@example\.com · vence a las .*Quedan 2 envíos/);
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeTruthy();

    await usuario.type(screen.getByLabelText('Código de 6 dígitos'), '4829');
    await usuario.tab();
    expect(screen.getByText('El código tiene 6 dígitos.')).toBeTruthy();
    await usuario.type(screen.getByLabelText('Código de 6 dígitos'), '13');
    await usuario.click(screen.getByRole('checkbox'));

    expect(emitidas.at(-1)).toMatchObject({ metodo: 'confirmation_code', codigo: '482913', referencia: '' });
  });

  it('no deja reenviar después del tercer código y muestra el error del servicio', async () => {
    await renderizar({ envios: 3, errorCodigo: 'invalid_confirmation_code' });
    const usuario = userEvent.setup();

    await usuario.selectOptions(screen.getByLabelText('Medio por el que aceptó'), 'confirmation_code');

    expect((screen.getByRole('button', { name: 'Reenviar código' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('El código no es el que recibió el cliente.')).toBeTruthy();
    expect(screen.getByLabelText('Código de 6 dígitos').getAttribute('aria-invalid')).toBe('true');
  });

  it('marca los campos que el servicio rechazó', async () => {
    await renderizar({ erroresServidor: { referencia: 'required', fecha: 'out_of_range' } });

    expect(screen.getByText('Indica la referencia de la grabación o de la firma.')).toBeTruthy();
    expect(screen.getByLabelText('Fecha y hora').getAttribute('aria-invalid')).toBe('true');
  });

  it('se deshabilita sin recotización vigente', async () => {
    await renderizar({ deshabilitado: true });

    // Los campos se deshabilitan por el `fieldset` que los agrupa.
    expect(screen.getByLabelText('Referencia').matches(':disabled')).toBe(true);
    expect(screen.getByRole('checkbox').matches(':disabled')).toBe(true);
  });

  it('en S7b muestra la aceptación registrada en solo lectura', async () => {
    const formalizada = mapearRenovacionAsistida(RENOVACION_FORMALIZADA_DTO);
    await renderizar({ soloLectura: formalizada.formalizacion });

    expect(screen.getByRole('heading', { name: 'Aceptación registrada' })).toBeTruthy();
    expect(screen.getByText('Llamada grabada')).toBeTruthy();
    expect(screen.getByText('GRAB-2026-88931')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('sin referencia en S7b dice que se usó el código', async () => {
    const formalizada = mapearRenovacionAsistida(RENOVACION_FORMALIZADA_DTO);
    await renderizar({ soloLectura: { ...formalizada.formalizacion!, metodo: 'confirmation_code', referencia: null }, medioDePago: null });

    expect(screen.getByText('Sin referencia (código de confirmación)')).toBeTruthy();
    expect(screen.getByText('El cliente aceptó las condiciones recotizadas y autorizó el cobro con su medio de pago registrado.')).toBeTruthy();
  });
});
