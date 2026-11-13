import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ASIGNACION_ASIGNADA_DTO,
  ASIGNACION_LISTA_DTO,
  ASIGNACION_PENDIENTE_DTO,
  ASIGNACION_PROPUESTA_DTO,
  LOTE_ASIGNACIONES_DTO,
  POLITICA_ASIGNACION_DTO,
  PRESTADORES_DTO,
  PRESTADOR_DTO,
} from '@testing/asignacion-pruebas';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';

import {
  AsignacionSiniestro,
  ErrorAsignacion,
  Prestador,
  ResumenAsignacion,
} from './asignacion.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · asignación del prestador (HU-W2.3-01)', () => {
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

  it('consulta la asignación del caso', () => {
    let asignacion: AsignacionSiniestro | undefined;
    servicio.consultarAsignacion(ID_EVALUADO).subscribe((a) => (asignacion = a));

    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/assignment`));
    expect(peticion.request.method).toBe('GET');
    peticion.flush(ASIGNACION_PROPUESTA_DTO);

    expect(asignacion?.estado).toBe('proposed');
  });

  it('codifica el id del caso en la ruta', () => {
    servicio.consultarAsignacion('../x').subscribe({ error: () => undefined });
    http
      .expectOne(url('/v1/claims/..%2Fx/assignment'))
      .flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('registra la dirección y el pin del analista', () => {
    servicio
      .registrarUbicacionIncidente(ID_EVALUADO, {
        direccion: 'Carrera 15 # 93-40',
        latitud: 4.6771,
        longitud: -74.0483,
      })
      .subscribe();

    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/incident-location`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      address: 'Carrera 15 # 93-40',
      latitude: 4.6771,
      longitude: -74.0483,
    });
    peticion.flush(ASIGNACION_LISTA_DTO);
  });

  it('busca sin cuerpo desde el radio inicial y con from_radius_km al ampliar', () => {
    let pendiente: AsignacionSiniestro | undefined;
    servicio.buscarPrestador(ID_EVALUADO).subscribe((a) => (pendiente = a));
    const inicial = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/provider-searches`));
    expect(inicial.request.method).toBe('POST');
    expect(inicial.request.body).toBeNull();
    inicial.flush(ASIGNACION_PENDIENTE_DTO);
    expect(pendiente?.estado).toBe('pending_assignment');

    servicio.buscarPrestador(ID_EVALUADO, 10).subscribe();
    const ampliada = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/provider-searches`));
    expect(ampliada.request.body).toEqual({ from_radius_km: 10 });
    ampliada.flush(ASIGNACION_PROPUESTA_DTO);
  });

  it('asigna con el prestador y la búsqueda que ve el analista', () => {
    let asignada: AsignacionSiniestro | undefined;
    servicio
      .asignarPrestador(ID_EVALUADO, 'prv-servicios-hogar-norte', 1)
      .subscribe((a) => (asignada = a));

    const peticion = http.expectOne(url(`/v1/claims/${ID_EVALUADO}/assignment`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      provider_id: 'prv-servicios-hogar-norte',
      search_seq: 1,
    });
    peticion.flush(ASIGNACION_ASIGNADA_DTO);

    expect(asignada?.asignacion?.prestador.nombre).toBe('Servicios Hogar Norte');
  });

  it.each([
    [409, 'provider_unavailable'],
    [409, 'search_outdated'],
    [409, 'assignment_exists'],
    [422, 'provider_not_eligible'],
  ])('falla con ErrorAsignacion ante un %i %s al asignar', (status, codigo) => {
    let error: unknown;
    servicio
      .asignarPrestador(ID_EVALUADO, 'prv-servicios-hogar-norte', 1)
      .subscribe({ error: (e) => (error = e) });
    http
      .expectOne(url(`/v1/claims/${ID_EVALUADO}/assignment`))
      .flush({ error: codigo, message: 'x' }, { status, statusText: 'Error' });

    expect(error).toBeInstanceOf(ErrorAsignacion);
    expect((error as ErrorAsignacion).codigo).toBe(codigo);
  });

  it('pide el lote con claim_id repetido en el orden dado', () => {
    let filas: ResumenAsignacion[] | undefined;
    const ids = LOTE_ASIGNACIONES_DTO.items.map((i) => i.claim_id);
    servicio.consultarAsignacionesLote(ids).subscribe((f) => (filas = f));

    const peticion = http.expectOne((req) => req.url === url('/v1/claims/assignments'));
    expect(peticion.request.params.getAll('claim_id')).toEqual(ids);
    peticion.flush(LOTE_ASIGNACIONES_DTO);

    expect(filas?.map((f) => f.estado)).toEqual(['assigned', 'pending_assignment', 'not_found']);
  });

  it('pide un lote de 50 ids en una sola llamada', () => {
    const ids = Array.from(
      { length: 50 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    servicio.consultarAsignacionesLote(ids).subscribe();

    const peticion = http.expectOne((req) => req.url === url('/v1/claims/assignments'));
    expect(peticion.request.params.getAll('claim_id')).toHaveLength(50);
    peticion.flush({ items: [] });
  });

  it('lee la política vigente', () => {
    let radios: number[] | undefined;
    servicio.consultarPoliticaAsignacion().subscribe((p) => (radios = p.radiosKm));
    http.expectOne(url('/v1/claims/assignment-policy')).flush(POLITICA_ASIGNACION_DTO);
    expect(radios).toEqual([5, 10, 20]);
  });

  it('lista los prestadores sin filtros y con los dos filtros', () => {
    let prestadores: Prestador[] | undefined;
    servicio.listarPrestadores().subscribe((p) => (prestadores = p));
    const todos = http.expectOne((req) => req.url === url('/v1/claims/providers'));
    expect(todos.request.params.keys()).toEqual([]);
    todos.flush({ items: PRESTADORES_DTO });
    expect(prestadores).toHaveLength(3);

    servicio.listarPrestadores({ especialidad: 'plumbing', disponibilidad: 'busy' }).subscribe();
    const filtrados = http.expectOne((req) => req.url === url('/v1/claims/providers'));
    expect(filtrados.request.params.get('specialty')).toBe('plumbing');
    expect(filtrados.request.params.get('availability')).toBe('busy');
    filtrados.flush({ items: [] });
  });

  it('consulta un prestador y traduce el 404', () => {
    servicio.consultarPrestador('prv-servicios-hogar-norte').subscribe();
    http.expectOne(url('/v1/claims/providers/prv-servicios-hogar-norte')).flush(PRESTADOR_DTO);

    let error: unknown;
    servicio.consultarPrestador('prv-no-existe').subscribe({ error: (e) => (error = e) });
    http
      .expectOne(url('/v1/claims/providers/prv-no-existe'))
      .flush(
        { error: 'provider_not_found', message: 'x' },
        { status: 404, statusText: 'Not Found' },
      );
    expect((error as ErrorAsignacion).codigo).toBe('provider_not_found');
  });

  it('cambia la disponibilidad, con la fecha solo si viene', () => {
    let prestador: Prestador | undefined;
    servicio
      .cambiarDisponibilidadPrestador('prv-servicios-hogar-norte', {
        disponibilidad: 'unavailable',
        hasta: '2026-09-22',
      })
      .subscribe((p) => (prestador = p));
    const conFecha = http.expectOne(
      url('/v1/claims/providers/prv-servicios-hogar-norte/availability'),
    );
    expect(conFecha.request.method).toBe('POST');
    expect(conFecha.request.body).toEqual({
      availability: 'unavailable',
      unavailable_until: '2026-09-22',
    });
    conFecha.flush({
      ...PRESTADOR_DTO,
      availability: 'unavailable',
      unavailable_until: '2026-09-22',
    });
    expect(prestador?.noDisponibleHasta).toBe('2026-09-22');

    servicio
      .cambiarDisponibilidadPrestador('prv-servicios-hogar-norte', { disponibilidad: 'available' })
      .subscribe();
    const liberar = http.expectOne(
      url('/v1/claims/providers/prv-servicios-hogar-norte/availability'),
    );
    expect(liberar.request.body).toEqual({ availability: 'available' });
    liberar.flush(PRESTADOR_DTO);
  });

  it('traduce el 503 y el error de red de las lecturas', () => {
    const errores: unknown[] = [];
    servicio.consultarPoliticaAsignacion().subscribe({ error: (e) => errores.push(e) });
    http
      .expectOne(url('/v1/claims/assignment-policy'))
      .flush(
        { error: 'claims_unavailable', message: 'x' },
        { status: 503, statusText: 'Unavailable' },
      );

    servicio.consultarAsignacion(ID_EVALUADO).subscribe({ error: (e) => errores.push(e) });
    http.expectOne(url(`/v1/claims/${ID_EVALUADO}/assignment`)).error(new ProgressEvent('error'));

    expect(errores.map((e) => (e as ErrorAsignacion).codigo)).toEqual([
      'claims_unavailable',
      'claims_unavailable',
    ]);
  });
});
