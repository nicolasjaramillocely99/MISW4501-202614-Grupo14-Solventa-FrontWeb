import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BANDEJA_DTO,
  DETALLE_ATENDIDA_DTO,
  DETALLE_CERRADA_DTO,
  DETALLE_CON_SUGERENCIA_DTO,
  DETALLE_DESPACHADA_DTO,
  DETALLE_UBICADA_POR_VOZ_DTO,
  ID_CON_GPS,
  ID_SIN_GPS,
  POLITICA_ASISTENCIA_DTO,
} from '@testing/asistencia-pruebas';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';

import {
  BandejaAsistencias,
  DetalleAsistencia,
  ErrorAsistencia,
  PoliticaAsistencia,
} from './asistencia.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · asistencias en sitio (HU-W2.3-03)', () => {
  let servicio: SiniestrosApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;
  const bandeja = url('/v1/claims/assistance-inbox');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('bandeja', () => {
    it('la lee sin filtros cuando no se piden', () => {
      let leida: BandejaAsistencias | undefined;
      servicio.listarBandejaAsistencias().subscribe((b) => (leida = b));

      const peticion = http.expectOne((r) => r.url === bandeja);
      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.keys()).toEqual([]);
      peticion.flush(BANDEJA_DTO);

      expect(leida?.solicitudes).toHaveLength(5);
      expect(leida?.resumen.despachadasHoy).toBe(6);
    });

    it('envía los estados como `status` repetido, en orden, y el límite', () => {
      servicio.listarBandejaAsistencias({ estados: ['new', 'in_call'], limite: 50 }).subscribe();

      const peticion = http.expectOne((r) => r.url === bandeja);
      expect(peticion.request.params.getAll('status')).toEqual(['new', 'in_call']);
      expect(peticion.request.params.get('limit')).toBe('50');
      peticion.flush(BANDEJA_DTO);
    });

    it('no envía una lista de estados vacía', () => {
      servicio.listarBandejaAsistencias({ estados: [] }).subscribe();

      const peticion = http.expectOne((r) => r.url === bandeja);
      expect(peticion.request.params.has('status')).toBe(false);
      peticion.flush(BANDEJA_DTO);
    });

    it('falla con ErrorAsistencia', () => {
      let error: unknown;
      servicio.listarBandejaAsistencias().subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne((r) => r.url === bandeja)
        .flush(null, { status: 503, statusText: 'Unavailable' });

      expect(error).toBeInstanceOf(ErrorAsistencia);
      expect((error as ErrorAsistencia).codigo).toBe('assistance_unavailable');
    });
  });

  it('consulta el detalle de una solicitud', () => {
    let detalle: DetalleAsistencia | undefined;
    servicio.consultarAsistencia(ID_CON_GPS).subscribe((d) => (detalle = d));

    const peticion = http.expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}`));
    expect(peticion.request.method).toBe('GET');
    peticion.flush(DETALLE_CON_SUGERENCIA_DTO);

    expect(detalle?.sugerencia.estado).toBe('found');
  });

  it('codifica el id de la solicitud en la ruta', () => {
    let error: unknown;
    servicio.consultarAsistencia('../x').subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne(url('/v1/claims/assistance-inbox/..%2Fx'))
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as ErrorAsistencia).codigo).toBe('assistance_request_not_found');
  });

  it('atiende sin cuerpo', () => {
    let detalle: DetalleAsistencia | undefined;
    servicio.atenderAsistencia(ID_CON_GPS).subscribe((d) => (detalle = d));

    const peticion = http.expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/attend`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toBeNull();
    peticion.flush(DETALLE_ATENDIDA_DTO);

    expect(detalle?.estado).toBe('in_call');
  });

  it('registra la necesidad', () => {
    servicio.registrarNecesidad(ID_CON_GPS, 'towing').subscribe();

    const peticion = http.expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/need`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ need: 'towing' });
    peticion.flush(DETALLE_CON_SUGERENCIA_DTO);
  });

  it('registra la ubicación por voz con la dirección sin espacios alrededor', () => {
    servicio
      .registrarUbicacionPorVoz(ID_SIN_GPS, {
        direccion: '  Vía Cali–Palmira km 4 ',
        latitud: 3.4921,
        longitud: -76.4203,
      })
      .subscribe();

    const peticion = http.expectOne(
      url(`/v1/claims/assistance-inbox/${ID_SIN_GPS}/voice-location`),
    );
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      address: 'Vía Cali–Palmira km 4',
      latitude: 3.4921,
      longitude: -76.4203,
    });
    peticion.flush(DETALLE_UBICADA_POR_VOZ_DTO);
  });

  it('despacha al prestador elegido', () => {
    let detalle: DetalleAsistencia | undefined;
    servicio
      .despacharAsistencia(ID_CON_GPS, 'prv-gruas-autopista-norte')
      .subscribe((d) => (detalle = d));

    const peticion = http.expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/dispatch`));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ provider_id: 'prv-gruas-autopista-norte' });
    peticion.flush(DETALLE_DESPACHADA_DTO);

    expect(detalle?.despacho?.prestador.nombre).toBe('Grúas Autopista Norte');
  });

  it('traduce el 422 de un prestador que dejó de ser elegible', () => {
    let error: unknown;
    servicio
      .despacharAsistencia(ID_CON_GPS, 'prv-gruas-calle-80')
      .subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/dispatch`))
      .flush(
        { error: 'provider_not_eligible', message: 'x' },
        { status: 422, statusText: 'Unprocessable' },
      );

    expect((error as ErrorAsistencia).codigo).toBe('provider_not_eligible');
  });

  it('cierra con el motivo y, si viene, la nota', () => {
    servicio.cerrarAsistencia(ID_CON_GPS, { motivo: 'resolved_by_phone' }).subscribe();
    const sinNota = http.expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/close`));
    expect(sinNota.request.body).toEqual({ reason: 'resolved_by_phone' });
    sinNota.flush(DETALLE_CERRADA_DTO);

    servicio
      .cerrarAsistencia(ID_CON_GPS, { motivo: 'other', nota: 'Le pasaron corriente' })
      .subscribe();
    const conNota = http.expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/close`));
    expect(conNota.request.method).toBe('POST');
    expect(conNota.request.body).toEqual({ reason: 'other', note: 'Le pasaron corriente' });
    conNota.flush(DETALLE_CERRADA_DTO);
  });

  it('traduce el 422 del cierre con sus campos', () => {
    let error: unknown;
    servicio
      .cerrarAsistencia(ID_CON_GPS, { motivo: 'other' })
      .subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne(url(`/v1/claims/assistance-inbox/${ID_CON_GPS}/close`))
      .flush(
        { error: 'validation_failed', message: 'x', fields: [{ field: 'note', code: 'required' }] },
        { status: 422, statusText: 'Unprocessable' },
      );

    expect((error as ErrorAsistencia).campos).toEqual([{ campo: 'note', codigo: 'required' }]);
  });

  it('consulta la política de la bandeja', () => {
    let politica: PoliticaAsistencia | undefined;
    servicio.consultarPoliticaAsistencia().subscribe((p) => (politica = p));

    const peticion = http.expectOne(url('/v1/claims/assistance-policy'));
    expect(peticion.request.method).toBe('GET');
    peticion.flush(POLITICA_ASISTENCIA_DTO);

    expect(politica?.motivosCierre).toHaveLength(6);
  });

  it('traduce el error de la política', () => {
    let error: unknown;
    servicio.consultarPoliticaAsistencia().subscribe({ error: (e: unknown) => (error = e) });

    http.expectOne(url('/v1/claims/assistance-policy')).error(new ProgressEvent('error'));

    expect((error as ErrorAsistencia).codigo).toBe('assistance_unavailable');
  });
});
