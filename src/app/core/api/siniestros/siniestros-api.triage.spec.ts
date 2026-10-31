import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import {
  ID_CASO_TRIAGE,
  LOTE_TRIAGE_DTO,
  POLITICA_TRIAGE_DTO,
  TRIAGE_ASEGURADO_DTO,
  TRIAGE_OPERACIONES_DTO,
} from '@testing/triage-pruebas';

import { ErrorSiniestro } from './siniestro.modelos';
import { SiniestrosApiService } from './siniestros-api.service';
import { PoliticaTriage, ResumenTriage, TriageSiniestro } from './triage.modelos';

describe('SiniestrosApiService · triage (HU-W2.2-01)', () => {
  let servicio: SiniestrosApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('consultarTriage', () => {
    it('lee la vista operations de GET /v1/claims/{id}/triage', () => {
      let resultado: TriageSiniestro | undefined;
      servicio.consultarTriage(ID_CASO_TRIAGE).subscribe((triage) => (resultado = triage));

      const peticion = http.expectOne(url(`/v1/claims/${ID_CASO_TRIAGE}/triage`));
      expect(peticion.request.method).toBe('GET');
      peticion.flush(TRIAGE_OPERACIONES_DTO);

      expect(resultado?.vista).toBe('operations');
    });

    it('lee la vista insured', () => {
      let resultado: TriageSiniestro | undefined;
      servicio.consultarTriage('abc').subscribe((triage) => (resultado = triage));

      http.expectOne(url('/v1/claims/abc/triage')).flush(TRIAGE_ASEGURADO_DTO);

      expect(resultado).toMatchObject({ vista: 'insured', nivel: 3, diasResolucion: 10 });
    });

    it('codifica el id en la ruta', () => {
      servicio.consultarTriage('../x').subscribe({ error: () => undefined });

      http.expectOne(url('/v1/claims/..%2Fx/triage')).flush({}, { status: 404, statusText: 'Not Found' });
    });

    it('traduce el 404 del contrato a claim_not_found', () => {
      let error: unknown;
      servicio.consultarTriage('x').subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne(url('/v1/claims/x/triage'))
        .flush({ error: 'claim_not_found', message: 'no' }, { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(ErrorSiniestro);
      expect((error as ErrorSiniestro).codigo).toBe('claim_not_found');
    });

    it('un 503 sin cuerpo es claims_unavailable', () => {
      let error: unknown;
      servicio.consultarTriage('x').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/x/triage')).flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect((error as ErrorSiniestro).codigo).toBe('claims_unavailable');
    });

    it('un error de red es claims_unavailable', () => {
      let error: unknown;
      servicio.consultarTriage('x').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/x/triage')).error(new ProgressEvent('error'));

      expect((error as ErrorSiniestro).codigo).toBe('claims_unavailable');
    });
  });

  describe('consultarTriageLote', () => {
    it('envía claim_id repetido en el orden pedido y devuelve una fila por id', () => {
      const ids = [uuid(3), uuid(1), uuid(2)];
      let resultado: ResumenTriage[] | undefined;
      servicio.consultarTriageLote(ids).subscribe((filas) => (resultado = filas));

      const peticion = http.expectOne((req) => req.url === url('/v1/claims/triage'));
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.getAll('claim_id')).toEqual(ids);
      expect(peticion.request.urlWithParams).toBe(
        `${url('/v1/claims/triage')}?claim_id=${ids[0]}&claim_id=${ids[1]}&claim_id=${ids[2]}`,
      );
      peticion.flush(LOTE_TRIAGE_DTO);

      expect(resultado).toHaveLength(3);
    });

    it('acepta un solo id', () => {
      servicio.consultarTriageLote([uuid(1)]).subscribe();

      const peticion = http.expectOne((req) => req.url === url('/v1/claims/triage'));
      expect(peticion.request.params.getAll('claim_id')).toEqual([uuid(1)]);
      peticion.flush({ items: [] });
    });

    it('acepta 50 ids en una sola llamada', () => {
      const ids = Array.from({ length: 50 }, (_, i) => uuid(i + 1));
      servicio.consultarTriageLote(ids).subscribe();

      const peticion = http.expectOne((req) => req.url === url('/v1/claims/triage'));
      expect(peticion.request.params.getAll('claim_id')).toEqual(ids);
      peticion.flush({ items: [] });
    });

    it('traduce el 400 del contrato a invalid_request', () => {
      let error: unknown;
      servicio.consultarTriageLote(['x']).subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne((req) => req.url === url('/v1/claims/triage'))
        .flush({ error: 'invalid_request', message: 'x' }, { status: 400, statusText: 'Bad Request' });

      expect((error as ErrorSiniestro).codigo).toBe('invalid_request');
    });

    it('un 503 es claims_unavailable', () => {
      let error: unknown;
      servicio.consultarTriageLote([uuid(1)]).subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne((req) => req.url === url('/v1/claims/triage'))
        .flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect((error as ErrorSiniestro).codigo).toBe('claims_unavailable');
    });
  });

  describe('consultarPoliticaTriage', () => {
    it('lee GET /v1/claims/triage-policy', () => {
      let resultado: PoliticaTriage | undefined;
      servicio.consultarPoliticaTriage().subscribe((politica) => (resultado = politica));

      const peticion = http.expectOne(url('/v1/claims/triage-policy'));
      expect(peticion.request.method).toBe('GET');
      peticion.flush(POLITICA_TRIAGE_DTO);

      expect(resultado?.version).toBe('triage-policy-v1');
      expect(resultado?.objetivos).toHaveLength(3);
    });

    it('un error de red es claims_unavailable', () => {
      let error: unknown;
      servicio.consultarPoliticaTriage().subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/triage-policy')).error(new ProgressEvent('error'));

      expect(error).toBeInstanceOf(ErrorSiniestro);
    });

    it('un 503 es claims_unavailable', () => {
      let error: unknown;
      servicio.consultarPoliticaTriage().subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne(url('/v1/claims/triage-policy'))
        .flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect((error as ErrorSiniestro).codigo).toBe('claims_unavailable');
    });
  });
});
