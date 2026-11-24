import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';
import {
  PAGINA_REVISIONES_DTO,
  RADICACION_EN_REVISION_DTO,
  RESULTADO_APROBACION_DTO,
  RESULTADO_DEVOLUCION_DTO,
} from '@testing/revision-radicacion-pruebas';

import { PaginaCola } from './evaluacion.modelos';
import { ErrorRevision, RadicacionEnRevision, ResultadoRevision } from './revision.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · revisión del asesor (HU-W2.1-03)', () => {
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

  it('lista las radicaciones por revisar con el token de página', () => {
    let pagina: PaginaCola | undefined;
    servicio.listarRevisiones().subscribe((p) => (pagina = p));
    const primera = http.expectOne((req) => req.url === url('/v1/claims/reviews'));
    expect(primera.request.params.keys()).toEqual([]);
    primera.flush(PAGINA_REVISIONES_DTO);
    expect(pagina?.items.map((c) => c.numeroRadicado)).toEqual(['SIN-2026-01877']);
    expect(pagina?.siguienteToken).toBe('tok-2');

    servicio.listarRevisiones('tok-2').subscribe();
    const segunda = http.expectOne((req) => req.url === url('/v1/claims/reviews'));
    expect(segunda.request.params.get('page_token')).toBe('tok-2');
    segunda.flush({ items: [], next_page_token: null });
  });

  it('consulta la radicación a revisar', () => {
    let radicacion: RadicacionEnRevision | undefined;
    servicio.consultarRevision(ID_EVALUADO).subscribe((r) => (radicacion = r));

    http.expectOne(url(`/v1/claims/${ID_EVALUADO}/review`)).flush(RADICACION_EN_REVISION_DTO);

    expect(radicacion?.checklist).toHaveLength(4);
    expect(radicacion?.siniestrosPrevios).toHaveLength(1);
  });

  it('aprueba sin cuerpo y devuelve con el motivo, el mensaje y los veredictos', () => {
    let aprobada: ResultadoRevision | undefined;
    servicio.aprobarRadicacion(ID_EVALUADO).subscribe((r) => (aprobada = r));
    const aprobacion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/review-approval`));
    expect(aprobacion.request.method).toBe('POST');
    expect(aprobacion.request.body).toEqual({});
    aprobacion.flush(RESULTADO_APROBACION_DTO);
    expect(aprobada?.estado).toBe('in_evaluation');

    let devuelta: ResultadoRevision | undefined;
    servicio
      .devolverRadicacion(ID_EVALUADO, {
        motivo: 'illegible_or_incomplete_supports',
        mensaje: 'Falta la foto de la placa.',
        soportes: [{ codigoRequisito: 'plate_photo', veredicto: 'missing' }],
        datosACorregir: [],
      })
      .subscribe((r) => (devuelta = r));
    const devolucion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/review-return`));
    expect(devolucion.request.body).toEqual({
      reason_code: 'illegible_or_incomplete_supports',
      message: 'Falta la foto de la placa.',
      supports: [{ requirement_code: 'plate_photo', verdict: 'missing' }],
      facts_to_correct: [],
    });
    devolucion.flush(RESULTADO_DEVOLUCION_DTO);
    expect(devuelta?.revision.nombreRevisor).toBe('Juan Ríos');
  });

  it('traduce los errores al código del contrato', () => {
    const errores: ErrorRevision[] = [];
    servicio
      .consultarRevision(ID_EVALUADO)
      .subscribe({ error: (e: ErrorRevision) => errores.push(e) });
    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/review`))
      .flush({ error: 'claim_not_found' }, { status: 404, statusText: 'x' });

    servicio
      .aprobarRadicacion(ID_EVALUADO)
      .subscribe({ error: (e: ErrorRevision) => errores.push(e) });
    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/review-approval`))
      .flush({ error: 'supports_incomplete' }, { status: 422, statusText: 'x' });

    servicio.listarRevisiones().subscribe({ error: (e: ErrorRevision) => errores.push(e) });
    http
      .expectOne((req) => req.url === url('/v1/claims/reviews'))
      .error(new ProgressEvent('error'));

    expect(errores.map((e) => e.codigo)).toEqual([
      'claim_not_found',
      'supports_incomplete',
      'claims_unavailable',
    ]);
  });
});
