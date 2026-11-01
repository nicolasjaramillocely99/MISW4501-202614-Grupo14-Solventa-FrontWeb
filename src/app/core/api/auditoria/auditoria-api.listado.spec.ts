import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { PAGINA_DTO } from '@testing/listado-consentimientos-pruebas';

import { AuditoriaApiService } from './auditoria-api.service';
import { ErrorListado, FiltroConsentimientos, PaginaConsentimientos, mapearPaginaConsentimientos } from './listado-consentimientos.modelos';

describe('AuditoriaApiService · listado de consentimientos (HU-W4.2-01)', () => {
  let servicio: AuditoriaApiService;
  let http: HttpTestingController;
  const url = `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}/v1/audit/consents`;
  const filtro: FiltroConsentimientos = {
    estado: 'active',
    desde: '2026-09-01',
    hasta: null,
    entidad: null,
    cliente: 'nunez',
    pagina: 2,
    tamano: 6,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AuditoriaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista por GET con los filtros del contrato y devuelve la página con el modelo del cliente', () => {
    let resultado: PaginaConsentimientos | undefined;
    servicio.listarConsentimientos(filtro).subscribe((pagina) => (resultado = pagina));

    const peticion = http.expectOne((req) => req.url === url);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.toString()).toBe('page=2&page_size=6&status=active&granted_from=2026-09-01&q=nunez');
    peticion.flush(PAGINA_DTO);

    expect(resultado).toEqual(mapearPaginaConsentimientos(PAGINA_DTO));
  });

  it('traduce un 400 con todos los parámetros inválidos', () => {
    let error: unknown;
    servicio.listarConsentimientos(filtro).subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne((req) => req.url === url)
      .flush(
        { error: 'validation_failed', message: 'one or more fields are invalid', fields: [{ field: 'granted_to', code: 'out_of_range' }] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(error).toBeInstanceOf(ErrorListado);
    expect((error as ErrorListado).campos).toEqual([{ campo: 'hasta', codigo: 'out_of_range' }]);
  });

  it('traduce un 503 a service_unavailable', () => {
    let error: unknown;
    servicio.listarConsentimientos(filtro).subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne((req) => req.url === url)
      .flush({ error: 'service_unavailable', message: 'x' }, { status: 503, statusText: 'Service Unavailable' });

    expect((error as ErrorListado).codigo).toBe('service_unavailable');
  });
});
