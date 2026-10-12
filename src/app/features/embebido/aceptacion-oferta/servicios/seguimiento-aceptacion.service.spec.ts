import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { Aceptacion, ErrorAceptacion } from '@core/api/originacion/aceptacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import {
  ESPERA_MAXIMA_MS,
  INTERVALO_CONSULTA_LENTA_MS,
  INTERVALO_CONSULTA_MS,
  SeguimientoAceptacionService,
  UMBRAL_CONSULTA_LENTA_MS,
  esperaSiguienteConsulta,
} from './seguimiento-aceptacion.service';
import { CLAVE_TRAMITE_ACEPTACION } from './tramite-aceptacion.service';

const AHORA = Date.parse('2026-10-12T01:54:41Z');

function aceptacion(cambios: Partial<Aceptacion> = {}): Aceptacion {
  return {
    aceptacionId: 'a-1',
    ofertaId: 'demo-active-1',
    clienteId: 'sub-asegurado',
    canal: 'web',
    aceptadaEn: '2026-10-12T01:54:41Z',
    estado: 'registered',
    suscripcion: null,
    procesamiento: { intentos: 0, ultimaFallaEn: null, proximoIntentoEn: null },
    actualizadaEn: '2026-10-12T01:54:41Z',
    ...cambios,
  };
}

function conIntentos(intentos: number, proximoEnMs: number): Aceptacion {
  return aceptacion({
    procesamiento: {
      intentos,
      ultimaFallaEn: new Date(AHORA).toISOString(),
      proximoIntentoEn: new Date(AHORA + proximoEnMs).toISOString(),
    },
  });
}

describe('esperaSiguienteConsulta (contrato §6)', () => {
  it('consulta cada 2 s mientras no haya fallas', () => {
    expect(esperaSiguienteConsulta(aceptacion(), 5_000, AHORA)).toBe(INTERVALO_CONSULTA_MS);
  });

  it('con un próximo intento a más de 2 s espera hasta ese intento más 1 s', () => {
    expect(esperaSiguienteConsulta(conIntentos(2, 4_000), 5_000, AHORA)).toBe(5_000);
  });

  it('con un próximo intento cercano mantiene los 2 s', () => {
    expect(esperaSiguienteConsulta(conIntentos(1, 1_500), 5_000, AHORA)).toBe(INTERVALO_CONSULTA_MS);
  });

  it('no espera más del tope aunque el reloj del servidor esté adelantado', () => {
    expect(esperaSiguienteConsulta(conIntentos(3, 10 * 60_000), 5_000, AHORA)).toBe(ESPERA_MAXIMA_MS);
  });

  it('tras 2 minutos baja la frecuencia a cada 15 s', () => {
    expect(esperaSiguienteConsulta(aceptacion(), UMBRAL_CONSULTA_LENTA_MS, AHORA)).toBe(
      INTERVALO_CONSULTA_LENTA_MS,
    );
  });
});

describe('SeguimientoAceptacionService', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<Aceptacion>>>;
  let consultarDeOferta: ReturnType<typeof vi.fn<(id: string) => Observable<Aceptacion>>>;
  let servicio: SeguimientoAceptacionService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    consultar = vi.fn();
    consultarDeOferta = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        SeguimientoAceptacionService,
        {
          provide: OriginacionApiService,
          useValue: { consultarAceptacion: consultar, consultarAceptacionDeOferta: consultarDeOferta },
        },
      ],
    });
    servicio = TestBed.inject(SeguimientoAceptacionService);
  });

  afterEach(() => {
    servicio.detener();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('hace la primera consulta 1 s después y se detiene en issuance_pending', async () => {
    consultar.mockReturnValue(of(aceptacion({ estado: 'issuance_pending' })));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(999);
    expect(consultar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(consultar).toHaveBeenCalledWith('a-1');
    expect(servicio.aceptacion()?.estado).toBe('issuance_pending');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it('se detiene en in_review', async () => {
    consultar.mockReturnValue(of(aceptacion({ estado: 'in_review' })));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(30_000);

    expect(consultar).toHaveBeenCalledTimes(1);
    expect(servicio.aceptacion()?.estado).toBe('in_review');
  });

  it('no consulta si la aceptación ya llega en un estado final', async () => {
    servicio.seguir(aceptacion({ estado: 'in_review' }));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(consultar).not.toHaveBeenCalled();
  });

  it('mientras siga registered consulta cada 2 s', async () => {
    consultar.mockReturnValue(of(aceptacion()));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 * 3);

    expect(consultar).toHaveBeenCalledTimes(4);
  });

  it('con fallas posteriores espera hasta el próximo intento del backend', async () => {
    consultar.mockImplementation(() => of(conIntentos(2, Date.now() - AHORA + 4_000)));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(consultar).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(consultar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('a los 2 minutos en registered pasa a modo lento y consulta cada 15 s', async () => {
    consultar.mockReturnValue(of(aceptacion()));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(UMBRAL_CONSULTA_LENTA_MS + 1_000);
    expect(servicio.lento()).toBe(true);
    const llamadas = consultar.mock.calls.length;

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_LENTA_MS - 1);
    expect(consultar).toHaveBeenCalledTimes(llamadas);
    await vi.advanceTimersByTimeAsync(1);
    expect(consultar).toHaveBeenCalledTimes(llamadas + 1);
  });

  it('ante acceptance_unavailable conserva el último estado y sigue con el mismo intervalo', async () => {
    const conFalla = conIntentos(1, 1_000);
    consultar
      .mockReturnValueOnce(throwError(() => new ErrorAceptacion('acceptance_unavailable')))
      .mockReturnValue(of(aceptacion({ estado: 'issuance_pending' })));

    servicio.seguir(conFalla);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(servicio.aceptacion()).toEqual(conFalla);
    expect(servicio.error()).toBeNull();

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_MS);
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(servicio.aceptacion()?.estado).toBe('issuance_pending');
  });

  it.each(['unauthorized', 'forbidden', 'invalid_request'] as const)(
    'ante %s se detiene y publica el error',
    async (codigo) => {
      consultar.mockReturnValue(throwError(() => new ErrorAceptacion(codigo)));

      servicio.seguir(aceptacion());
      await vi.advanceTimersByTimeAsync(30_000);

      expect(consultar).toHaveBeenCalledTimes(1);
      expect(servicio.error()?.codigo).toBe(codigo);
    },
  );

  it('si el identificador ya no existe retoma por la oferta y sigue con la aceptación que devuelve', async () => {
    consultar
      .mockReturnValueOnce(throwError(() => new ErrorAceptacion('acceptance_not_found')))
      .mockReturnValue(of(aceptacion({ aceptacionId: 'a-2', estado: 'issuance_pending' })));
    consultarDeOferta.mockReturnValue(of(aceptacion({ aceptacionId: 'a-2' })));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(consultarDeOferta).toHaveBeenCalledWith('demo-active-1');
    expect(servicio.aceptacion()?.aceptacionId).toBe('a-2');

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_MS);
    expect(consultar).toHaveBeenLastCalledWith('a-2');
    expect(servicio.aceptacion()?.estado).toBe('issuance_pending');
  });

  it('si la oferta tampoco tiene aceptación se detiene, publica acceptance_not_found y borra el trámite', async () => {
    consultar.mockReturnValue(throwError(() => new ErrorAceptacion('acceptance_not_found')));
    consultarDeOferta.mockReturnValue(throwError(() => new ErrorAceptacion('acceptance_not_found')));

    servicio.seguir(aceptacion());
    await vi.advanceTimersByTimeAsync(1_000);

    expect(servicio.error()?.codigo).toBe('acceptance_not_found');
    expect(sessionStorage.getItem(CLAVE_TRAMITE_ACEPTACION)).toBeNull();
  });

  it('guarda la oferta y la aceptación en sessionStorage para retomar tras recargar', () => {
    servicio.seguir(aceptacion({ estado: 'in_review' }));

    expect(JSON.parse(sessionStorage.getItem(CLAVE_TRAMITE_ACEPTACION) ?? '{}')).toEqual({
      ofertaId: 'demo-active-1',
      aceptacionId: 'a-1',
    });
  });

  it('detener cancela la consulta programada', async () => {
    consultar.mockReturnValue(of(aceptacion()));

    servicio.seguir(aceptacion());
    servicio.detener();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(consultar).not.toHaveBeenCalled();
  });
});
