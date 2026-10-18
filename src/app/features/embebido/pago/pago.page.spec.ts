import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import { COBRO_PENDIENTE_DTO } from '@testing/cobro-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { Cobro, ErrorCobro, mapearCobro } from '@core/api/originacion/cobro.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { PasarelaPagosService } from '@core/api/pasarela/pasarela.service';

import { CLAVE_TRAMITE_ACEPTACION } from '../aceptacion-oferta/servicios/tramite-aceptacion.service';
import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';
import { ACCIONES_PAGO, AccionesPago } from './pago.config';
import { PagoPage } from './pago.page';

type Llamada = ReturnType<typeof vi.fn<(id: string) => Observable<Cobro>>>;

const PENDIENTE = mapearCobro(COBRO_PENDIENTE_DTO);

function cobro(cambios: Partial<Cobro> = {}): Cobro {
  return { ...PENDIENTE, ...cambios };
}

const PROCESANDO = cobro({ intentos: 0, ultimaFallaEn: null, proximoIntentoEn: null });
/** E4: el cobro existe desde la aceptación pero espera el medio de pago. */
const ESPERANDO_TARJETA = cobro({
  intentos: 0,
  ultimoIntentoEn: null,
  ultimaFallaEn: null,
  proximoIntentoEn: null,
  medioDePago: null,
  intentoDePago: 0,
});
const CONFIRMADO = cobro({
  estado: 'confirmed',
  intentos: 3,
  proximoIntentoEn: null,
  confirmadoEn: '2026-10-16T19:06:00Z',
  polizaId: 'pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
  coberturaActivadaEn: '2026-10-16T19:06:00Z',
  activacionPublicadaEn: '2026-10-16T19:06:00.1Z',
});

describe('PagoPage (E4b · HA-D02)', () => {
  let consultar: Llamada;
  let entregar: ReturnType<typeof vi.fn>;
  let tokenizar: ReturnType<typeof vi.fn>;
  let manejador: { handleError: ReturnType<typeof vi.fn> };

  async function renderizar({
    aceptacionId = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc' as string | null,
    respuesta = of(PENDIENTE) as Observable<Cobro>,
    acciones = null as AccionesPago | null,
  } = {}) {
    consultar = vi.fn().mockReturnValue(respuesta);
    entregar = vi.fn().mockReturnValue(of(PENDIENTE));
    tokenizar = vi.fn().mockReturnValue(of({ token: 'tok_pruebas', marca: 'visa', ultimosCuatro: '1111' }));
    manejador = { handleError: vi.fn() };
    return render(PagoPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: ErrorHandler, useValue: manejador },
        { provide: OriginacionApiService, useValue: { consultarCobro: consultar, entregarMedioDePago: entregar } },
        { provide: PasarelaPagosService, useValue: { tokenizar } },
        ...(acciones ? [{ provide: ACCIONES_PAGO, useValue: acciones }] : []),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(aceptacionId ? { aceptacionId } : {}) } },
        },
      ],
    });
  }

  function titulo(): string {
    return screen.getByRole('heading', { level: 1 }).textContent?.trim() ?? '';
  }

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('muestra el pago pendiente con la aceptación guardada, la clave y los intentos (CA-2)', async () => {
    await renderizar();

    expect(consultar).toHaveBeenCalledWith('6f1c2a9e-1b2c-4d5e-8f90-123456789abc');
    expect(titulo()).toBe('Tu pago está pendiente');
    expect(screen.getAllByText('Pago pendiente').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tu aceptación quedó guardada y reintentaremos el cobro/)).toBeTruthy();
    expect(screen.getByText('cobro-6f1c2a9e-1b2c-4d5e-8f90-123456789abc (idempotente)')).toBeTruthy();
    expect(screen.getByText('Intentos sin respuesta: 3')).toBeTruthy();
    expect(screen.getByText('Se activa al confirmarse el pago')).toBeTruthy();
    expect(screen.getByText('Qué pasa después')).toBeTruthy();
    expect(screen.getByText(/Te avisaremos por correo cuando el pago se confirme/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Historial del cobro' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continuar con mi crédito/ }).getAttribute('href')).toBe('/inicio');
    expect(screen.queryByRole('button', { name: /otro medio de pago/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Ver mi póliza/ })).toBeNull();
  });

  it('el destino de «Ver mi póliza» es configurable', async () => {
    await renderizar({
      respuesta: of(CONFIRMADO),
      acciones: { verPoliza: '/otra/poliza', salir: '/inicio', verAceptacion: '/embebido/oferta' },
    });

    expect(screen.getByRole('link', { name: /Ver mi póliza/ }).getAttribute('href')).toBe(
      '/otra/poliza/pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
    );
  });

  it('muestra el próximo reintento en curso cuando el backend no informa la hora', async () => {
    await renderizar({ respuesta: of(cobro({ proximoIntentoEn: null })) });

    expect(screen.getAllByText('En curso').length).toBe(2);
  });

  it('sin intentos fallidos muestra que el pago se está procesando', async () => {
    await renderizar({ respuesta: of(PROCESANDO) });

    expect(titulo()).toBe('Estamos procesando tu pago');
    expect(screen.getByRole('progressbar', { name: 'Procesando el pago' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Historial del cobro' })).toBeNull();
  });

  it('con el pago confirmado y la póliza muestra la cobertura activa', async () => {
    await renderizar({ respuesta: of(CONFIRMADO) });

    expect(titulo()).toBe('Pago confirmado');
    expect(screen.getByText(/Tu cobertura quedó activa el .* estamos emitiendo tu póliza/)).toBeTruthy();
    expect(screen.getByText('pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc')).toBeTruthy();
    expect(screen.getByText(/Activa desde/)).toBeTruthy();
    expect(screen.queryByText('Qué pasa después')).toBeNull();
    expect(screen.getByRole('link', { name: /Ver mi póliza/ }).getAttribute('href')).toBe(
      '/embebido/poliza-emitida/pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
    );
    expect(screen.getByRole('link', { name: /Continuar con mi crédito/ }).getAttribute('href')).toBe('/inicio');
  });

  it('confirmado sin póliza todavía informa que se activa la cobertura y sigue consultando', async () => {
    vi.useFakeTimers();
    const sinPoliza = cobro({ estado: 'confirmed', proximoIntentoEn: null });
    await renderizar({ respuesta: of(sinPoliza) });
    consultar.mockReturnValue(of(CONFIRMADO));

    expect(screen.getByText('Recibimos tu pago. Estamos activando tu cobertura.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Ver mi póliza/ })).toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(consultar).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc')).toBeTruthy();
  });

  it('una ventana vencida es una excepción que gestiona operaciones (CA-3)', async () => {
    await renderizar({
      respuesta: of(cobro({ estado: 'failed', motivoFalla: 'retry_window_expired', proximoIntentoEn: null })),
    });

    expect(titulo()).toBe('No pudimos completar el cobro');
    expect(screen.getByRole('alert').textContent).toContain('Un analista de operaciones gestionará tu caso');
    expect(screen.getByText('En gestión')).toBeTruthy();
  });

  // HU-W1.3-02: un rechazo ya no manda al cliente a esperar a operaciones.
  // Es E4c, y puede intentar con otra tarjeta sin perder su aceptación.
  it('un pago rechazado ofrece intentar con otro medio de pago', async () => {
    await renderizar({ respuesta: of(cobro({ estado: 'failed', motivoFalla: 'payment_rejected' })) });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Tu pago fue rechazado');
    expect(screen.getByRole('button', { name: /Pagar con esta tarjeta/i })).toBeTruthy();
  });

  it('sin identificador en la URL usa la aceptación guardada en sessionStorage', async () => {
    sessionStorage.setItem(CLAVE_TRAMITE_ACEPTACION, JSON.stringify({ ofertaId: 'demo-active-1', aceptacionId: 'a-9' }));

    await renderizar({ aceptacionId: null });

    expect(consultar).toHaveBeenCalledWith('a-9');
  });

  it('sin aceptación en la URL ni en la sesión lleva de vuelta a la oferta', async () => {
    await renderizar({ aceptacionId: null });

    expect(consultar).not.toHaveBeenCalled();
    expect(titulo()).toBe('No encontramos tu solicitud');
    expect(screen.getByRole('link', { name: 'Ver el estado de tu aceptación' }).getAttribute('href')).toBe(
      '/embebido/oferta',
    );
  });

  it('una aceptación sin cobro informa que el pago no ha empezado', async () => {
    await renderizar({ respuesta: throwError(() => new ErrorCobro('charge_not_found')) });

    expect(titulo()).toBe('Tu pago aún no se ha iniciado');
    expect(manejador.handleError).not.toHaveBeenCalled();
  });

  it('un error inesperado se registra y permite reintentar', async () => {
    await renderizar({ respuesta: throwError(() => new ErrorCobro('invalid_request')) });

    expect(titulo()).toBe('No pudimos consultar tu pago');
    expect(manejador.handleError).toHaveBeenCalled();

    consultar.mockReturnValue(of(PENDIENTE));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Tu pago está pendiente' })).toBeTruthy();
  });

  it('ante 401 o 403 deja la redirección al interceptor', async () => {
    await renderizar({ respuesta: throwError(() => new ErrorCobro('forbidden')) });

    expect(titulo()).toBe('Consultando el estado de tu pago');
    expect(manejador.handleError).not.toHaveBeenCalled();
  });

  it('con la solicitud del crédito muestra la tarjeta y el contexto', async () => {
    await renderizar();
    TestBed.inject(FlujoEmbebidoService).solicitud.set({
      numero: '48213',
      aliado: 'Banco Aliado',
      banco: 'Banco Aliado',
      montoAprobado: 250_000_000,
      plazoAnios: 20,
      cuotaEstimada: 2_180_000,
      moneda: 'COP',
    });

    expect(await screen.findByText(/48213/)).toBeTruthy();
  });

  // --- E4 · captura del medio de pago (HU-W1.3-02) -------------------------

  it('sin medio de pago pide la tarjeta en vez de decir que se está cobrando', async () => {
    await renderizar({ respuesta: of(ESPERANDO_TARJETA) });

    expect(titulo()).toContain('Paga tu primera prima');
    expect(screen.getByLabelText(/Número de tarjeta/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pagar mi primera prima/i })).toBeTruthy();
  });

  // El estado se decide por el medio de pago, no por el contador de intentos:
  // esperando la tarjeta y la pasarela fallando son los dos `pending`.
  it('con medio de pago y la pasarela fallando muestra el pago pendiente, no el formulario', async () => {
    await renderizar({ respuesta: of(PENDIENTE) });

    expect(screen.queryByLabelText(/Número de tarjeta/i)).toBeNull();
  });

  it('entrega a originación solo el token, nunca el número de la tarjeta', async () => {
    await renderizar({ respuesta: of(ESPERANDO_TARJETA) });

    fireEvent.input(screen.getByLabelText(/Número de tarjeta/i), { target: { value: '4111 1111 1111 1111' } });
    fireEvent.input(screen.getByLabelText(/Vencimiento/i), { target: { value: '11/28' } });
    fireEvent.input(screen.getByLabelText(/Código de seguridad/i), { target: { value: '123' } });
    fireEvent.input(screen.getByLabelText(/Nombre del titular/i), { target: { value: 'CAROLINA PEREZ' } });
    fireEvent.click(screen.getByRole('button', { name: /Pagar mi primera prima/i }));
    await new Promise((listo) => setTimeout(listo, 0));

    expect(entregar).toHaveBeenCalledTimes(1);
    const [, medio] = entregar.mock.calls[0] as [string, Record<string, unknown>];
    expect(medio['token']).toBe('tok_pruebas');
    expect(JSON.stringify(medio)).not.toContain('4111');
  });

  it('una tarjeta que no pasa la comprobación no llega a la pasarela', async () => {
    await renderizar({ respuesta: of(ESPERANDO_TARJETA) });

    fireEvent.input(screen.getByLabelText(/Número de tarjeta/i), { target: { value: '4111 1111 1111 1112' } });
    fireEvent.input(screen.getByLabelText(/Vencimiento/i), { target: { value: '11/28' } });
    fireEvent.input(screen.getByLabelText(/Código de seguridad/i), { target: { value: '123' } });
    fireEvent.input(screen.getByLabelText(/Nombre del titular/i), { target: { value: 'CAROLINA PEREZ' } });
    fireEvent.click(screen.getByRole('button', { name: /Pagar mi primera prima/i }));
    await new Promise((listo) => setTimeout(listo, 0));

    expect(tokenizar).not.toHaveBeenCalled();
    expect(entregar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('no corresponde a una tarjeta válida');
  });
});
