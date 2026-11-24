import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { DESEMPENO_DEGRADADO_DTO } from '@testing/desempeno-pruebas';

import { ErrorDesempeno, mapearDesempeno, traducirErrorDesempeno } from './desempeno.modelos';
import { SociosApiService } from './socios-api.service';

describe('desempeño técnico de la API de socios (HU-W3.2-03)', () => {
  it('traduce el estado, la disponibilidad, el p95 y los incidentes', () => {
    const d = mapearDesempeno(DESEMPENO_DEGRADADO_DTO);

    expect(d.estado).toBe('degraded');
    expect(d.disponibilidad).toEqual({ porcentaje: 99.96, objetivo: 99.9, peticiones: 10000, errores: 4 });
    expect(d.latencia).toEqual({ p95Ms: 1150, presupuestoMs: 400 });
    expect(d.incidentes[0]).toEqual({
      id: 'solventa-stg-slo-latency-post-offers-20260916T212000Z',
      tipo: 'degraded',
      ruta: 'POST /v1/offers',
      inicio: '2026-09-16T21:20:00Z',
      fin: null,
      duracionSegundos: 2520,
      resuelto: false,
    });
    expect(d.incidentes[1].resuelto).toBe(true);
  });

  it('un estado o tipo que el cliente no conoce llega como desconocido', () => {
    const d = mapearDesempeno({
      ...DESEMPENO_DEGRADADO_DTO,
      status: 'maintenance',
      incidents: [{ ...DESEMPENO_DEGRADADO_DTO.incidents[0], kind: 'other' }],
    });

    expect(d.estado).toBe('desconocido');
    expect(d.incidentes[0].tipo).toBe('desconocido');
  });

  it('decide el error por el código del contrato y, sin él, por el estado', () => {
    const conCodigo = new HttpErrorResponse({ status: 503, error: { error: 'telemetry_unavailable', message: 'm' } });
    expect(traducirErrorDesempeno(conCodigo).codigo).toBe('telemetry_unavailable');
    expect(traducirErrorDesempeno(new HttpErrorResponse({ status: 400 })).codigo).toBe('invalid_request');
    expect(traducirErrorDesempeno(new HttpErrorResponse({ status: 401 })).codigo).toBe('unauthorized');
    expect(traducirErrorDesempeno(new HttpErrorResponse({ status: 403 })).codigo).toBe('forbidden');
    expect(traducirErrorDesempeno(new HttpErrorResponse({ status: 502 })).codigo).toBe('telemetry_unavailable');
    expect(traducirErrorDesempeno(new Error('x')).codigo).toBe('telemetry_unavailable');
  });

  describe('SociosApiService.consultarDesempeno', () => {
    let servicio: SociosApiService;
    let http: HttpTestingController;
    const ruta = `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}/v1/partner-performance`;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      servicio = TestBed.inject(SociosApiService);
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('pide el periodo y devuelve el desempeño traducido', () => {
      let recibido: unknown;
      servicio.consultarDesempeno('30d').subscribe((d) => (recibido = d));

      const peticion = http.expectOne((r) => r.url === ruta);
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.toString()).toBe('period=30d');
      peticion.flush(DESEMPENO_DEGRADADO_DTO);

      expect(recibido).toEqual(mapearDesempeno(DESEMPENO_DEGRADADO_DTO));
    });

    it('falla con telemetry_unavailable si CloudWatch no respondió', () => {
      let error: ErrorDesempeno | undefined;
      servicio.consultarDesempeno('today').subscribe({ error: (e: ErrorDesempeno) => (error = e) });

      http
        .expectOne((r) => r.url === ruta)
        .flush({ error: 'telemetry_unavailable', message: 'm' }, { status: 503, statusText: 'Service Unavailable' });

      expect(error?.codigo).toBe('telemetry_unavailable');
    });
  });
});
