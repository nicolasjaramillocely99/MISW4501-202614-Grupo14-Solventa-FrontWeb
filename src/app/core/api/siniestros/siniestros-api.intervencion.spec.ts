import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';
import {
  INTERVENCION_CERRADA_DTO,
  INTERVENCION_EN_CURSO_DTO,
  INTERVENCION_SIN_PRESTADOR_DTO,
} from '@testing/intervencion-pruebas';

import { ErrorIntervencion, Intervencion, traducirErrorIntervencion } from './intervencion.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · seguimiento de la intervención (HU-W2.3-02)', () => {
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

  it('consulta la intervención y la traduce al modelo del front', () => {
    let intervencion: Intervencion | undefined;
    servicio.consultarIntervencion(ID_EVALUADO).subscribe((i) => (intervencion = i));

    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/intervention`));
    expect(peticion.request.method).toBe('GET');
    peticion.flush(INTERVENCION_EN_CURSO_DTO);

    expect(intervencion?.estado).toBe('in_progress');
    expect(intervencion?.asignacion?.prestador).toEqual({
      id: 'prv-servicios-hogar-norte',
      nombre: 'Servicios Hogar Norte',
      correo: 'despachos@hogarnorte.example.com',
      telefono: '+57 601 555 0102',
      distanciaKm: 2.3,
    });
    expect(intervencion?.pasos.map((p) => p.paso)).toEqual(['accepted', 'en_route', 'visit_done']);
    expect(intervencion?.pasos[0].observacion).toBe('visita programada 15/09/2026 8:00 a 12:00');
    expect(intervencion?.pasos[0].registradoPor).toEqual({
      correo: 'andres.ruiz@solventa.example',
      nombre: 'Andrés Ruiz',
    });
    expect(intervencion?.informe).toEqual({
      causa: 'Filtración por tubería del piso superior',
      dano: 'Techo y muro de cocina · 6 m²',
      costoReparacionCentavos: 435_000_000,
      diasReparacion: 2,
      fotos: 8,
    });
    expect(intervencion?.pasoSiguiente).toBe('repair_authorized');
    expect(intervencion?.faltantes).toEqual(['repair_authorized', 'repair_executed']);
    expect(intervencion?.cierre).toBeNull();
  });

  it('lee el cierre y un caso sin prestador', () => {
    let cerrada: Intervencion | undefined;
    let sinPrestador: Intervencion | undefined;
    servicio.consultarIntervencion(ID_EVALUADO).subscribe((i) => (cerrada = i));
    http.expectOne(url(`/v1/claims/${ID_EVALUADO}/intervention`)).flush(INTERVENCION_CERRADA_DTO);
    servicio.consultarIntervencion(ID_EVALUADO).subscribe((i) => (sinPrestador = i));
    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/intervention`))
      .flush(INTERVENCION_SIN_PRESTADOR_DTO);

    expect(cerrada?.cierre).toEqual({
      resultado: 'repaired',
      cerradoEn: '2026-09-18T22:00:00Z',
      observaciones: 'Asegurada conforme',
      cerradoPor: { correo: 'andres.ruiz@solventa.example', nombre: 'Andrés Ruiz' },
      registradoEn: '2026-09-18T22:01:00Z',
    });
    expect(sinPrestador?.asignacion).toBeNull();
    expect(sinPrestador?.estado).toBe('not_assigned');
  });

  it('registra un avance sin observación vacía y la visita con su informe', () => {
    servicio
      .registrarAvance(ID_EVALUADO, {
        paso: 'accepted',
        ocurridoEn: '2026-09-06T15:40:00.000Z',
        observacion: '  ',
      })
      .subscribe();
    let peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/intervention/steps`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      step: 'accepted',
      occurred_at: '2026-09-06T15:40:00.000Z',
    });
    peticion.flush(INTERVENCION_EN_CURSO_DTO, { status: 201, statusText: 'Created' });

    servicio
      .registrarAvance(ID_EVALUADO, {
        paso: 'visit_done',
        ocurridoEn: '2026-09-15T14:30:00.000Z',
        observacion: ' informe PDF firmado ',
        informe: {
          causa: 'Filtración',
          dano: 'Techo',
          costoReparacionCentavos: 435_000_000,
          diasReparacion: 2,
          fotos: 8,
        },
      })
      .subscribe();
    peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/intervention/steps`));
    expect(peticion.request.body).toEqual({
      step: 'visit_done',
      occurred_at: '2026-09-15T14:30:00.000Z',
      note: 'informe PDF firmado',
      report: {
        cause: 'Filtración',
        damage: 'Techo',
        repair_cost_minor: 435_000_000,
        repair_days: 2,
        photos: 8,
      },
    });
    peticion.flush(INTERVENCION_EN_CURSO_DTO, { status: 201, statusText: 'Created' });
  });

  it('cierra el caso con su resultado', () => {
    servicio
      .cerrarCaso(ID_EVALUADO, {
        resultado: 'repaired',
        cerradoEn: '2026-09-18T22:00:00.000Z',
        observaciones: 'ok',
      })
      .subscribe();
    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/closure`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      result: 'repaired',
      closed_at: '2026-09-18T22:00:00.000Z',
      notes: 'ok',
    });
    peticion.flush(INTERVENCION_CERRADA_DTO, { status: 201, statusText: 'Created' });

    servicio
      .cerrarCaso(ID_EVALUADO, { resultado: 'repaired', cerradoEn: '2026-09-18T22:00:00.000Z' })
      .subscribe();
    expect(http.expectOne(url(`/v1/claims/${ID_EVALUADO}/closure`)).request.body).toEqual({
      result: 'repaired',
      closed_at: '2026-09-18T22:00:00.000Z',
    });
  });

  it('un cierre antes de tiempo trae los pasos que faltan (CA-4)', () => {
    let error: ErrorIntervencion | undefined;
    servicio
      .cerrarCaso(ID_EVALUADO, { resultado: 'repaired', cerradoEn: '2026-09-18T22:00:00.000Z' })
      .subscribe({ error: (e: ErrorIntervencion) => (error = e) });
    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/closure`))
      .flush(
        {
          error: 'intervention_not_finished',
          message: 'x',
          missing: ['repair_authorized', 'teleported', 'repair_executed'],
        },
        { status: 409, statusText: 'Conflict' },
      );

    expect(error).toBeInstanceOf(ErrorIntervencion);
    expect(error?.codigo).toBe('intervention_not_finished');
    expect(error?.faltantes).toEqual(['repair_authorized', 'repair_executed']);
  });

  it('traduce los errores del contrato, los 422 con sus campos y los que no reconoce', () => {
    let error: ErrorIntervencion | undefined;
    servicio
      .registrarAvance(ID_EVALUADO, { paso: 'visit_done', ocurridoEn: 'x' })
      .subscribe({ error: (e: ErrorIntervencion) => (error = e) });
    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/intervention/steps`))
      .flush(
        {
          error: 'validation_failed',
          message: 'x',
          fields: [{ field: 'report', code: 'required' }, { nada: 1 }],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    expect(error?.campos).toEqual([{ campo: 'report', codigo: 'required' }]);
    expect(error?.faltantes).toEqual([]);

    const respuesta = (status: number, cuerpo: unknown = null) =>
      traducirErrorIntervencion(new HttpErrorResponse({ status, error: cuerpo })).codigo;
    expect(respuesta(409, { error: 'step_out_of_order' })).toBe('step_out_of_order');
    expect(respuesta(409, { error: 'case_closed' })).toBe('case_closed');
    expect(respuesta(400)).toBe('invalid_request');
    expect(respuesta(404)).toBe('claim_not_found');
    expect(respuesta(502, { error: 'otro' })).toBe('claims_unavailable');
    expect(traducirErrorIntervencion(new Error('red')).codigo).toBe('claims_unavailable');
  });
});
