import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { PAGINA_COLA_PRIORIDAD_DTO } from '@testing/evaluacion-pruebas';

import {
  ErrorEvaluacion,
  PaginaColaPrioridad,
  mapearPaginaColaPrioridad,
} from './evaluacion.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · cola por prioridad (HU-W2.2-02)', () => {
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

  it('lee la cola sin filtros y con todos los filtros y el token', () => {
    let pagina: PaginaColaPrioridad | undefined;
    servicio.listarColaPrioridad().subscribe((p) => (pagina = p));
    const sinFiltros = http.expectOne((req) => req.url === url('/v1/claims/evaluations'));
    expect(sinFiltros.request.params.keys()).toEqual([]);
    sinFiltros.flush(PAGINA_COLA_PRIORIDAD_DTO);
    expect(pagina?.items).toHaveLength(2);

    servicio
      .listarColaPrioridad({ nivel: 'none', ramo: 'auto', estado: 'in_evaluation' }, 'tok-2')
      .subscribe();
    const filtrada = http.expectOne((req) => req.url === url('/v1/claims/evaluations'));
    expect(filtrada.request.params.toString()).toBe(
      'level=none&line=auto&status=in_evaluation&page_token=tok-2',
    );
    filtrada.flush(PAGINA_COLA_PRIORIDAD_DTO);
  });

  it('traduce el error al código del contrato', () => {
    let error: ErrorEvaluacion | undefined;
    servicio
      .listarColaPrioridad({ nivel: '1' })
      .subscribe({ error: (e: ErrorEvaluacion) => (error = e) });
    http
      .expectOne((req) => req.url === url('/v1/claims/evaluations'))
      .flush({ error: 'invalid_request' }, { status: 400, statusText: 'x' });
    expect(error?.codigo).toBe('invalid_request');
  });

  it('mapea el asegurado de cada fila y los indicadores de toda la cola', () => {
    const p = mapearPaginaColaPrioridad(PAGINA_COLA_PRIORIDAD_DTO);

    expect(p.items[0].asegurado).toEqual({
      nombreCompleto: 'Carolina Pérez Ruiz',
      tipoDocumento: 'CC',
      documento: '1020345678',
    });
    expect(p.items[1].asegurado).toBeNull();
    expect(p.resumen).toEqual({
      total: 22,
      coinciden: 2,
      porNivel: { 1: 3, 2: 7, 3: 12 },
      sinNivel: 0,
      tiempoMedioDias: 4.2,
      decididosEnVentana: 18,
      diasVentana: 30,
    });
    const sinNiveles = mapearPaginaColaPrioridad({
      ...PAGINA_COLA_PRIORIDAD_DTO,
      summary: { ...PAGINA_COLA_PRIORIDAD_DTO.summary, levels: [] },
    });
    expect(sinNiveles.resumen.porNivel).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});
