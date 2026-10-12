import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env/environment';

import { OriginacionApiService } from './originacion-api.service';
import { PerfilRiesgoDto, mapearPerfilRiesgo } from './perfil-riesgo.modelos';

const DTO: PerfilRiesgoDto = {
  customer_id: 'cli-1',
  mode: 'normal',
  source: 'external_sources',
  profile: { score: 712.5, category: 'B' },
  profile_date: '2026-10-11T10:00:00Z',
  unavailable_source: null,
  notice: null,
  partial: true,
  sources: [
    { name: 'open_finance', status: 'ok', latency_ms: 90 },
    { name: 'open_data', status: 'timeout', latency_ms: 120 },
  ],
};

describe('OriginacionApiService', () => {
  let servicio: OriginacionApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(OriginacionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('publica el cuerpo del contrato (snake_case) en el API Gateway y devuelve el modelo del cliente', () => {
    let resultado: unknown;
    servicio
      .resolverPerfilRiesgo({ clienteId: 'cli-1', consentimientoActivo: true })
      .subscribe((perfil) => (resultado = perfil));

    const peticion = http.expectOne(`${environment.apiGatewayUrl}/v1/risk-profiles/resolve`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ customer_id: 'cli-1', consent_active: true });
    peticion.flush(DTO);

    expect(resultado).toEqual(mapearPerfilRiesgo(DTO));
  });

  it('propaga el error 422 de consentimiento para que la página muestre su estado', () => {
    let estado: number | undefined;
    servicio
      .resolverPerfilRiesgo({ clienteId: 'cli-1', consentimientoActivo: false })
      .subscribe({ error: (error: { status: number }) => (estado = error.status) });

    http
      .expectOne(`${environment.apiGatewayUrl}/v1/risk-profiles/resolve`)
      .flush({ error: 'consent_required', message: 'sin consentimiento' }, { status: 422, statusText: 'Unprocessable' });

    expect(estado).toBe(422);
  });
});

describe('mapearPerfilRiesgo', () => {
  it('traduce el perfil y las fuentes del contrato', () => {
    expect(mapearPerfilRiesgo(DTO)).toEqual({
      clienteId: 'cli-1',
      modo: 'normal',
      origen: 'external_sources',
      puntaje: 712.5,
      categoria: 'B',
      fechaPerfil: '2026-10-11T10:00:00Z',
      fuenteNoDisponible: null,
      aviso: null,
      parcial: true,
      fuentes: [
        { nombre: 'open_finance', estado: 'ok', latenciaMs: 90 },
        { nombre: 'open_data', estado: 'timeout', latenciaMs: 120 },
      ],
    });
  });

  it('conserva el perfil base provisional sin fecha ni fuentes', () => {
    const perfil = mapearPerfilRiesgo({
      ...DTO,
      mode: 'provisional',
      source: 'base_actuarial',
      profile_date: null,
      unavailable_source: 'open_finance',
      notice: 'personalization_unavailable',
      partial: false,
      sources: [],
    });

    expect(perfil.fechaPerfil).toBeNull();
    expect(perfil.aviso).toBe('personalization_unavailable');
    expect(perfil.fuentes).toEqual([]);
  });
});
