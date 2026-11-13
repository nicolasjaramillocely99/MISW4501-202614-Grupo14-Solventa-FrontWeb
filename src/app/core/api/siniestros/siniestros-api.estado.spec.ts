import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';
import { HISTORIAL_DEVUELTO_DTO, ID_DEVUELTO } from '@testing/reenvio-radicacion-pruebas';
import { PAGINA_SINIESTROS_DTO } from '@testing/siniestros-pruebas';

import { HistorialSiniestro } from './reenvio.modelos';
import { EnlaceSoporte, ErrorSiniestro, PaginaSiniestros } from './siniestro.modelos';
import { SiniestrosApiService } from './siniestros-api.service';

describe('SiniestrosApiService · estado del siniestro para el asegurado (HU-W2.1-02)', () => {
  let servicio: SiniestrosApiService;
  let http: HttpTestingController;
  const url = (ruta: string) => `${CONFIGURACION_PRUEBAS.apiGatewayUrl.replace(/\/+$/, '')}${ruta}`;
  const SOPORTE = 'sup-0000000000000000000000000000000a';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('filtra por etapa y trae el último cambio y el resumen de todos los casos', () => {
    let pagina: PaginaSiniestros | undefined;
    servicio.listarSiniestros({ estado: 'returned' }).subscribe((p) => (pagina = p));

    const peticion = http.expectOne((req) => req.url === url('/v1/claims'));
    expect(peticion.request.params.get('status')).toBe('returned');
    peticion.flush({
      ...PAGINA_SINIESTROS_DTO,
      items: [
        { ...PAGINA_SINIESTROS_DTO.items[0], last_changed_at: '2026-09-15T14:12:00Z' },
        PAGINA_SINIESTROS_DTO.items[1],
      ],
      summary: {
        in_progress: 2,
        by_status: { returned: 1, in_evaluation: 1 },
        paid_this_year: { claims: 1, amount_minor: 18_000_000, currency: 'COP' },
        pending_action: [{ claim_id: 'c-1', filing_number: 'SIN-2026-01877' }],
        policies: [
          {
            policy_id: 'AU-2025-118204',
            line: 'auto',
            product: 'Autos',
            insured_object: 'KJT-482',
          },
          { policy_id: 'AU-2026-000001', line: null, product: null, insured_object: null },
        ],
      },
    });

    expect(pagina?.items[0].ultimoCambioEn).toBe('2026-09-15T14:12:00Z');
    // Sin dato, la radicación.
    expect(pagina?.items[1].ultimoCambioEn).toBe(PAGINA_SINIESTROS_DTO.items[1].filed_at);
    expect(pagina?.resumen).toEqual({
      enCurso: 2,
      porEstado: { returned: 1, in_evaluation: 1 },
      pagadosAnio: { casos: 1, montoMinor: 18_000_000, moneda: 'COP' },
      pendientes: [{ id: 'c-1', numeroRadicado: 'SIN-2026-01877' }],
      polizas: [
        { id: 'AU-2025-118204', ramo: 'auto', producto: 'Autos', objetoAsegurado: 'KJT-482' },
        { id: 'AU-2026-000001', ramo: null, producto: null, objetoAsegurado: null },
      ],
    });
  });

  it('sin resumen del backend la página no lo trae', () => {
    let pagina: PaginaSiniestros | undefined;
    servicio.listarSiniestros().subscribe((p) => (pagina = p));

    http.expectOne((req) => req.url === url('/v1/claims')).flush(PAGINA_SINIESTROS_DTO);

    expect(pagina?.resumen).toBeNull();
  });

  it('pide el enlace firmado de un soporte', () => {
    let enlace: EnlaceSoporte | undefined;
    servicio.descargarSoporte(ID_DEVUELTO, SOPORTE).subscribe((e) => (enlace = e));

    http.expectOne(url(`/v1/claims/${ID_DEVUELTO}/supports/${SOPORTE}/download`)).flush({
      support_id: SOPORTE,
      file_name: 'croquis.pdf',
      content_type: 'application/pdf',
      byte_size: 482113,
      download_url: 'https://bucket.test/croquis.pdf?firma=1',
      expires_at: '2026-09-16T15:10:00Z',
    });

    expect(enlace).toEqual({
      soporteId: SOPORTE,
      nombreArchivo: 'croquis.pdf',
      tipoContenido: 'application/pdf',
      tamanoBytes: 482113,
      url: 'https://bucket.test/croquis.pdf?firma=1',
      venceEn: '2026-09-16T15:10:00Z',
    });
  });

  it('un soporte que ya no es del caso falla con ErrorSiniestro', () => {
    let error: unknown;
    servicio.descargarSoporte(ID_DEVUELTO, SOPORTE).subscribe({ error: (e) => (error = e) });

    http
      .expectOne(url(`/v1/claims/${ID_DEVUELTO}/supports/${SOPORTE}/download`))
      .flush(
        { error: 'support_not_found', message: 'x' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toBeInstanceOf(ErrorSiniestro);
    expect((error as ErrorSiniestro).codigo).toBe('claim_not_found');
  });

  it('el historial trae la decisión y el prestador como los lee el asegurado', () => {
    let historial: HistorialSiniestro | undefined;
    servicio.consultarHistorial(ID_DEVUELTO).subscribe((h) => (historial = h));

    http.expectOne(url(`/v1/claims/${ID_DEVUELTO}/history`)).flush({
      ...HISTORIAL_DEVUELTO_DTO,
      status: 'paid',
      decision: {
        outcome: 'approved',
        decided_at: '2026-09-17T10:00:00Z',
        amount_minor: 435_000_000,
        currency: 'COP',
        payout_status: 'confirmed',
        paid_at: '2026-09-18T10:00:00Z',
        rejection_reason: null,
      },
      provider: {
        name: 'Servicios Hogar Norte',
        distance_km: 2.3,
        assigned_at: '2026-09-15T11:00:00Z',
      },
    });

    expect(historial?.decision).toEqual({
      resultado: 'approved',
      decididaEn: '2026-09-17T10:00:00Z',
      montoMinor: 435_000_000,
      moneda: 'COP',
      estadoPago: 'confirmed',
      pagadoEn: '2026-09-18T10:00:00Z',
      motivoRechazo: null,
    });
    expect(historial?.prestador).toEqual({
      nombre: 'Servicios Hogar Norte',
      distanciaKm: 2.3,
      asignadoEn: '2026-09-15T11:00:00Z',
    });
  });

  it('un historial sin decisión ni prestador los trae en null', () => {
    let historial: HistorialSiniestro | undefined;
    servicio.consultarHistorial(ID_DEVUELTO).subscribe((h) => (historial = h));

    http.expectOne(url(`/v1/claims/${ID_DEVUELTO}/history`)).flush(HISTORIAL_DEVUELTO_DTO);

    expect(historial?.decision).toBeNull();
    expect(historial?.prestador).toBeNull();
  });
});
