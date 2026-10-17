import { TestBed } from '@angular/core/testing';
import { COBRO_PENDIENTE_DTO } from '@testing/cobro-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { Cobro, ErrorCobro, mapearCobro } from '@core/api/originacion/cobro.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import {
  ESPERA_MAXIMA_COBRO_MS,
  INTERVALO_CONSULTA_COBRO_MS,
  PRIMERA_CONSULTA_COBRO_MS,
  SeguimientoCobroService,
  esperaSiguienteConsultaCobro,
} from './seguimiento-cobro.service';

const AHORA = Date.parse('2026-10-16T19:05:13Z');

function cobro(cambios: Partial<Cobro> = {}): Cobro {
  return { ...mapearCobro(COBRO_PENDIENTE_DTO), intentos: 0, proximoIntentoEn: null, ...cambios };
}

function conReintento(intentos: number, proximoEnMs: number): Cobro {
  return cobro({ intentos, proximoIntentoEn: new Date(AHORA + proximoEnMs).toISOString() });
}

const CONFIRMADO = cobro({ estado: 'confirmed', polizaId: 'pol-1', coberturaActivadaEn: '2026-10-16T19:06:00Z' });

describe('esperaSiguienteConsultaCobro', () => {
  it('consulta cada 2 s mientras no haya intentos fallidos', () => {
    expect(esperaSiguienteConsultaCobro(cobro(), AHORA)).toBe(INTERVALO_CONSULTA_COBRO_MS);
  });

  it('con un reintento a más de 2 s espera hasta ese reintento más 1 s', () => {
    expect(esperaSiguienteConsultaCobro(conReintento(3, 8_000), AHORA)).toBe(9_000);
  });

  it('con un reintento cercano mantiene los 2 s', () => {
    expect(esperaSiguienteConsultaCobro(conReintento(1, 500), AHORA)).toBe(INTERVALO_CONSULTA_COBRO_MS);
  });

  it('no espera más del tope aunque el reloj del servidor esté adelantado', () => {
    expect(esperaSiguienteConsultaCobro(conReintento(9, 10 * 60_000), AHORA)).toBe(ESPERA_MAXIMA_COBRO_MS);
  });
});

describe('SeguimientoCobroService', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<Cobro>>>;
  let servicio: SeguimientoCobroService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    consultar = vi.fn();
    TestBed.configureTestingModule({
      providers: [SeguimientoCobroService, { provide: OriginacionApiService, useValue: { consultarCobro: consultar } }],
    });
    servicio = TestBed.inject(SeguimientoCobroService);
  });

  afterEach(() => {
    servicio.detener();
    vi.useRealTimers();
  });

  it('consulta de inmediato, otra vez 1 s después y se detiene con el cobro confirmado y su póliza', async () => {
    consultar.mockReturnValueOnce(of(cobro())).mockReturnValue(of(CONFIRMADO));

    servicio.seguir('acc-1');
    expect(consultar).toHaveBeenCalledWith('acc-1');
    expect(servicio.cobro()?.estado).toBe('pending');

    await vi.advanceTimersByTimeAsync(PRIMERA_CONSULTA_COBRO_MS);
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(servicio.cobro()?.polizaId).toBe('pol-1');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('confirmado sin póliza todavía sigue consultando hasta que llega', async () => {
    consultar
      .mockReturnValueOnce(of(cobro({ estado: 'confirmed' })))
      .mockReturnValueOnce(of(cobro({ estado: 'confirmed' })))
      .mockReturnValue(of(CONFIRMADO));

    servicio.seguir('acc-1');
    await vi.advanceTimersByTimeAsync(PRIMERA_CONSULTA_COBRO_MS + INTERVALO_CONSULTA_COBRO_MS);

    expect(consultar).toHaveBeenCalledTimes(3);
    expect(servicio.cobro()?.polizaId).toBe('pol-1');
  });

  it('se detiene en una excepción', async () => {
    consultar.mockReturnValue(of(cobro({ estado: 'failed', motivoFalla: 'retry_window_expired' })));

    servicio.seguir('acc-1');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it('con un reintento lejano espera hasta el próximo intento del backend', async () => {
    consultar
      .mockReturnValueOnce(of(cobro()))
      .mockImplementation(() => of(conReintento(4, Date.now() - AHORA + 6_000)));

    servicio.seguir('acc-1');
    await vi.advanceTimersByTimeAsync(PRIMERA_CONSULTA_COBRO_MS);
    expect(consultar).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(6_999);
    expect(consultar).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(consultar).toHaveBeenCalledTimes(3);
  });

  it('ante charge_unavailable conserva el último estado y vuelve a consultar', async () => {
    const pendiente = conReintento(1, 1_000);
    consultar
      .mockReturnValueOnce(of(pendiente))
      .mockReturnValueOnce(throwError(() => new ErrorCobro('charge_unavailable')))
      .mockReturnValue(of(CONFIRMADO));

    servicio.seguir('acc-1');
    await vi.advanceTimersByTimeAsync(PRIMERA_CONSULTA_COBRO_MS);
    expect(servicio.cobro()).toEqual(pendiente);
    expect(servicio.error()).toBeNull();

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_COBRO_MS);
    expect(servicio.cobro()?.estado).toBe('confirmed');
  });

  it('un error de red en la primera consulta se reintenta a los 2 s', async () => {
    consultar.mockReturnValueOnce(throwError(() => new Error('red'))).mockReturnValue(of(CONFIRMADO));

    servicio.seguir('acc-1');
    expect(servicio.cobro()).toBeNull();
    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_COBRO_MS);

    expect(servicio.cobro()?.estado).toBe('confirmed');
  });

  it.each(['charge_not_found', 'unauthorized', 'forbidden', 'invalid_request'] as const)(
    'ante %s se detiene y publica el error',
    async (codigo) => {
      consultar.mockReturnValue(throwError(() => new ErrorCobro(codigo)));

      servicio.seguir('acc-1');
      await vi.advanceTimersByTimeAsync(30_000);

      expect(consultar).toHaveBeenCalledTimes(1);
      expect(servicio.error()?.codigo).toBe(codigo);
    },
  );

  it('reiniciar el seguimiento cancela el anterior', async () => {
    consultar.mockReturnValue(of(cobro()));

    servicio.seguir('acc-1');
    servicio.seguir('acc-2');
    await vi.advanceTimersByTimeAsync(PRIMERA_CONSULTA_COBRO_MS);

    expect(consultar.mock.calls.map(([id]) => id)).toEqual(['acc-1', 'acc-2', 'acc-2']);
  });
});
