import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { ACCIONES_DTO, LISTA_EMISIONES_DTO } from '@testing/emision-monitor-pruebas';

import { ErrorEmision, ListaEmisiones } from './emision-monitor.modelos';
import { OriginacionApiService } from './originacion-api.service';

const SIN_FILTROS = { estado: null, canal: null, desde: null, hasta: null };

describe('OriginacionApiService · monitoreo de emisiones (HU-W1.3-04)', () => {
  let servicio: OriginacionApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(OriginacionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las emisiones y los conteos; sin filtros solo envía el inicio del día', () => {
    let resultado: ListaEmisiones | undefined;
    servicio.listarEmisiones(SIN_FILTROS).subscribe((lista) => (resultado = lista));

    const peticion = http.expectOne((r) => r.url === url('/v1/issuances'));
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys()).toEqual(['day_from']);
    peticion.flush(LISTA_EMISIONES_DTO);

    expect(resultado?.emisiones.map((e) => e.aceptacionId)).toEqual([
      'acc-0004',
      'acc-0005',
      'acc-0006',
      'acc-0003',
      'acc-0002',
      'acc-0001',
    ]);
    expect(resultado?.conteos.notificadasHoy).toBe(40);
  });

  it('envía el estado, el canal y el rango de fechas con los nombres del contrato', () => {
    servicio.listarEmisiones({ estado: 'notified', canal: 'web', desde: '2026-10-19', hasta: '2026-10-20' }).subscribe();

    const peticion = http.expectOne((r) => r.url === url('/v1/issuances'));
    expect(peticion.request.params.get('status')).toBe('notified');
    expect(peticion.request.params.get('channel')).toBe('web');
    expect(peticion.request.params.get('from')).toMatch(/^2026-10-(19|18)T/);
    expect(peticion.request.params.get('to')).toMatch(/^2026-10-(20|21)T/);
    peticion.flush({ items: [], counts: LISTA_EMISIONES_DTO.counts });
  });

  it('sin resultados devuelve una lista vacía, no un error', () => {
    let resultado: ListaEmisiones | undefined;
    servicio.listarEmisiones({ ...SIN_FILTROS, estado: 'active' }).subscribe((lista) => (resultado = lista));

    http.expectOne((r) => r.url === url('/v1/issuances')).flush({ items: [], counts: LISTA_EMISIONES_DTO.counts });

    expect(resultado?.emisiones).toEqual([]);
  });

  it('traduce un error del servidor al código estable', () => {
    let error: unknown;
    servicio.listarEmisiones(SIN_FILTROS).subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne((r) => r.url === url('/v1/issuances'))
      .flush({ error: 'charge_unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toBeInstanceOf(ErrorEmision);
    expect((error as ErrorEmision).codigo).toBe('charge_unavailable');
  });

  it('lee el historial de acciones de una aceptación', () => {
    let resultado: readonly { autor: string }[] | undefined;
    servicio.listarAccionesEmision('acc/0004').subscribe((lista) => (resultado = lista));

    const peticion = http.expectOne(url('/v1/issuances/acc%2F0004/actions'));
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ items: ACCIONES_DTO });

    expect(resultado?.map((a) => a.autor)).toEqual(['ops-2', 'ops-1']);
  });

  it('reintenta con la nota y devuelve qué se reintentó', () => {
    let accion: string | undefined;
    servicio.reintentarEmision('acc-0004', 'Pasarela restablecida').subscribe((r) => (accion = r.accion));

    const peticion = http.expectOne(url('/v1/issuances/acc-0004/retry'));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ note: 'Pasarela restablecida' });
    peticion.flush({ acceptance_id: 'acc-0004', action: 'retry' }, { status: 202, statusText: 'Accepted' });

    expect(accion).toBe('retry');
  });

  it('un 409 al reintentar es issuance_not_retryable', () => {
    let error: unknown;
    servicio.reintentarEmision('acc-0004', 'otra').subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne(url('/v1/issuances/acc-0004/retry'))
      .flush({ error: 'issuance_not_retryable' }, { status: 409, statusText: 'Conflict' });

    expect((error as ErrorEmision).codigo).toBe('issuance_not_retryable');
  });
});
