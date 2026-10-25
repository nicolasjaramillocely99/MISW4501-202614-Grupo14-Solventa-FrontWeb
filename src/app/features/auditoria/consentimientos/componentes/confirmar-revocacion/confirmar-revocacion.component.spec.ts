import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { pulsarEscapeEnDialogo, simularDialogoNativo } from '@testing/dialogo-pruebas';
import { ESTADO_ACTIVO_DTO } from '@testing/revocacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ErrorRevocacion, SolicitudRevocacion, mapearEstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';

import { ConfirmarRevocacionComponent } from './confirmar-revocacion.component';

const ESTADO = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);

describe('ConfirmarRevocacionComponent (O15b · HU-W4.2-02)', () => {
  beforeAll(() => simularDialogoNativo());

  async function abrir(inputs: { enviando?: boolean; error?: ErrorRevocacion | null } = {}) {
    const confirmar = vi.fn<(solicitud: SolicitudRevocacion) => void>();
    const vista = await render(ConfirmarRevocacionComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { estado: ESTADO, ...inputs },
      on: { confirmar },
    });
    const origen = document.createElement('button');
    document.body.appendChild(origen);
    origen.focus();
    vista.fixture.componentInstance.abrir();
    vista.fixture.detectChanges();
    const dialogo = vista.container.querySelector('dialog') as HTMLDialogElement;
    return { vista, confirmar, origen, dialogo };
  }

  const botonRevocar = () => screen.getByRole('button', { name: 'Revocar ahora' }) as HTMLButtonElement;

  afterEach(() => document.body.querySelectorAll(':scope > button').forEach((b) => b.remove()));

  it('no muestra nada hasta que se abre', async () => {
    const vista = await render(ConfirmarRevocacionComponent, { imports: [proveerTranslocoPruebas()], inputs: { estado: ESTADO } });

    expect(vista.container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra el cliente, el alcance, las entidades y el bloqueo inmediato (CA-1)', async () => {
    await abrir();

    const dialogo = screen.getByRole('dialog', { name: 'Revocar el consentimiento de Ana María Pérez' });
    const datos = within(dialogo);
    expect(datos.getByText('Ana María Pérez · ******4050')).toBeTruthy();
    expect(datos.getByText(/Open Finance, Open Data, KYC/)).toBeTruthy();
    expect(datos.getByText(/1 · Banco Aliado/)).toBeTruthy();
    expect(datos.getByText('Bloqueadas de inmediato en Solventa')).toBeTruthy();
    expect(datos.getByText('Efectivo en ≤ 5 min')).toBeTruthy();
    expect(datos.getByRole('button', { name: 'Cerrar' })).toBeTruthy();
  });

  it('con todo vacío deshabilita «Revocar ahora» y dice exactamente qué falta', async () => {
    await abrir();

    expect(botonRevocar().disabled).toBe(true);
    expect(screen.getByText(/Para revocar falta:/).textContent).toMatch(/el motivo,\s*una referencia válida,\s*confirmar tu rol\./);
  });

  it('el aviso se acorta a medida que se completa y desaparece con todo listo', async () => {
    await abrir();

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'regulatory_order');
    expect(screen.getByText(/Para revocar falta:/).textContent).not.toContain('el motivo');
    await userEvent.type(screen.getByLabelText('Referencia (ticket u orden)'), 'ORD-77');
    expect(screen.getByText(/Para revocar falta:/).textContent).toMatch(/confirmar tu rol\./);
    expect(botonRevocar().disabled).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo que actúo como responsable de cumplimiento/ }));

    expect(screen.queryByText(/Para revocar falta:/)).toBeNull();
    expect(botonRevocar().disabled).toBe(false);
  });

  it.each([
    ['AB', 'La referencia debe tener de 3 a 64 caracteres.'],
    ['Órden 12', 'La referencia solo admite letras sin tilde'],
    ['TCK<1>', 'La referencia solo admite letras sin tilde'],
  ])('una referencia «%s» inválida deshabilita el botón y marca el campo al salir de él', async (referencia, mensaje) => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'customer_request');
    await userEvent.click(screen.getByRole('checkbox'));
    const campo = screen.getByLabelText('Referencia (ticket u orden)');

    await userEvent.type(campo, referencia);
    await userEvent.tab();

    expect(botonRevocar().disabled).toBe(true);
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain(mensaje);
  });

  it('limita la referencia a 64 caracteres', async () => {
    await abrir();

    expect(screen.getByLabelText('Referencia (ticket u orden)').getAttribute('maxlength')).toBe('64');
  });

  it('emite la solicitud con la referencia normalizada y el rol confirmado', async () => {
    const { confirmar } = await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'customer_request');
    await userEvent.type(screen.getByLabelText('Referencia (ticket u orden)'), '  TCK   2026-0412 ');
    await userEvent.click(screen.getByRole('checkbox'));

    await userEvent.click(botonRevocar());

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith({ motivo: 'customer_request', referencia: 'TCK 2026-0412', rolConfirmado: true });
  });

  it('no emite nada si falta algo, aunque se envíe el formulario', async () => {
    const { confirmar } = await abrir();
    await userEvent.type(screen.getByLabelText('Referencia (ticket u orden)'), 'TCK-1{Enter}');

    expect(confirmar).not.toHaveBeenCalled();
  });

  it('marca los tres campos que nombra un 400 validation_failed, con el mensaje de cada uno', async () => {
    const error = new ErrorRevocacion('validation_failed', [
      { campo: 'motivo', codigo: 'required' },
      { campo: 'referencia', codigo: 'required' },
      { campo: 'rolConfirmado', codigo: 'must_be_true' },
    ]);
    const { vista } = await abrir();

    vista.fixture.componentRef.setInput('error', error);
    vista.fixture.detectChanges();

    const alertas = screen.getAllByRole('alert').map((a) => a.textContent?.trim());
    expect(alertas).toEqual([
      'Selecciona el motivo de la revocación.',
      'Ingresa la referencia del ticket o la orden.',
      'Confirma que actúas como responsable de cumplimiento.',
    ]);
    expect(screen.getByLabelText('Motivo').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Referencia (ticket u orden)').getAttribute('aria-invalid')).toBe('true');
  });

  it('al corregir un campo marcado por el servidor, su error desaparece', async () => {
    const { vista } = await abrir();
    vista.fixture.componentRef.setInput('error', new ErrorRevocacion('validation_failed', [{ campo: 'motivo', codigo: 'required' }]));
    vista.fixture.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('Selecciona el motivo');

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'customer_request');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 503 muestra el error dentro del modal, conserva lo diligenciado y deja reintentar', async () => {
    const { vista, confirmar } = await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'customer_request');
    await userEvent.type(screen.getByLabelText('Referencia (ticket u orden)'), 'TCK-1');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(botonRevocar());

    vista.fixture.componentRef.setInput('error', new ErrorRevocacion('service_unavailable'));
    vista.fixture.detectChanges();

    expect(screen.getByRole('alert').textContent).toContain('no se cambió nada');
    expect((screen.getByLabelText('Referencia (ticket u orden)') as HTMLInputElement).value).toBe('TCK-1');
    expect(botonRevocar().disabled).toBe(false);
    await userEvent.click(botonRevocar());
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(confirmar.mock.calls[1][0]).toEqual(confirmar.mock.calls[0][0]);
  });

  it('con el envío en curso dice «Revocando…» y no se puede cancelar ni cerrar', async () => {
    const { dialogo, confirmar } = await abrir({ enviando: true });

    expect(screen.getByRole('button', { name: 'Revocando…' }).hasAttribute('disabled')).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cerrar' }) as HTMLButtonElement).disabled).toBe(true);
    pulsarEscapeEnDialogo(dialogo);
    expect(dialogo.hasAttribute('open')).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('«Cancelar» cierra y devuelve el foco al botón que abrió el modal', async () => {
    const { dialogo, origen } = await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(dialogo.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(origen);
  });

  it('Escape cierra y devuelve el foco', async () => {
    const { dialogo, origen } = await abrir();

    pulsarEscapeEnDialogo(dialogo);

    expect(dialogo.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(origen);
  });

  it('al volver a abrirlo el formulario está vacío y sin errores', async () => {
    const { vista, dialogo } = await abrir();
    await userEvent.type(screen.getByLabelText('Referencia (ticket u orden)'), 'TCK-1');
    pulsarEscapeEnDialogo(dialogo);

    vista.fixture.componentInstance.abrir();
    vista.fixture.detectChanges();

    expect((screen.getByLabelText('Referencia (ticket u orden)') as HTMLInputElement).value).toBe('');
    expect(botonRevocar().disabled).toBe(true);
  });
});
