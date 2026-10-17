import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env/environment';
import { COTIZACION_DTO } from '@testing/cotizacion-asistida-pruebas';

import { COBRO_PENDIENTE_DTO } from '@testing/cobro-pruebas';
import { SOLICITUD_AJUSTADA_DTO, SOLICITUD_PENDIENTE_DTO, SOLICITUD_RECHAZADA_DTO } from '@testing/revision-pruebas';

import { Aceptacion, AceptacionDto, ErrorAceptacion, mapearAceptacion } from './aceptacion.modelos';
import { ErrorCobro, mapearCobro } from './cobro.modelos';
import { OriginacionApiService } from './originacion-api.service';
import { ErrorCotizacionAsistida, mapearCotizacionAsistida } from './cotizacion-asistida.modelos';
import { PerfilRiesgoDto, mapearPerfilRiesgo } from './perfil-riesgo.modelos';
import { ErrorRevision, mapearListaSolicitudesRevision, mapearSolicitudRevision } from './revision.modelos';

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

  describe('aceptación de la oferta (HU-W1.3-01)', () => {
    const GATEWAY = environment.apiGatewayUrl.replace(/\/+$/, '');
    const ACEPTACION: AceptacionDto = {
      acceptance_id: 'b310b02b-9820-4725-bded-586d263dd16e',
      offer_id: 'demo-active-002',
      customer_id: '0f3c2a9e-1b7d-4c55-9a51-2f0d4e6b8c11',
      channel: 'web',
      accepted_at: '2026-10-12T01:54:41.0909319Z',
      status: 'registered',
      underwriting: null,
      processing: { attempts: 0, last_failure_at: null, next_attempt_at: '2026-10-12T01:54:41.0909319Z' },
      updated_at: '2026-10-12T01:54:41.0909319Z',
    };

    it('acepta la oferta con el canal web y codifica el identificador en la ruta', () => {
      let resultado: Aceptacion | undefined;
      servicio.aceptarOferta('oferta/con espacios').subscribe((aceptacion) => (resultado = aceptacion));

      const peticion = http.expectOne(`${GATEWAY}/v1/offers/oferta%2Fcon%20espacios/acceptance`);
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual({ channel: 'web' });
      peticion.flush(ACEPTACION, { status: 202, statusText: 'Accepted' });

      expect(resultado).toEqual(mapearAceptacion(ACEPTACION));
    });

    it('una oferta vencida falla con offer_expired y su vigencia', () => {
      let error: ErrorAceptacion | undefined;
      servicio.aceptarOferta('demo-expired-002').subscribe({ error: (e: ErrorAceptacion) => (error = e) });

      http.expectOne(`${GATEWAY}/v1/offers/demo-expired-002/acceptance`).flush(
        {
          error: 'offer_expired',
          message: 'the offer validity is over; request a new offer',
          offer_id: 'demo-expired-002',
          expires_at: '2026-10-12T00:54:44.4210077Z',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      expect(error?.codigo).toBe('offer_expired');
      expect(error?.venceEn).toBe('2026-10-12T00:54:44.4210077Z');
    });

    it('sin cuerpo del contrato, una falla al aceptar es acceptance_not_registered y un 404 offer_not_found', () => {
      const codigos: string[] = [];
      servicio.aceptarOferta('o-1').subscribe({ error: (e: ErrorAceptacion) => codigos.push(e.codigo) });
      http.expectOne(`${GATEWAY}/v1/offers/o-1/acceptance`).error(new ProgressEvent('error'));
      servicio.aceptarOferta('o-2').subscribe({ error: (e: ErrorAceptacion) => codigos.push(e.codigo) });
      http.expectOne(`${GATEWAY}/v1/offers/o-2/acceptance`).flush(null, { status: 404, statusText: 'Not Found' });

      expect(codigos).toEqual(['acceptance_not_registered', 'offer_not_found']);
    });

    it('consulta la aceptación por su identificador', () => {
      let resultado: Aceptacion | undefined;
      servicio.consultarAceptacion(ACEPTACION.acceptance_id).subscribe((a) => (resultado = a));

      const peticion = http.expectOne(`${GATEWAY}/v1/acceptances/${ACEPTACION.acceptance_id}`);
      expect(peticion.request.method).toBe('GET');
      peticion.flush({ ...ACEPTACION, status: 'issuance_pending' });

      expect(resultado?.estado).toBe('issuance_pending');
    });

    it('consulta la aceptación de una oferta y traduce acceptance_not_found y la falta de servicio', () => {
      const codigos: string[] = [];
      servicio.consultarAceptacionDeOferta('demo-active-002').subscribe({
        error: (e: ErrorAceptacion) => codigos.push(e.codigo),
      });
      http
        .expectOne(`${GATEWAY}/v1/offers/demo-active-002/acceptance`)
        .flush({ error: 'acceptance_not_found', message: 'x' }, { status: 404, statusText: 'Not Found' });
      servicio.consultarAceptacionDeOferta('demo-active-002').subscribe({
        error: (e: ErrorAceptacion) => codigos.push(e.codigo),
      });
      http
        .expectOne(`${GATEWAY}/v1/offers/demo-active-002/acceptance`)
        .flush(null, { status: 504, statusText: 'Gateway Timeout' });

      expect(codigos).toEqual(['acceptance_not_found', 'acceptance_unavailable']);
    });
  });

  describe('cotización asistida (HU-W1.1-01)', () => {
    const GATEWAY = environment.apiGatewayUrl.replace(/\/+$/, '');
    const SOLICITUD = {
      documento: '1032456789',
      nombreCompleto: 'Ana María Pérez',
      correo: 'ana@example.com',
      fechaNacimiento: '1990-05-20',
      montoAsegurado: 250000000,
      plazoMeses: 180,
      consentimientoActivo: true,
    };

    it('crea la cotización con el cuerpo del contrato y devuelve el modelo del cliente', () => {
      let resultado: unknown;
      servicio.crearCotizacionAsistida(SOLICITUD).subscribe((c) => (resultado = c));

      const peticion = http.expectOne(`${GATEWAY}/v1/assisted-quotes`);
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual({
        document_id: '1032456789',
        full_name: 'Ana María Pérez',
        email: 'ana@example.com',
        birth_date: '1990-05-20',
        insured_amount: 250000000,
        term_months: 180,
        consent_active: true,
      });
      peticion.flush(COTIZACION_DTO, { status: 201, statusText: 'Created' });

      expect(resultado).toEqual(mapearCotizacionAsistida(COTIZACION_DTO));
    });

    it('traduce el 422 validation_failed a un error con todos los campos', () => {
      let error: unknown;
      servicio.crearCotizacionAsistida(SOLICITUD).subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne(`${GATEWAY}/v1/assisted-quotes`)
        .flush(
          { error: 'validation_failed', message: 'x', fields: [{ field: 'email', code: 'invalid_format' }] },
          { status: 422, statusText: 'Unprocessable' },
        );

      expect(error).toBeInstanceOf(ErrorCotizacionAsistida);
      expect((error as ErrorCotizacionAsistida).campos).toEqual([{ campo: 'correo', codigo: 'invalid_format' }]);
    });

    it('un fallo de red al cotizar es quote_unavailable', () => {
      let error: unknown;
      servicio.crearCotizacionAsistida(SOLICITUD).subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(`${GATEWAY}/v1/assisted-quotes`).error(new ProgressEvent('error'));

      expect((error as ErrorCotizacionAsistida).codigo).toBe('quote_unavailable');
    });

    it('consulta una cotización por id, codificando el identificador', () => {
      let resultado: unknown;
      servicio.consultarCotizacionAsistida('a/b').subscribe((c) => (resultado = c));

      const peticion = http.expectOne(`${GATEWAY}/v1/assisted-quotes/a%2Fb`);
      expect(peticion.request.method).toBe('GET');
      peticion.flush({ ...COTIZACION_DTO, status: 'expired', can_formalize: false, blocked_reason: 'quote_expired' });

      expect(resultado).toMatchObject({ estado: 'expired', puedeFormalizar: false });
    });

    it('una cotización inexistente es quote_not_found', () => {
      let error: unknown;
      servicio.consultarCotizacionAsistida('nope').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(`${GATEWAY}/v1/assisted-quotes/nope`).flush({ error: 'quote_not_found', message: 'm' }, { status: 404, statusText: 'Not Found' });

      expect((error as ErrorCotizacionAsistida).codigo).toBe('quote_not_found');
    });

    it('busca al cliente por documento y devuelve sus datos', () => {
      let resultado: unknown;
      servicio.buscarClientePorDocumento('1032456789').subscribe((c) => (resultado = c));

      const peticion = http.expectOne((r) => r.url === `${GATEWAY}/v1/customers`);
      expect(peticion.request.params.get('document_id')).toBe('1032456789');
      peticion.flush({
        customer_id: 'c1',
        document_id: '1032456789',
        full_name: 'Ana',
        email: 'a@x.co',
        birth_date: '1990-05-20',
      });

      expect(resultado).toEqual({
        clienteId: 'c1',
        documento: '1032456789',
        nombreCompleto: 'Ana',
        correo: 'a@x.co',
        fechaNacimiento: '1990-05-20',
      });
    });

    it('un documento sin cliente es customer_not_found', () => {
      let error: unknown;
      servicio.buscarClientePorDocumento('999999999').subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne((r) => r.url === `${GATEWAY}/v1/customers`)
        .flush({ error: 'customer_not_found', message: 'm' }, { status: 404, statusText: 'Not Found' });

      expect((error as ErrorCotizacionAsistida).codigo).toBe('customer_not_found');
    });
  });

  describe('cobro de la prima (HA-D02)', () => {
    const URL_COBRO = `${environment.apiGatewayUrl.replace(/\/+$/, '')}/v1/acceptances/acc%2F1/charge`;

    it('consulta el cobro codificando la aceptación y devuelve el modelo del cliente', () => {
      let recibido: unknown;
      servicio.consultarCobro('acc/1').subscribe((cobro) => (recibido = cobro));

      const peticion = http.expectOne(URL_COBRO);
      expect(peticion.request.method).toBe('GET');
      peticion.flush(COBRO_PENDIENTE_DTO);

      expect(recibido).toEqual(mapearCobro(COBRO_PENDIENTE_DTO));
    });

    it('traduce charge_not_found y la falta de servicio a ErrorCobro', () => {
      const codigos: string[] = [];
      servicio.consultarCobro('acc/1').subscribe({ error: (e: ErrorCobro) => codigos.push(e.codigo) });
      http.expectOne(URL_COBRO).flush({ error: 'charge_not_found', message: 'x' }, { status: 404, statusText: 'Not Found' });

      servicio.consultarCobro('acc/1').subscribe({ error: (e: ErrorCobro) => codigos.push(e.codigo) });
      http.expectOne(URL_COBRO).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['charge_not_found', 'charge_unavailable']);
    });
  });

  describe('bandeja de decisión humana (HU-W1.1-02)', () => {
    const GATEWAY = environment.apiGatewayUrl.replace(/\/+$/, '');

    it('lista la bandeja con el estado, el orden y el motivo como parámetros', () => {
      let recibido: unknown;
      servicio
        .listarSolicitudesRevision({ estado: 'decided', motivo: 'high_risk_score', orden: 'desc' })
        .subscribe((lista) => (recibido = lista));

      const peticion = http.expectOne((r) => r.url === `${GATEWAY}/v1/review-requests`);
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.get('status')).toBe('decided');
      expect(peticion.request.params.get('order')).toBe('desc');
      expect(peticion.request.params.get('reason')).toBe('high_risk_score');
      peticion.flush({ items: [SOLICITUD_RECHAZADA_DTO], counts: { pending: 0, decided: 1 } });

      expect(recibido).toEqual(
        mapearListaSolicitudesRevision({ items: [SOLICITUD_RECHAZADA_DTO], counts: { pending: 0, decided: 1 } }),
      );
    });

    it('sin motivo no envía el parámetro reason', () => {
      servicio.listarSolicitudesRevision({ estado: 'pending', motivo: null, orden: 'asc' }).subscribe();

      const peticion = http.expectOne((r) => r.url === `${GATEWAY}/v1/review-requests`);
      expect(peticion.request.params.has('reason')).toBe(false);
      expect(peticion.request.params.get('status')).toBe('pending');
      peticion.flush({ items: [], counts: { pending: 0, decided: 0 } });
    });

    it('la bandeja sin servicio falla con review_unavailable', () => {
      let codigo: string | undefined;
      servicio
        .listarSolicitudesRevision({ estado: 'pending', motivo: null, orden: 'asc' })
        .subscribe({ error: (e: ErrorRevision) => (codigo = e.codigo) });
      http.expectOne((r) => r.url === `${GATEWAY}/v1/review-requests`).error(new ProgressEvent('error'));

      expect(codigo).toBe('review_unavailable');
    });

    it('abre un caso codificando la aceptación y traduce review_request_not_found', () => {
      let recibido: unknown;
      servicio.consultarSolicitudRevision('acc/1').subscribe((solicitud) => (recibido = solicitud));
      const peticion = http.expectOne(`${GATEWAY}/v1/review-requests/acc%2F1`);
      expect(peticion.request.method).toBe('GET');
      peticion.flush(SOLICITUD_PENDIENTE_DTO);
      expect(recibido).toEqual(mapearSolicitudRevision(SOLICITUD_PENDIENTE_DTO));

      let codigo: string | undefined;
      servicio.consultarSolicitudRevision('acc/1').subscribe({ error: (e: ErrorRevision) => (codigo = e.codigo) });
      http
        .expectOne(`${GATEWAY}/v1/review-requests/acc%2F1`)
        .flush({ error: 'review_request_not_found', message: 'x' }, { status: 404, statusText: 'Not Found' });
      expect(codigo).toBe('review_request_not_found');
    });

    it('registra la decisión con el cuerpo del contrato y devuelve el caso decidido', () => {
      let recibido: unknown;
      servicio
        .registrarDecision('acc/1', { tipo: 'adjust', observaciones: 'Ingreso declarado sin verificar', ajustePrimaPct: 10 })
        .subscribe((solicitud) => (recibido = solicitud));

      const peticion = http.expectOne(`${GATEWAY}/v1/review-requests/acc%2F1/decision`);
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual({
        type: 'adjust',
        observations: 'Ingreso declarado sin verificar',
        premium_adjustment_pct: 10,
      });
      peticion.flush(SOLICITUD_AJUSTADA_DTO, { status: 201, statusText: 'Created' });

      expect(recibido).toEqual(mapearSolicitudRevision(SOLICITUD_AJUSTADA_DTO));
    });

    it('traduce los errores de la decisión; sin cuerpo es decision_not_registered', () => {
      const codigos: string[] = [];
      const registrar = () =>
        servicio
          .registrarDecision('acc-1', { tipo: 'reject' })
          .subscribe({ error: (e: ErrorRevision) => codigos.push(e.codigo) });
      const url = `${GATEWAY}/v1/review-requests/acc-1/decision`;

      registrar();
      http.expectOne(url).flush({ error: 'observations_required', message: 'x' }, { status: 400, statusText: 'Bad Request' });
      registrar();
      http.expectOne(url).flush({ error: 'review_request_already_decided', message: 'x' }, { status: 409, statusText: 'Conflict' });
      registrar();
      http.expectOne(url).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['observations_required', 'review_request_already_decided', 'decision_not_registered']);
    });
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
