import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  CONDICIONES_RENOVACION_DTO,
  RENOVACION_ACEPTADA_DTO,
  RENOVACION_NO_RENOVADA_DTO,
  RENOVACION_RECHAZADA_DTO,
  RENOVACION_RENOVADA_DTO,
  RENOVACION_SIN_MEDIO_DTO,
} from '@testing/renovacion-pruebas';
import { COBRO_RENOVACION_DTO } from '@testing/renovacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ErrorCobro, mapearCobro } from '@core/api/originacion/cobro.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CodigoErrorRenovacion,
  CondicionesRenovacion,
  ErrorRenovacion,
  Renovacion,
  mapearCondicionesRenovacion,
  mapearRenovacion,
} from '@core/api/originacion/renovacion.modelos';
import { PasarelaPagosService } from '@core/api/pasarela/pasarela.service';
import { FormularioMedioPagoComponent } from '@features/embebido/pago/componentes/formulario-medio-pago/formulario-medio-pago.component';

import { INTERVALO_SEGUIMIENTO_MS, RenovarPolizaPage } from './renovar-poliza.page';

const CONDICIONES = mapearCondicionesRenovacion(CONDICIONES_RENOVACION_DTO);
const ACEPTADA = mapearRenovacion(RENOVACION_ACEPTADA_DTO);
const RENOVADA = mapearRenovacion(RENOVACION_RENOVADA_DTO);
const RECHAZADA = mapearRenovacion(RENOVACION_RECHAZADA_DTO);
const SIN_MEDIO = mapearRenovacion(RENOVACION_SIN_MEDIO_DTO);
const NO_RENOVADA = mapearRenovacion(RENOVACION_NO_RENOVADA_DTO);
const falla = (codigo: CodigoErrorRenovacion) => throwError(() => new ErrorRenovacion(codigo));
const sinRenovacion = () => falla('renewal_not_found');

describe('RenovarPolizaPage (A4 / A4b · HU-W1.5-02)', () => {
  const api = {
    consultarEstadoRenovacion: vi.fn<(id: string) => Observable<Renovacion>>(),
    consultarCondicionesRenovacion: vi.fn<(id: string) => Observable<CondicionesRenovacion>>(),
    renovarPoliza: vi.fn(),
    entregarMedioDePago: vi.fn(),
  };

  async function renderizar() {
    return render(RenovarPolizaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        { provide: PasarelaPagosService, useValue: { tokenizar: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: CONDICIONES.poliza.polizaId } } } },
      ],
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.consultarEstadoRenovacion.mockReturnValue(sinRenovacion());
    api.consultarCondicionesRenovacion.mockReturnValue(of(CONDICIONES));
    api.renovarPoliza.mockReturnValue(of({ renovacion: ACEPTADA, creada: true }));
  });

  afterEach(() => vi.useRealTimers());

  const aceptar = () => userEvent.click(screen.getByRole('checkbox', { name: /Acepto las condiciones renovadas/ }));
  const renovar = () => userEvent.click(screen.getByRole('button', { name: /Renovar y pagar/ }));

  it('mientras consulta la renovación informa que carga', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(new Subject<Renovacion>());

    await renderizar();

    expect(screen.getByRole('status').textContent).toContain('Cargando la renovación');
  });

  it('antes de aceptar muestra las condiciones vigentes junto a las recotizadas (criterio 1)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Renovar póliza' })).toBeTruthy();
    expect(screen.getByText(/Vence el 2 de octubre de 2026/)).toBeTruthy();
    expect(screen.getByText('Condiciones recotizadas')).toBeTruthy();
    expect(screen.getByText(/descuento del 8 %/)).toBeTruthy();
    const tabla = (screen.getByRole('table').textContent ?? '').replace(/\u00a0/g, ' ');
    expect(tabla).toContain('$ 142.300 COP');
    expect(tabla).toContain('$ 149.800 COP');
    expect(tabla).toContain('+5,3 %');
    expect(tabla).toContain('8 % aplicado');
    expect(tabla).toContain('Fallecimiento del asegurado');
    expect(screen.getByRole('button', { name: /Renovar y pagar \$\s149\.800\sCOP/ })).toBeTruthy();
    expect(screen.getByText('Visa •••• 1111')).toBeTruthy();
    expect(screen.getByText(/La cobertura termina el 2 de octubre de 2026/)).toBeTruthy();
    expect(api.consultarEstadoRenovacion).toHaveBeenCalledWith('pol-acc-118204');
  });

  it('si el motor no pudo recotizar avisa que se mantienen las condiciones', async () => {
    api.consultarCondicionesRenovacion.mockReturnValue(of({ ...CONDICIONES, recotizada: false, descuento: 0 }));

    await renderizar();

    expect(screen.getByText('Mantenemos tus condiciones')).toBeTruthy();
    expect(screen.queryByText('Condiciones recotizadas')).toBeNull();
  });

  it('sin medio de pago registrado lo dice y lo pedirá al pagar', async () => {
    api.consultarCondicionesRenovacion.mockReturnValue(of({ ...CONDICIONES, medioDePago: null }));

    await renderizar();

    expect(screen.getByText(/Sin medio registrado/)).toBeTruthy();
  });

  it('sin aceptar las condiciones no renueva y señala la casilla', async () => {
    await renderizar();

    await renovar();

    expect(api.renovarPoliza).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('debes aceptar las condiciones renovadas');
  });

  it('al aceptar renueva una sola vez y sigue el cobro hasta confirmarlo (criterio 2)', async () => {
    vi.useFakeTimers();
    api.consultarEstadoRenovacion.mockReturnValueOnce(sinRenovacion());
    await renderizar();
    api.consultarEstadoRenovacion.mockReturnValue(of(RENOVADA));

    // Con relojes simulados `userEvent` no avanza: se usan eventos directos.
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto las condiciones renovadas/ }));
    fireEvent.click(screen.getByRole('button', { name: /Renovar y pagar/ }));

    expect(api.renovarPoliza).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Estamos cobrando tu renovación')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS);

    expect(await screen.findByRole('heading', { level: 1, name: 'Renovación confirmada' })).toBeTruthy();
    expect(screen.getByText(/continúa sin interrupción desde el 2 de octubre de 2026/)).toBeTruthy();
    expect(screen.getByText('Activa · renovada')).toBeTruthy();
    expect(screen.getByText('pol-ren-pol-acc-118204-20261002')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Descargar certificado renovado' }).getAttribute('href')).toBe(
      '/embebido/poliza-emitida/pol-ren-pol-acc-118204-20261002',
    );
  });

  it('una renovación ya confirmada se muestra directamente, sin pedir condiciones', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(of(RENOVADA));

    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Renovación confirmada' })).toBeTruthy();
    expect(screen.getByText('8 % por buena experiencia')).toBeTruthy();
    expect(api.consultarCondicionesRenovacion).not.toHaveBeenCalled();
  });

  it('fuera de la ventana no hay opción de renovar (criterio 3)', async () => {
    api.consultarCondicionesRenovacion.mockReturnValue(falla('renewal_not_available'));

    await renderizar();

    expect(screen.getByText('La renovación no está disponible')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Renovar y pagar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('link', { name: /Mis pólizas/ }).length).toBeGreaterThan(0);
    expect(api.renovarPoliza).not.toHaveBeenCalled();
  });

  it('si la ventana cierra mientras el asegurado lee, pasa a «no disponible»', async () => {
    api.renovarPoliza.mockReturnValue(falla('renewal_not_available'));
    await renderizar();

    await aceptar();
    await renovar();

    expect(screen.getByText('La renovación no está disponible')).toBeTruthy();
  });

  it('si el periodo ya se había aceptado (otra pestaña) muestra su estado', async () => {
    api.renovarPoliza.mockReturnValue(falla('renewal_closed'));
    await renderizar();
    api.consultarEstadoRenovacion.mockReturnValue(of(RENOVADA));

    await aceptar();
    await renovar();

    expect(await screen.findByRole('heading', { level: 1, name: 'Renovación confirmada' })).toBeTruthy();
  });

  it('un fallo al renovar avisa que la solicitud no se pierde y deja reintentar', async () => {
    api.renovarPoliza.mockReturnValueOnce(falla('renewal_unavailable'));
    await renderizar();

    await aceptar();
    await renovar();

    expect(screen.getByRole('alert').textContent).toContain('tu solicitud no se pierde');
    await renovar();
    expect(api.renovarPoliza).toHaveBeenCalledTimes(2);
  });

  it('con el pago rechazado conserva la solicitud y permite probar con otro medio hasta el plazo (criterio 4)', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(of(RECHAZADA));
    api.entregarMedioDePago.mockReturnValue(of(mapearCobro(COBRO_RENOVACION_DTO)));

    const { fixture } = await renderizar();

    expect(screen.getByText('Tu pago fue rechazado')).toBeTruthy();
    expect(screen.getByText(/Tu solicitud de renovación sigue guardada/)).toBeTruthy();
    expect(screen.getByText(/antes del 22 de septiembre de 2026/)).toBeTruthy();
    const formulario = fixture.debugElement.query(By.directive(FormularioMedioPagoComponent));
    expect(formulario).not.toBeNull();

    (formulario.componentInstance as FormularioMedioPagoComponent).medioElegido.emit({
      tipo: 'card',
      token: 'tok_otra',
      marca: 'mastercard',
      ultimosCuatro: '4444',
      cuotas: 1,
    });

    expect(api.entregarMedioDePago).toHaveBeenCalledWith('ren-pol-acc-118204-20261002', {
      tipo: 'card',
      token: 'tok_otra',
      marca: 'mastercard',
      ultimosCuatro: '4444',
      cuotas: 1,
    });
    expect(api.renovarPoliza).not.toHaveBeenCalled();
  });

  it('si el plazo ya venció al entregar el medio, lo dice y vuelve a leer el estado', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(of(RECHAZADA));
    api.entregarMedioDePago.mockReturnValue(throwError(() => new ErrorCobro('charge_not_payable')));
    const { fixture } = await renderizar();
    api.consultarEstadoRenovacion.mockReturnValue(of(NO_RENOVADA));

    (fixture.debugElement.query(By.directive(FormularioMedioPagoComponent)).componentInstance as FormularioMedioPagoComponent).medioElegido.emit({
      tipo: 'pse',
      codigoBanco: '1007',
      tipoDePersona: 'natural',
    });
    fixture.detectChanges();

    expect(await screen.findByText('Tu póliza no se renovó')).toBeTruthy();
    expect(screen.getByText(/El pago no se completó dentro del plazo/)).toBeTruthy();
  });

  it('sin medio de pago registrado pide entregarlo, con la misma solicitud', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(of(SIN_MEDIO));

    const { fixture } = await renderizar();

    expect(screen.getByText('Indícanos con qué pagar')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(FormularioMedioPagoComponent))).not.toBeNull();
  });

  it('un cobro en excepción dice que operaciones lo revisa y no pide otro medio', async () => {
    const enExcepcion: Renovacion = {
      ...RECHAZADA,
      cobro: RECHAZADA.cobro ? { ...RECHAZADA.cobro, motivoFalla: 'retry_window_expired' } : null,
    };
    api.consultarEstadoRenovacion.mockReturnValue(of(enExcepcion));

    const { fixture } = await renderizar();

    expect(screen.getByText('Estamos revisando tu renovación')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(FormularioMedioPagoComponent))).toBeNull();
  });

  it('una póliza no renovada por falta de respuesta lo dice (criterio 5)', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(
      of({ ...NO_RENOVADA, resumen: { ...NO_RENOVADA.resumen, motivo: 'no_response' as const } }),
    );

    await renderizar();

    expect(screen.getByText('Tu póliza no se renovó')).toBeTruthy();
    expect(screen.getByText(/No recibimos tu respuesta antes de que cerrara la ventana/)).toBeTruthy();
  });

  it('una póliza inexistente ofrece volver a Mis pólizas', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(falla('policy_not_found'));

    await renderizar();

    expect(screen.getByRole('heading', { name: 'No encontramos la póliza' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mis pólizas' }).getAttribute('href')).toBe('/originacion/polizas');
  });

  it('si falla la consulta avisa y deja reintentar', async () => {
    api.consultarEstadoRenovacion.mockReturnValue(falla('renewal_unavailable'));
    await renderizar();
    api.consultarEstadoRenovacion.mockReturnValue(sinRenovacion());

    expect(screen.getByRole('alert').textContent).toContain('Intenta de nuevo en unos momentos');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Renovar póliza' })).toBeTruthy();
  });

  it('si fallan las condiciones por otro motivo avisa y deja reintentar', async () => {
    api.consultarCondicionesRenovacion.mockReturnValue(falla('renewal_unavailable'));

    await renderizar();

    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('un fallo del seguimiento no interrumpe: vuelve a preguntar', async () => {
    vi.useFakeTimers();
    api.consultarEstadoRenovacion.mockReturnValueOnce(sinRenovacion());
    await renderizar();
    api.consultarEstadoRenovacion.mockReturnValueOnce(falla('renewal_unavailable')).mockReturnValue(of(RENOVADA));
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto las condiciones renovadas/ }));
    fireEvent.click(screen.getByRole('button', { name: /Renovar y pagar/ }));

    await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS * 2);

    expect(await screen.findByRole('heading', { level: 1, name: 'Renovación confirmada' })).toBeTruthy();
  });
});
