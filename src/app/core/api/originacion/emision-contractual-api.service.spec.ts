import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { EMISION_COMPLETADA_DTO } from '@testing/emision-contractual-pruebas';

import { ErrorEmisionContractual, mapearEmisionContractual } from './emision-contractual.modelos';
import { OriginacionApiService } from './originacion-api.service';

describe('OriginacionApiService · emisión contractual (HU-W1.3-03)', () => {
  const GATEWAY = CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '');
  let servicio: OriginacionApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(OriginacionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el estado de la emisión y devuelve el modelo del cliente', () => {
    let resultado: unknown;
    servicio.consultarEmisionContractual('pol/1').subscribe((e) => (resultado = e));

    const peticion = http.expectOne(`${GATEWAY}/v1/policies/pol%2F1/issuance-status`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(EMISION_COMPLETADA_DTO);

    expect(resultado).toEqual(mapearEmisionContractual(EMISION_COMPLETADA_DTO));
  });

  it('una póliza sin emisión es policy_not_found', () => {
    let error: unknown;
    servicio.consultarEmisionContractual('pol-1').subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne(`${GATEWAY}/v1/policies/pol-1/issuance-status`)
      .flush({ error: 'policy_not_found', message: 'm' }, { status: 404, statusText: 'Not Found' });

    expect(error).toBeInstanceOf(ErrorEmisionContractual);
    expect((error as ErrorEmisionContractual).codigo).toBe('policy_not_found');
  });

  it('descarga el PDF como blob', () => {
    let resultado: Blob | undefined;
    servicio.descargarDocumentoContractual('pol-1').subscribe((b) => (resultado = b));

    const peticion = http.expectOne(`${GATEWAY}/v1/policies/pol-1/contract-document`);
    expect(peticion.request.responseType).toBe('blob');
    peticion.flush(new Blob(['%PDF-1']));

    expect(resultado?.size).toBe(6);
  });

  it('un fallo al descargar llega como ErrorEmisionContractual', () => {
    let error: unknown;
    servicio.descargarDocumentoContractual('pol-1').subscribe({ error: (e: unknown) => (error = e) });

    http.expectOne(`${GATEWAY}/v1/policies/pol-1/contract-document`).flush(new Blob(['{}']), { status: 403, statusText: 'Forbidden' });

    expect((error as ErrorEmisionContractual).codigo).toBe('forbidden');
  });
});
