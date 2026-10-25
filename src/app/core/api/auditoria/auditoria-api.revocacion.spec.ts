import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { CONSENTIMIENTO_ID, ESTADO_ACTIVO_DTO, ESTADO_EN_CURSO_DTO, ESTADO_PARCIAL_DTO } from '@testing/revocacion-pruebas';

import { AuditoriaApiService } from './auditoria-api.service';
import { ErrorRevocacion, EstadoRevocacion, ResultadoReintento, mapearEstadoRevocacion } from './revocacion.modelos';

const CLAVE = '6f1f0d1e-52c4-4b1c-9d2b-0a7a4e0f8c11';
const SOLICITUD = { motivo: 'customer_request', referencia: 'TCK-2026-0412', rolConfirmado: true } as const;

describe('AuditoriaApiService · revocación desde el portal (HU-W4.2-02)', () => {
  let servicio: AuditoriaApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}/v1/audit/consents/${ruta}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AuditoriaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('consultarEstadoRevocacion', () => {
    it('lee el estado por GET y lo devuelve con el modelo del cliente', () => {
      let resultado: EstadoRevocacion | undefined;
      servicio.consultarEstadoRevocacion(CONSENTIMIENTO_ID).subscribe((estado) => (resultado = estado));

      const peticion = http.expectOne(url(`${CONSENTIMIENTO_ID}/revocation`));
      expect(peticion.request.method).toBe('GET');
      peticion.flush(ESTADO_ACTIVO_DTO);

      expect(resultado).toEqual(mapearEstadoRevocacion(ESTADO_ACTIVO_DTO));
    });

    it('escapa el identificador en la ruta', () => {
      servicio.consultarEstadoRevocacion('a/b c').subscribe({ error: () => undefined });

      http.expectOne(url('a%2Fb%20c/revocation')).flush('', { status: 404, statusText: 'Not Found' });
    });

    it('falla con consent_not_found si no existe', () => {
      let error: unknown;
      servicio.consultarEstadoRevocacion('nope').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('nope/revocation')).flush({ error: 'consent_not_found' }, { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(ErrorRevocacion);
      expect((error as ErrorRevocacion).codigo).toBe('consent_not_found');
    });

    it('falla con service_unavailable ante una caída del gateway', () => {
      let error: unknown;
      servicio.consultarEstadoRevocacion('x').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('x/revocation')).flush('', { status: 502, statusText: 'Bad Gateway' });

      expect((error as ErrorRevocacion).codigo).toBe('service_unavailable');
    });
  });

  describe('revocarConsentimiento', () => {
    it('publica el cuerpo exacto del contrato con la cabecera Idempotency-Key', () => {
      let resultado: EstadoRevocacion | undefined;
      servicio.revocarConsentimiento(CONSENTIMIENTO_ID, SOLICITUD, CLAVE).subscribe((estado) => (resultado = estado));

      const peticion = http.expectOne(url(`${CONSENTIMIENTO_ID}/revocations`));
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.headers.get('Idempotency-Key')).toBe(CLAVE);
      expect(peticion.request.body).toEqual({ reason: 'customer_request', reference: 'TCK-2026-0412', role_confirmed: true });
      peticion.flush(ESTADO_EN_CURSO_DTO, { status: 201, statusText: 'Created' });

      expect(resultado).toEqual(mapearEstadoRevocacion(ESTADO_EN_CURSO_DTO));
      expect(resultado?.revocacion?.numeroComprobante).toBe('REV-2026-0089');
    });

    it('acepta el 200 de la misma clave', () => {
      let resultado: EstadoRevocacion | undefined;
      servicio.revocarConsentimiento(CONSENTIMIENTO_ID, SOLICITUD, CLAVE).subscribe((estado) => (resultado = estado));

      http.expectOne(url(`${CONSENTIMIENTO_ID}/revocations`)).flush(ESTADO_EN_CURSO_DTO, { status: 200, statusText: 'OK' });

      expect(resultado?.estado).toBe('revoked');
    });

    it('lleva los campos inválidos del 400 validation_failed', () => {
      let error: unknown;
      servicio.revocarConsentimiento(CONSENTIMIENTO_ID, SOLICITUD, CLAVE).subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url(`${CONSENTIMIENTO_ID}/revocations`)).flush(
        {
          error: 'validation_failed',
          message: 'one or more fields are invalid',
          fields: [
            { field: 'reason', code: 'required' },
            { field: 'reference', code: 'required' },
            { field: 'role_confirmed', code: 'must_be_true' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect((error as ErrorRevocacion).codigo).toBe('validation_failed');
      expect((error as ErrorRevocacion).campos.map((c) => c.campo)).toEqual(['motivo', 'referencia', 'rolConfirmado']);
    });

    it.each(['consent_already_revoked', 'consent_not_active', 'idempotency_key_reused'] as const)(
      'traduce el 409 %s',
      (codigo) => {
        let error: unknown;
        servicio.revocarConsentimiento(CONSENTIMIENTO_ID, SOLICITUD, CLAVE).subscribe({ error: (e: unknown) => (error = e) });

        http
          .expectOne(url(`${CONSENTIMIENTO_ID}/revocations`))
          .flush({ error: codigo, message: 'x' }, { status: 409, statusText: 'Conflict' });

        expect((error as ErrorRevocacion).codigo).toBe(codigo);
      },
    );

    it('trata el 503 y los errores de red como service_unavailable', () => {
      const codigos: string[] = [];
      servicio.revocarConsentimiento(CONSENTIMIENTO_ID, SOLICITUD, CLAVE).subscribe({ error: (e: ErrorRevocacion) => codigos.push(e.codigo) });
      http
        .expectOne(url(`${CONSENTIMIENTO_ID}/revocations`))
        .flush({ error: 'service_unavailable', message: 'x' }, { status: 503, statusText: 'Service Unavailable' });
      servicio.revocarConsentimiento(CONSENTIMIENTO_ID, SOLICITUD, CLAVE).subscribe({ error: (e: ErrorRevocacion) => codigos.push(e.codigo) });
      http.expectOne(url(`${CONSENTIMIENTO_ID}/revocations`)).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['service_unavailable', 'service_unavailable']);
    });
  });

  describe('reintentarRevocacion', () => {
    it('hace POST sin cuerpo ni Idempotency-Key y devuelve las entidades y el estado', () => {
      let resultado: ResultadoReintento | undefined;
      servicio.reintentarRevocacion(CONSENTIMIENTO_ID).subscribe((r) => (resultado = r));

      const peticion = http.expectOne(url(`${CONSENTIMIENTO_ID}/revocation-retries`));
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toBeNull();
      expect(peticion.request.headers.has('Idempotency-Key')).toBe(false);
      peticion.flush({ retried_entities: ['aliado-banco-1'], state: ESTADO_PARCIAL_DTO }, { status: 202, statusText: 'Accepted' });

      expect(resultado?.entidadesReintentadas).toEqual(['aliado-banco-1']);
      expect(resultado?.estado).toEqual(mapearEstadoRevocacion(ESTADO_PARCIAL_DTO));
    });

    it.each(['nothing_to_retry', 'consent_not_revoked'] as const)('traduce el 409 %s', (codigo) => {
      let error: unknown;
      servicio.reintentarRevocacion(CONSENTIMIENTO_ID).subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne(url(`${CONSENTIMIENTO_ID}/revocation-retries`))
        .flush({ error: codigo, message: 'x' }, { status: 409, statusText: 'Conflict' });

      expect((error as ErrorRevocacion).codigo).toBe(codigo);
    });

    it('falla con service_unavailable si el gateway no responde', () => {
      let error: unknown;
      servicio.reintentarRevocacion(CONSENTIMIENTO_ID).subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url(`${CONSENTIMIENTO_ID}/revocation-retries`)).flush('', { status: 502, statusText: 'Bad Gateway' });

      expect((error as ErrorRevocacion).codigo).toBe('service_unavailable');
    });
  });
});
