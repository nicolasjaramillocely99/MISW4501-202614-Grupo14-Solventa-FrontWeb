import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import {
  HISTORIAL_DEVUELTO_DTO,
  ID_DEVUELTO,
  RESULTADO_REENVIO_DTO,
} from '@testing/reenvio-radicacion-pruebas';

import {
  ErrorReenvio,
  HistorialSiniestro,
  ResultadoReenvio,
  aReenvioDto,
  mapearHistorialSiniestro,
  traducirErrorReenvio,
} from './reenvio.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · historial y reenvío de la radicación devuelta (HU-W2.1-04)', () => {
  let servicio: SiniestrosApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el historial con la devolución, los reenvíos y las reglas de cada soporte', () => {
    let historial: HistorialSiniestro | undefined;
    servicio.consultarHistorial(ID_DEVUELTO).subscribe((h) => (historial = h));

    http.expectOne(url(`/v1/claims/${ID_DEVUELTO}/history`)).flush(HISTORIAL_DEVUELTO_DTO);

    expect(historial?.estado).toBe('returned');
    expect(historial?.ultimaDevolucion?.secuencia).toBe(1);
    expect(historial?.ultimaDevolucion?.datosACorregir).toEqual(['place']);
    expect(historial?.cambios.map((c) => [c.estado, c.estadoAnterior])).toEqual([
      ['active', null],
      ['returned', 'active'],
    ]);
    expect(historial?.requisitos[2]).toEqual({
      codigo: 'traffic_report',
      etiqueta: 'Informe de tránsito o croquis',
      obligatorio: true,
      minArchivos: 1,
      maxArchivos: 3,
      formatos: ['pdf', 'jpeg', 'png'],
    });
    expect(historial?.reenvios).toEqual([]);
  });

  it('un historial sin reenvíos ni reglas (backend anterior) queda con listas vacías', () => {
    const anterior = { ...HISTORIAL_DEVUELTO_DTO, last_return: null };
    delete anterior.resubmissions;
    delete anterior.requirements;
    const historial = mapearHistorialSiniestro(anterior);

    expect(historial.reenvios).toEqual([]);
    expect(historial.requisitos).toEqual([]);
    expect(historial.ultimaDevolucion).toBeNull();
  });

  it('reenvía solo lo que cambió y responde el reenvío', () => {
    let resultado: ResultadoReenvio | undefined;
    servicio
      .reenviarRadicacion(ID_DEVUELTO, {
        revisionSecuencia: 1,
        lugar: 'Calle 80',
        soportes: [{ codigoRequisito: 'traffic_report', soporteIds: ['sup-a'] }],
      })
      .subscribe((r) => (resultado = r));

    const peticion = http.expectOne(url(`/v1/claims/${ID_DEVUELTO}/resubmission`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      review_seq: 1,
      place: 'Calle 80',
      supports: [{ requirement_code: 'traffic_report', support_ids: ['sup-a'] }],
    });
    peticion.flush(RESULTADO_REENVIO_DTO);

    expect(resultado?.estado).toBe('active');
    expect(resultado?.numeroRadicado).toBe('SIN-2026-01877');
    expect(resultado?.reenvio.soportes[0]).toEqual({
      codigoRequisito: 'traffic_report',
      etiqueta: 'Informe de tránsito o croquis',
      agregados: ['sup-3f2a9c0d6b8e4f1a9c2d7e5b0a4c6d8e'],
      retirados: [RESULTADO_REENVIO_DTO.resubmission.changed_supports[0].withdrawn[0]],
    });
  });

  it('arma el cuerpo con todos los datos', () => {
    expect(
      aReenvioDto({
        revisionSecuencia: 2,
        ocurridoEn: '2026-09-14T22:00:00.000Z',
        descripcion: 'Otra descripción del hecho.',
        montoEstimadoMinor: 150_000_000,
        soportes: [],
      }),
    ).toEqual({
      review_seq: 2,
      occurred_at: '2026-09-14T22:00:00.000Z',
      description: 'Otra descripción del hecho.',
      estimated_amount_minor: 150_000_000,
    });
  });

  it('el 422 trae cada campo que falta', () => {
    let error: unknown;
    servicio
      .reenviarRadicacion(ID_DEVUELTO, { revisionSecuencia: 1 })
      .subscribe({ error: (e) => (error = e) });

    http.expectOne(url(`/v1/claims/${ID_DEVUELTO}/resubmission`)).flush(
      {
        error: 'validation_failed',
        message: 'x',
        fields: [{ field: 'supports.traffic_report', code: 'not_replaced' }, { field: 1 }, null],
      },
      { status: 422, statusText: 'Unprocessable' },
    );

    expect(error).toBeInstanceOf(ErrorReenvio);
    expect((error as ErrorReenvio).codigo).toBe('validation_failed');
    expect((error as ErrorReenvio).campos).toEqual([
      { campo: 'supports.traffic_report', codigo: 'not_replaced' },
    ]);
  });

  it('traduce los errores por su código o, sin cuerpo, por su estado', () => {
    const conCuerpo = (status: number, codigo: string) =>
      traducirErrorReenvio(
        new HttpErrorResponse({ status, error: { error: codigo, message: 'x' } }),
      ).codigo;
    const sinCuerpo = (status: number) =>
      traducirErrorReenvio(new HttpErrorResponse({ status })).codigo;

    expect(conCuerpo(409, 'stale_return')).toBe('stale_return');
    expect(conCuerpo(409, 'claim_not_returned')).toBe('claim_not_returned');
    expect(conCuerpo(500, 'otro')).toBe('claims_unavailable');
    expect(sinCuerpo(400)).toBe('invalid_request');
    expect(sinCuerpo(404)).toBe('claim_not_found');
    expect(sinCuerpo(409)).toBe('claim_not_returned');
    expect(sinCuerpo(422)).toBe('validation_failed');
    expect(sinCuerpo(503)).toBe('claims_unavailable');
    expect(traducirErrorReenvio(new Error('red')).codigo).toBe('claims_unavailable');
    expect(
      traducirErrorReenvio(
        new HttpErrorResponse({ status: 422, error: { error: 'validation_failed', fields: 'x' } }),
      ).campos,
    ).toEqual([]);
  });

  it('el historial falla con ErrorReenvio', () => {
    let error: unknown;
    servicio.consultarHistorial(ID_DEVUELTO).subscribe({ error: (e) => (error = e) });

    http
      .expectOne(url(`/v1/claims/${ID_DEVUELTO}/history`))
      .flush({ error: 'claim_not_found', message: 'x' }, { status: 404, statusText: 'Not Found' });

    expect((error as ErrorReenvio).codigo).toBe('claim_not_found');
  });
});
