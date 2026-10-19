import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { RECIBO_CONSENTIMIENTO_DTO as RECIBO_DTO, TERMINOS_DTO } from '@testing/consentimiento-pruebas';

import { AuditoriaApiService } from './auditoria-api.service';
import {
  Consentimiento,
  ErrorConsentimiento,
  SolicitudConsentimiento,
  TerminosConsentimiento,
  mapearConsentimiento,
  mapearTerminosConsentimiento,
} from './consentimiento.modelos';

const SOLICITUD: SolicitudConsentimiento = {
  clienteId: 'cliente-0001',
  documento: '1020304050',
  nombreCompleto: 'Ana María Pérez',
  versionTerminos: 'v1',
  fuentesAceptadas: ['open_finance', 'open_data', 'kyc'],
  aceptaPoliticaDatos: true,
  aliadoId: 'aliado-banco-1',
  solicitudId: '48213',
};

describe('AuditoriaApiService (HU-W1.2-01)', () => {
  let servicio: AuditoriaApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AuditoriaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('consultarTerminosVigentes', () => {
    it('lee los términos del gateway y los devuelve con el modelo del cliente', () => {
      let resultado: TerminosConsentimiento | undefined;
      servicio.consultarTerminosVigentes().subscribe((terminos) => (resultado = terminos));

      const peticion = http.expectOne(url('/v1/audit/consent-terms/current'));
      expect(peticion.request.method).toBe('GET');
      peticion.flush(TERMINOS_DTO);

      expect(resultado).toEqual(mapearTerminosConsentimiento(TERMINOS_DTO));
      expect(resultado?.fuentes[2]).toEqual({
        codigo: 'kyc',
        categoriasDatos: ['identity_verification'],
        vigencia: 'single_use',
      });
    });

    it('traduce una caída del gateway a service_unavailable', () => {
      let error: unknown;
      servicio.consultarTerminosVigentes().subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/audit/consent-terms/current')).flush('', { status: 502, statusText: 'Bad Gateway' });

      expect(error).toBeInstanceOf(ErrorConsentimiento);
      expect((error as ErrorConsentimiento).codigo).toBe('service_unavailable');
    });
  });

  describe('registrarConsentimiento', () => {
    it('publica el cuerpo del contrato con titular, alcance, aliado, solicitud y canal embedded', () => {
      let resultado: Consentimiento | undefined;
      servicio.registrarConsentimiento(SOLICITUD).subscribe((consentimiento) => (resultado = consentimiento));

      const peticion = http.expectOne(url('/v1/audit/consents'));
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual({
        customer_id: 'cliente-0001',
        document_id: '1020304050',
        full_name: 'Ana María Pérez',
        terms_version: 'v1',
        accepted_sources: ['open_finance', 'open_data', 'kyc'],
        accepted_data_policy: true,
        channel: 'embedded',
        partner_id: 'aliado-banco-1',
        application_id: '48213',
      });
      peticion.flush(RECIBO_DTO, { status: 201, statusText: 'Created' });

      expect(resultado).toEqual(mapearConsentimiento(RECIBO_DTO));
      expect(resultado?.id).toBe('cns-7c3e85c71dddd603c8e90def9f4ce9cd');
    });

    it('acepta el 200 de un consentimiento que ya existía', () => {
      let resultado: Consentimiento | undefined;
      servicio.registrarConsentimiento(SOLICITUD).subscribe((consentimiento) => (resultado = consentimiento));

      http.expectOne(url('/v1/audit/consents')).flush(RECIBO_DTO, { status: 200, statusText: 'OK' });

      expect(resultado?.id).toBe(RECIBO_DTO.consent_id);
    });

    it('lleva todos los campos inválidos del 400 validation_failed, con el nombre del modelo', () => {
      let error: unknown;
      servicio.registrarConsentimiento(SOLICITUD).subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/audit/consents')).flush(
        {
          error: 'validation_failed',
          message: 'one or more fields are invalid',
          fields: [
            { field: 'customer_id', code: 'invalid_format' },
            { field: 'accepted_sources', code: 'incomplete' },
            { field: 'accepted_data_policy', code: 'must_be_true' },
            { field: 'campo_desconocido', code: 'required' },
            { field: 'full_name', code: 'codigo_desconocido' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(error).toBeInstanceOf(ErrorConsentimiento);
      expect((error as ErrorConsentimiento).codigo).toBe('validation_failed');
      expect((error as ErrorConsentimiento).campos).toEqual([
        { campo: 'clienteId', codigo: 'invalid_format' },
        { campo: 'fuentesAceptadas', codigo: 'incomplete' },
        { campo: 'aceptaPoliticaDatos', codigo: 'must_be_true' },
      ]);
    });

    it('traduce el 409 terms_outdated para volver a mostrar los términos', () => {
      let error: unknown;
      servicio.registrarConsentimiento(SOLICITUD).subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/audit/consents')).flush(
        { error: 'terms_outdated', message: 'the terms version shown is no longer the current one' },
        { status: 409, statusText: 'Conflict' },
      );

      expect((error as ErrorConsentimiento).codigo).toBe('terms_outdated');
      expect((error as ErrorConsentimiento).campos).toEqual([]);
    });

    it('trata un 409 sin cuerpo como terms_outdated y un 400 sin cuerpo como invalid_request', () => {
      const codigos: string[] = [];
      servicio.registrarConsentimiento(SOLICITUD).subscribe({ error: (e: ErrorConsentimiento) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/audit/consents')).flush('', { status: 409, statusText: 'Conflict' });
      servicio.registrarConsentimiento(SOLICITUD).subscribe({ error: (e: ErrorConsentimiento) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/audit/consents')).flush('', { status: 400, statusText: 'Bad Request' });

      expect(codigos).toEqual(['terms_outdated', 'invalid_request']);
    });

    it('trata el 503 y los errores de red como service_unavailable', () => {
      const codigos: string[] = [];
      servicio.registrarConsentimiento(SOLICITUD).subscribe({ error: (e: ErrorConsentimiento) => codigos.push(e.codigo) });
      http
        .expectOne(url('/v1/audit/consents'))
        .flush({ error: 'service_unavailable', message: 'x' }, { status: 503, statusText: 'Service Unavailable' });
      servicio.registrarConsentimiento(SOLICITUD).subscribe({ error: (e: ErrorConsentimiento) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/audit/consents')).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['service_unavailable', 'service_unavailable']);
    });
  });
});
