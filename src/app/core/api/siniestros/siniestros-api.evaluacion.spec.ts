import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import {
  APROBACION_EN_CURSO_DTO,
  EVALUACION_DTO,
  ID_EVALUADO,
  PAGINA_COLA_DTO,
  RECHAZO_DTO,
} from '@testing/evaluacion-pruebas';

import { Decision, ErrorEvaluacion, Evaluacion, PaginaCola } from './evaluacion.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · evaluación y decisión (HU-W2.2-03)', () => {
  let servicio: SiniestrosApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista la cola de evaluación y las excepciones de pago con el token de página', () => {
    let pagina: PaginaCola | undefined;
    servicio.listarCola('evaluations').subscribe((p) => (pagina = p));
    const cola = http.expectOne((req) => req.url === url('/v1/claims/evaluations'));
    expect(cola.request.params.keys()).toEqual([]);
    cola.flush(PAGINA_COLA_DTO);
    expect(pagina?.items).toHaveLength(2);

    servicio.listarCola('payment-exceptions', 'tok-2').subscribe();
    const excepciones = http.expectOne((req) => req.url === url('/v1/claims/payment-exceptions'));
    expect(excepciones.request.params.get('page_token')).toBe('tok-2');
    excepciones.flush({ items: [], next_page_token: null });
  });

  it('consulta la evaluación de un caso', () => {
    let evaluacion: Evaluacion | undefined;
    servicio.consultarEvaluacion(ID_EVALUADO).subscribe((e) => (evaluacion = e));

    http.expectOne(url(`/v1/claims/${ID_EVALUADO}/evaluation`)).flush(EVALUACION_DTO);

    expect(evaluacion?.siniestro.numeroRadicado).toBe('SIN-2026-01655');
  });

  it('aprueba enviando el costo bruto en centavos', () => {
    let decision: Decision | undefined;
    servicio.aprobar(ID_EVALUADO, 4_350_000).subscribe((d) => (decision = d));

    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/approval`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ gross_amount_minor: 435_000_000 });
    peticion.flush(APROBACION_EN_CURSO_DTO, { status: 202, statusText: 'Accepted' });

    expect(decision?.aprobacion?.neto).toBe(4_132_500);
  });

  it('rechaza con el motivo', () => {
    servicio.rechazar(ID_EVALUADO, 'Preexistente').subscribe();

    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/rejection`));
    expect(peticion.request.body).toEqual({ reason: 'Preexistente' });
    peticion.flush(RECHAZO_DTO);
  });

  it('reintenta el pago con el destino corregido o al mismo destino', () => {
    servicio
      .reintentarPago(ID_EVALUADO, { codigoBanco: '1007', nombreBanco: 'Banco Aliado', tipoCuenta: 'savings', numeroCuenta: '0123-4567-12' })
      .subscribe();
    const corregido = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/payout-retry`));
    expect(corregido.request.body).toEqual({
      destination: { bank_code: '1007', bank_name: 'Banco Aliado', account_type: 'savings', account_number: '0123-4567-12' },
    });
    corregido.flush(APROBACION_EN_CURSO_DTO, { status: 202, statusText: 'Accepted' });

    servicio.reintentarPago(ID_EVALUADO).subscribe();
    const mismo = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/payout-retry`));
    expect(mismo.request.body).toEqual({});
    mismo.flush(APROBACION_EN_CURSO_DTO, { status: 202, statusText: 'Accepted' });
  });

  it('traduce el error de la decisión al código del contrato', () => {
    let error: unknown;
    servicio.aprobar(ID_EVALUADO, 1).subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/approval`))
      .flush({ error: 'amount_exceeds_insured_value', message: 'x' }, { status: 422, statusText: 'Unprocessable Entity' });

    expect(error).toEqual(new ErrorEvaluacion('amount_exceeds_insured_value'));
  });

  it('traduce el error de las lecturas', () => {
    const errores: unknown[] = [];
    servicio.listarCola('evaluations').subscribe({ error: (e: unknown) => errores.push(e) });
    servicio.consultarEvaluacion('x').subscribe({ error: (e: unknown) => errores.push(e) });

    http.expectOne(url('/v1/claims/evaluations')).flush(null, { status: 503, statusText: 'Unavailable' });
    http.expectOne(url('/v1/claims/x/evaluation')).flush({ error: 'claim_not_found' }, { status: 404, statusText: 'Not Found' });

    expect(errores).toEqual([new ErrorEvaluacion('claims_unavailable'), new ErrorEvaluacion('claim_not_found')]);
  });
});
