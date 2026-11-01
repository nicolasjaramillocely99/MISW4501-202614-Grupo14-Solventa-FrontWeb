import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import {
  APROBACION_DTO,
  LISTADO_SOCIOS_DTO,
  ROTACION_DTO,
  SECRETO,
  SOCIO_ACTIVO_DTO,
  SOCIO_ID,
  SOCIO_PENDIENTE_DTO,
  SOCIO_PENDIENTE_ID,
} from '@testing/socios-pruebas';

import { SociosApiService } from './socios-api.service';
import {
  ErrorSocios,
  SolicitudRegistroSocio,
  mapearDetalleSocio,
  mapearListadoSocios,
  traducirErrorSocios,
} from './socios.modelos';

describe('SociosApiService (HU-W3.1-01)', () => {
  let servicio: SociosApiService;
  let http: HttpTestingController;
  const base = `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}/v1/partners`;

  const solicitud: SolicitudRegistroSocio = {
    nombre: ' Fintech Pagos ',
    codigo: 'ten_fintech',
    tipo: 'fintech',
    productos: ['viajes', ' ', ' hogar '],
    correoContactoTecnico: 'api@fintechpagos.co',
    cuota: { limiteDiario: 1000, limiteRafaga: 10, rafagaMaxima: 20 },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(SociosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los socios con los indicadores en camelCase', () => {
    let resultado: unknown;
    servicio.listar().subscribe((r) => (resultado = r));

    const peticion = http.expectOne(base);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(LISTADO_SOCIOS_DTO);

    const listado = mapearListadoSocios(LISTADO_SOCIOS_DTO);
    expect(resultado).toEqual(listado);
    expect(listado.items[0].consumo).toEqual({ fecha: '2026-11-01', usadas: 3120, restantes: 1880, porcentaje: 62.4 });
    expect(listado.items[2].consumo).toBeNull();
    expect(listado.indicadores).toEqual({
      sociosActivos: 3,
      cuotaMediaUsada: 80.7,
      cercaDelLimite: 1,
      nombresCercaDelLimite: ['Aerolínea Aliada'],
    });
  });

  it('registra con el cuerpo del contrato, sin espacios ni productos vacíos', () => {
    let resultado: unknown;
    servicio.registrar(solicitud).subscribe((r) => (resultado = r));

    const peticion = http.expectOne(base);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      name: 'Fintech Pagos',
      code: 'ten_fintech',
      type: 'fintech',
      products: ['viajes', 'hogar'],
      technical_contact_email: 'api@fintechpagos.co',
      quota: { daily_limit: 1000, rate_limit: 10, burst_limit: 20 },
    });
    peticion.flush(SOCIO_PENDIENTE_DTO, { status: 201, statusText: 'Created' });

    expect(resultado).toEqual(mapearDetalleSocio(SOCIO_PENDIENTE_DTO));
  });

  it('obtiene el detalle con las credenciales sin secreto', () => {
    let resultado: ReturnType<typeof mapearDetalleSocio> | undefined;
    servicio.obtener(SOCIO_ID).subscribe((r) => (resultado = r));

    http.expectOne(`${base}/${SOCIO_ID}`).flush(SOCIO_ACTIVO_DTO);

    expect(resultado?.credenciales?.activa).toEqual({
      credencialId: 'crd-activa',
      clientId: 'sol_7f3a91c2e8d4b06f5a1c91e2',
      pistaSecreto: 'a1c9',
      emitidaEn: '2026-03-03T15:30:00Z',
      emitidaPor: { tipo: 'operations', id: 'sub-operaciones', etiqueta: 'andres.ruiz@solventa.co' },
    });
    expect(JSON.stringify(resultado)).not.toContain(SECRETO);
    expect(resultado?.historial.map((e) => e.tipo)).toEqual(['credentials_issued', 'registered']);
  });

  it('un socio pendiente no tiene credenciales', () => {
    expect(mapearDetalleSocio(SOCIO_PENDIENTE_DTO).credenciales).toBeNull();
  });

  it('aprueba sin cuerpo y entrega el secreto una sola vez', () => {
    let resultado: { secreto: { clientSecret: string } } | undefined;
    servicio.aprobar(SOCIO_PENDIENTE_ID).subscribe((r) => (resultado = r));

    const peticion = http.expectOne(`${base}/${SOCIO_PENDIENTE_ID}/approval`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toBeNull();
    peticion.flush(APROBACION_DTO, { status: 201, statusText: 'Created' });

    expect(resultado?.secreto).toEqual({ clientId: 'sol_fintech0000000000000001', clientSecret: SECRETO, cabecera: 'x-api-key' });
  });

  it('rota con el periodo de transición pedido o sin él', () => {
    servicio.rotar(SOCIO_ID, 48).subscribe();
    const conHoras = http.expectOne(`${base}/${SOCIO_ID}/credential-rotations`);
    expect(conHoras.request.body).toEqual({ grace_period_hours: 48 });
    conHoras.flush(ROTACION_DTO, { status: 201, statusText: 'Created' });

    let resultado: { socio: { credenciales: unknown } } | undefined;
    servicio.rotar(SOCIO_ID, null).subscribe((r) => (resultado = r));
    const sinHoras = http.expectOne(`${base}/${SOCIO_ID}/credential-rotations`);
    expect(sinHoras.request.body).toEqual({});
    sinHoras.flush(ROTACION_DTO, { status: 201, statusText: 'Created' });

    expect(resultado?.socio.credenciales).toMatchObject({
      anterior: { clientId: 'sol_7f3a91c2e8d4b06f5a1c91e2', venceEn: '2026-11-02T14:00:00Z' },
      ultimaRotacionEn: '2026-11-01T14:00:00Z',
    });
  });

  it('traduce los errores del contrato con sus campos', () => {
    let error: unknown;
    servicio.registrar(solicitud).subscribe({ error: (e: unknown) => (error = e) });

    http.expectOne(base).flush(
      {
        error: 'validation_failed',
        message: 'x',
        fields: [
          { field: 'code', code: 'invalid_format' },
          { field: 'quota.burst_limit', code: 'out_of_range' },
          { field: 'products[1]', code: 'invalid_format' },
          { field: 'desconocido', code: 'required' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toBeInstanceOf(ErrorSocios);
    expect((error as ErrorSocios).campos).toEqual([
      { campo: 'codigo', codigo: 'invalid_format' },
      { campo: 'rafagaMaxima', codigo: 'out_of_range' },
      { campo: 'productos', codigo: 'invalid_format' },
    ]);
  });

  it('traduce los 409 y el 503 del gateway por su código', () => {
    for (const codigo of ['partner_code_taken', 'partner_not_pending', 'rotation_in_progress', 'partner_not_active'] as const) {
      expect(traducirErrorSocios(new HttpErrorResponse({ status: 409, error: { error: codigo, message: 'x' } })).codigo).toBe(codigo);
    }
    expect(traducirErrorSocios(new HttpErrorResponse({ status: 503, error: { error: 'gateway_unavailable' } })).codigo).toBe(
      'gateway_unavailable',
    );
  });

  it('sin cuerpo JSON decide por el estado HTTP', () => {
    const porEstado = (status: number) => traducirErrorSocios(new HttpErrorResponse({ status, error: 'texto' })).codigo;
    expect(porEstado(400)).toBe('validation_failed');
    expect(porEstado(401)).toBe('unauthorized');
    expect(porEstado(403)).toBe('forbidden');
    expect(porEstado(404)).toBe('partner_not_found');
    expect(porEstado(502)).toBe('service_unavailable');
    expect(traducirErrorSocios(new Error('red')).codigo).toBe('service_unavailable');
    expect(
      traducirErrorSocios(new HttpErrorResponse({ status: 400, error: { error: 'validation_failed', fields: 'x' } })).campos,
    ).toEqual([]);
  });
});
