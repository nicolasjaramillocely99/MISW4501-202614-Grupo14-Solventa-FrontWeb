import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import {
  OPCIONES_RADICACION_DTO,
  PAGINA_SINIESTROS_DTO,
  SINIESTRO_RADICADO_DTO,
  SOPORTE_SUBIDO_DTO,
} from '@testing/siniestros-pruebas';

import {
  ErrorRadicacion,
  ErrorSoporte,
  OpcionesRadicacion,
  SolicitudRadicacion,
  SoporteSubido,
} from './radicacion.modelos';
import { DetalleSiniestro, ErrorSiniestro, PaginaSiniestros } from './siniestro.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

const SOLICITUD: SolicitudRadicacion = {
  polizaId: 'AU-2025-118204',
  tipoSiniestro: 'collision',
  ocurridoEn: '2026-09-14T23:40:00.000Z',
  lugar: 'Calle 80 con carrera 30, Bogotá',
  descripcion: 'Al detenerme en el semáforo, un vehículo particular golpeó la parte trasera.',
  soportes: [
    { codigoRequisito: 'vehicle_photos', soporteIds: ['sup-a', 'sup-b', 'sup-c', 'sup-d'] },
    { codigoRequisito: 'driver_document', soporteIds: ['sup-e'] },
    { codigoRequisito: 'traffic_report', soporteIds: ['sup-f'] },
    { codigoRequisito: 'police_report', soporteIds: [] },
  ],
};

describe('SiniestrosApiService (HU-W2.1-01)', () => {
  let servicio: SiniestrosApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('consultarOpcionesRadicacion', () => {
    it('lee las pólizas radicables con sus tipos y soportes en el modelo del cliente', () => {
      let resultado: OpcionesRadicacion | undefined;
      servicio.consultarOpcionesRadicacion().subscribe((opciones) => (resultado = opciones));

      const peticion = http.expectOne(url('/v1/claims/filing-options'));
      expect(peticion.request.method).toBe('GET');
      peticion.flush(OPCIONES_RADICACION_DTO);

      expect(resultado?.versionCatalogo).toBe('claim-catalog-v1');
      expect(resultado?.polizas).toHaveLength(2);
      const autos = resultado?.polizas[0];
      expect(autos).toMatchObject({
        id: 'AU-2025-118204',
        ramo: 'auto',
        producto: 'Autos',
        objetoAsegurado: 'KJT-482',
        vigenteDesde: '2025-11-01T05:00:00Z',
        vigenteHasta: '2026-11-01T05:00:00Z',
      });
      expect(autos?.tiposSiniestro[0].codigo).toBe('collision');
      expect(autos?.tiposSiniestro[0].requisitos[0]).toEqual({
        codigo: 'vehicle_photos',
        etiqueta: 'Fotos del vehículo',
        obligatorio: true,
        minArchivos: 4,
        maxArchivos: 10,
        formatos: ['jpeg', 'png'],
      });
    });

    it('traduce el 503 del core de pólizas y una caída sin cuerpo a policy_directory_unavailable', () => {
      const codigos: string[] = [];
      servicio.consultarOpcionesRadicacion().subscribe({ error: (e: ErrorRadicacion) => codigos.push(e.codigo) });
      http
        .expectOne(url('/v1/claims/filing-options'))
        .flush({ error: 'policy_directory_unavailable', message: 'x' }, { status: 503, statusText: 'Service Unavailable' });
      servicio.consultarOpcionesRadicacion().subscribe({ error: (e: ErrorRadicacion) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/filing-options')).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['policy_directory_unavailable', 'policy_directory_unavailable']);
    });
  });

  describe('subirSoporte', () => {
    it('envía un multipart con un solo campo file y devuelve el soporte subido', () => {
      const archivo = new File(['%PDF-1.7'], 'croquis.pdf', { type: 'application/pdf' });
      let resultado: SoporteSubido | undefined;
      servicio.subirSoporte(archivo).subscribe((soporte) => (resultado = soporte));

      const peticion = http.expectOne(url('/v1/claims/supports'));
      expect(peticion.request.method).toBe('POST');
      const cuerpo = peticion.request.body as FormData;
      expect(cuerpo).toBeInstanceOf(FormData);
      expect([...cuerpo.keys()]).toEqual(['file']);
      expect((cuerpo.get('file') as File).name).toBe('croquis.pdf');
      peticion.flush(SOPORTE_SUBIDO_DTO, { status: 201, statusText: 'Created' });

      expect(resultado).toEqual({
        id: 'sup-3f2a9c0d6b8e4f1a9c2d7e5b0a4c6d8e',
        nombreArchivo: 'croquis.pdf',
        tipoContenido: 'application/pdf',
        tamanoBytes: 482113,
        sha256: SOPORTE_SUBIDO_DTO.sha256,
        subidoEn: '2026-09-14T23:58:02Z',
      });
    });

    it.each([
      [413, 'file_too_large'],
      [415, 'unsupported_file_type'],
      [422, 'empty_file'],
      [429, 'too_many_pending_supports'],
      [400, 'invalid_request'],
      [503, 'supports_unavailable'],
    ])('traduce el %i con su código del contrato (%s)', (estado, codigo) => {
      let error: unknown;
      servicio.subirSoporte(new File(['x'], 'a.png')).subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/supports')).flush({ error: codigo, message: 'x' }, { status: estado, statusText: 'Error' });

      expect(error).toBeInstanceOf(ErrorSoporte);
      expect((error as ErrorSoporte).codigo).toBe(codigo);
    });

    it('deduce el código por el estado cuando el API Gateway responde sin cuerpo JSON', () => {
      const codigos: string[] = [];
      for (const estado of [413, 415, 422, 429, 400, 502]) {
        servicio.subirSoporte(new File(['x'], 'a.png')).subscribe({ error: (e: ErrorSoporte) => codigos.push(e.codigo) });
        http.expectOne(url('/v1/claims/supports')).flush('', { status: estado, statusText: 'Error' });
      }
      servicio.subirSoporte(new File(['x'], 'a.png')).subscribe({ error: (e: ErrorSoporte) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/supports')).error(new ProgressEvent('error'));

      expect(codigos).toEqual([
        'file_too_large',
        'unsupported_file_type',
        'empty_file',
        'too_many_pending_supports',
        'invalid_request',
        'supports_unavailable',
        'supports_unavailable',
      ]);
    });
  });

  describe('radicar', () => {
    it('envía el cuerpo del contrato con la Idempotency-Key y sin los grupos vacíos', () => {
      let resultado: DetalleSiniestro | undefined;
      servicio.radicar(SOLICITUD, 'clave-123').subscribe((caso) => (resultado = caso));

      const peticion = http.expectOne(url('/v1/claims/web-filings'));
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.headers.get('Idempotency-Key')).toBe('clave-123');
      expect(peticion.request.body).toEqual({
        policy_id: 'AU-2025-118204',
        incident_type: 'collision',
        occurred_at: '2026-09-14T23:40:00.000Z',
        place: 'Calle 80 con carrera 30, Bogotá',
        description: 'Al detenerme en el semáforo, un vehículo particular golpeó la parte trasera.',
        supports: [
          { requirement_code: 'vehicle_photos', support_ids: ['sup-a', 'sup-b', 'sup-c', 'sup-d'] },
          { requirement_code: 'driver_document', support_ids: ['sup-e'] },
          { requirement_code: 'traffic_report', support_ids: ['sup-f'] },
        ],
      });
      peticion.flush(SINIESTRO_RADICADO_DTO, { status: 201, statusText: 'Created' });

      expect(resultado).toMatchObject({
        id: '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90',
        numeroRadicado: 'SIN-2026-01712',
        estado: 'active',
        canal: 'web',
        poliza: { id: 'AU-2025-118204', ramo: 'auto', producto: 'Autos', objetoAsegurado: 'KJT-482' },
        radicadoEn: '2026-09-15T00:05:00Z',
        soportes: { obligatoriosTotal: 3, obligatoriosAdjuntos: 3, archivos: 8 },
      });
      expect(resultado?.soportes.items[0].archivos[0]).toEqual({
        soporteId: SOPORTE_SUBIDO_DTO.support_id,
        nombreArchivo: 'croquis.pdf',
        tipoContenido: 'application/pdf',
        tamanoBytes: 482113,
      });
    });

    it('lleva todos los campos del 422 validation_failed, con los soportes por requisito', () => {
      let error: unknown;
      servicio.radicar(SOLICITUD, 'clave-123').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/web-filings')).flush(
        {
          error: 'validation_failed',
          message: 'one or more fields are missing or invalid',
          fields: [
            { field: 'supports.traffic_report', code: 'missing' },
            { field: 'supports.vehicle_photos', code: 'too_few' },
            { field: 'supports', code: 'too_many' },
            { field: 'place', code: 'required' },
            { field: 'occurred_at', code: 'out_of_range' },
            { field: 'campo_desconocido', code: 'required' },
            { field: 'description', code: 'codigo_desconocido' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      expect(error).toBeInstanceOf(ErrorRadicacion);
      expect((error as ErrorRadicacion).codigo).toBe('validation_failed');
      expect((error as ErrorRadicacion).campos).toEqual([
        { campo: 'soportes', codigo: 'missing', requisito: 'traffic_report' },
        { campo: 'soportes', codigo: 'too_few', requisito: 'vehicle_photos' },
        { campo: 'soportes', codigo: 'too_many' },
        { campo: 'lugar', codigo: 'required' },
        { campo: 'ocurridoEn', codigo: 'out_of_range' },
      ]);
    });

    it('lleva el motivo y la vigencia del 422 policy_not_eligible', () => {
      let error: unknown;
      servicio.radicar(SOLICITUD, 'clave-123').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/web-filings')).flush(
        {
          error: 'policy_not_eligible',
          message: 'the incident happened outside the validity of the policy',
          reason: 'occurred_outside_validity',
          valid_from: '2025-11-01T05:00:00Z',
          valid_to: '2026-11-01T05:00:00Z',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const radicacion = error as ErrorRadicacion;
      expect(radicacion.codigo).toBe('policy_not_eligible');
      expect(radicacion.motivo).toBe('occurred_outside_validity');
      expect(radicacion.vigenteDesde).toBe('2025-11-01T05:00:00Z');
      expect(radicacion.vigenteHasta).toBe('2026-11-01T05:00:00Z');
    });

    it('acepta la vigencia en null de policy_not_found y descarta un motivo desconocido', () => {
      const errores: ErrorRadicacion[] = [];
      servicio.radicar(SOLICITUD, 'k').subscribe({ error: (e: ErrorRadicacion) => errores.push(e) });
      http
        .expectOne(url('/v1/claims/web-filings'))
        .flush(
          { error: 'policy_not_eligible', message: 'x', reason: 'policy_not_found', valid_from: null, valid_to: null },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      servicio.radicar(SOLICITUD, 'k').subscribe({ error: (e: ErrorRadicacion) => errores.push(e) });
      http
        .expectOne(url('/v1/claims/web-filings'))
        .flush({ error: 'policy_not_eligible', message: 'x', reason: 'otro' }, { status: 422, statusText: 'Unprocessable Entity' });

      expect(errores.map((e) => [e.motivo, e.vigenteDesde, e.vigenteHasta])).toEqual([
        ['policy_not_found', null, null],
        [null, null, null],
      ]);
    });

    it.each([
      [422, 'idempotency_key_reused'],
      [400, 'invalid_request'],
      [503, 'policy_directory_unavailable'],
      [503, 'filing_unavailable'],
    ])('traduce el %i %s con su código', (estado, codigo) => {
      let error: unknown;
      servicio.radicar(SOLICITUD, 'k').subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne(url('/v1/claims/web-filings')).flush({ error: codigo, message: 'x' }, { status: estado, statusText: 'Error' });

      expect((error as ErrorRadicacion).codigo).toBe(codigo);
      expect((error as ErrorRadicacion).campos).toEqual([]);
    });

    it('trata un 400 sin cuerpo como invalid_request y una caída como filing_unavailable', () => {
      const codigos: string[] = [];
      servicio.radicar(SOLICITUD, 'k').subscribe({ error: (e: ErrorRadicacion) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/web-filings')).flush('', { status: 400, statusText: 'Bad Request' });
      servicio.radicar(SOLICITUD, 'k').subscribe({ error: (e: ErrorRadicacion) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/web-filings')).flush('', { status: 504, statusText: 'Gateway Timeout' });
      servicio.radicar(SOLICITUD, 'k').subscribe({ error: (e: ErrorRadicacion) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/web-filings')).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['invalid_request', 'filing_unavailable', 'filing_unavailable']);
    });
  });

  describe('consultarSiniestro y descargarRadicado', () => {
    it('lee el detalle del caso con el id codificado en la URL', () => {
      let resultado: DetalleSiniestro | undefined;
      servicio.consultarSiniestro('8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90').subscribe((caso) => (resultado = caso));

      const peticion = http.expectOne(url('/v1/claims/8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90'));
      expect(peticion.request.method).toBe('GET');
      peticion.flush(SINIESTRO_RADICADO_DTO);

      expect(resultado?.numeroRadicado).toBe('SIN-2026-01712');
      expect(resultado?.lugar).toBe('Calle 80 con carrera 30, Bogotá');
    });

    it('traduce el 404 claim_not_found, también sin cuerpo, y una caída a claims_unavailable', () => {
      const codigos: string[] = [];
      servicio.consultarSiniestro('x/y').subscribe({ error: (e: ErrorSiniestro) => codigos.push(e.codigo) });
      http
        .expectOne(url('/v1/claims/x%2Fy'))
        .flush({ error: 'claim_not_found', message: 'x' }, { status: 404, statusText: 'Not Found' });
      servicio.consultarSiniestro('z').subscribe({ error: (e: ErrorSiniestro) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/z')).flush('', { status: 404, statusText: 'Not Found' });
      servicio.consultarSiniestro('z').subscribe({ error: (e: ErrorSiniestro) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/z')).error(new ProgressEvent('error'));

      expect(codigos).toEqual(['claim_not_found', 'claim_not_found', 'claims_unavailable']);
    });

    it('descarga el PDF del radicado como Blob', () => {
      let resultado: Blob | undefined;
      servicio.descargarRadicado('8f14e45f').subscribe((pdf) => (resultado = pdf));

      const peticion = http.expectOne(url('/v1/claims/8f14e45f/filing-receipt'));
      expect(peticion.request.responseType).toBe('blob');
      peticion.flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));

      expect(resultado).toBeInstanceOf(Blob);
    });

    it('traduce el error del PDF por su estado (el cuerpo llega como Blob)', () => {
      const codigos: string[] = [];
      servicio.descargarRadicado('a').subscribe({ error: (e: ErrorSiniestro) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/a/filing-receipt')).flush(new Blob(['{}']), { status: 404, statusText: 'Not Found' });
      servicio.descargarRadicado('a').subscribe({ error: (e: ErrorSiniestro) => codigos.push(e.codigo) });
      http.expectOne(url('/v1/claims/a/filing-receipt')).flush(new Blob(['{}']), { status: 503, statusText: 'Unavailable' });

      expect(codigos).toEqual(['claim_not_found', 'claims_unavailable']);
    });
  });

  describe('listarSiniestros', () => {
    it('pide la primera página sin parámetros y mapea el caso móvil con nulos', () => {
      let resultado: PaginaSiniestros | undefined;
      servicio.listarSiniestros().subscribe((pagina) => (resultado = pagina));

      const peticion = http.expectOne((req) => req.url === url('/v1/claims'));
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.keys()).toEqual([]);
      peticion.flush(PAGINA_SINIESTROS_DTO);

      expect(resultado?.siguienteToken).toBeNull();
      expect(resultado?.items.map((caso) => caso.numeroRadicado)).toEqual(['SIN-2026-01712', 'SIN-2026-01655']);
      expect(resultado?.items[1]).toMatchObject({
        canal: 'mobile',
        poliza: { id: 'AU-2025-118204', ramo: null, producto: null, objetoAsegurado: null },
        tipoSiniestro: 'theft',
      });
    });

    it('envía los filtros, el tamaño y el token de página con los nombres del contrato', () => {
      servicio
        .listarSiniestros({ polizaId: 'AU-2025-118204', desde: '2026-01-01', tamanoPagina: 20, tokenPagina: 'tok-2' })
        .subscribe();

      const peticion = http.expectOne((req) => req.url === url('/v1/claims'));
      expect(peticion.request.params.get('policy_id')).toBe('AU-2025-118204');
      expect(peticion.request.params.get('from')).toBe('2026-01-01');
      expect(peticion.request.params.get('page_size')).toBe('20');
      expect(peticion.request.params.get('page_token')).toBe('tok-2');
      peticion.flush({ items: [], next_page_token: null });
    });

    it('traduce el 400 invalid_request de un filtro o token inválido', () => {
      let error: unknown;
      servicio.listarSiniestros({ desde: 'ayer' }).subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne((req) => req.url === url('/v1/claims'))
        .flush({ error: 'invalid_request', message: 'x' }, { status: 400, statusText: 'Bad Request' });

      expect(error).toBeInstanceOf(ErrorSiniestro);
      expect((error as ErrorSiniestro).codigo).toBe('invalid_request');
    });
  });
});
