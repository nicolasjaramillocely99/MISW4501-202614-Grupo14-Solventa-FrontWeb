import { ActivatedRoute, provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import { DEVOLUCION_DTO } from '@testing/revision-radicacion-pruebas';
import { SINIESTRO_RADICADO_DTO } from '@testing/siniestros-pruebas';
import {
  TRIAGE_ASEGURADO_DTO,
  TRIAGE_ASEGURADO_PENDIENTE_DTO,
  TRIAGE_OPERACIONES_DTO,
} from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  HistorialSiniestro,
  HistorialSiniestroDto,
  mapearHistorialSiniestro,
} from '@core/api/siniestros/reenvio.modelos';
import {
  DetalleSiniestro,
  EnlaceSoporte,
  ErrorSiniestro,
  EstadoSiniestro,
  mapearDetalleSiniestro,
} from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { TriageSiniestro, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { DetalleSiniestroPage } from './detalle-siniestro.page';
import { INTERVALO_REFRESCO_MS } from './modelos/refresco';

const CAMBIO = '2026-09-16T15:02:00Z';
const CASO = mapearDetalleSiniestro({
  ...SINIESTRO_RADICADO_DTO,
  status: 'in_evaluation',
  estimated_amount_minor: 480000000,
  last_changed_at: CAMBIO,
});
const CASO_SIN_MONTO = mapearDetalleSiniestro(SINIESTRO_RADICADO_DTO);
const ASIGNADO = mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO);
const PENDIENTE = mapearTriageSiniestro(TRIAGE_ASEGURADO_PENDIENTE_DTO);
const APROBADA = {
  ...DEVOLUCION_DTO,
  outcome: 'approved' as const,
  reason_code: null,
  message: null,
  seq: 1,
};

/** El historial de un caso que llegó al estado, con lo que haga falta encima. */
function historial(
  estado: EstadoSiniestro,
  extra: Partial<HistorialSiniestroDto> = {},
): HistorialSiniestro {
  const cambios: HistorialSiniestroDto['changes'] = [
    { id: 1, status: 'active', previous_status: null, changed_at: SINIESTRO_RADICADO_DTO.filed_at },
  ];
  if (estado !== 'active') {
    cambios.push({ id: 2, status: estado, previous_status: 'active', changed_at: CAMBIO });
  }
  return mapearHistorialSiniestro({
    claim_id: CASO.id,
    filing_number: CASO.numeroRadicado,
    status: estado,
    last_changed_at: CAMBIO,
    changes: cambios,
    reviews: estado === 'active' ? [] : [APROBADA],
    last_return: null,
    resubmissions: [],
    requirements: [],
    decision: null,
    provider: null,
    ...extra,
  });
}

describe('DetalleSiniestroPage (A8 · HU-W2.1-02)', () => {
  let api: {
    consultarSiniestro: ReturnType<typeof vi.fn<(id: string) => Observable<DetalleSiniestro>>>;
    consultarHistorial: ReturnType<typeof vi.fn<(id: string) => Observable<HistorialSiniestro>>>;
    consultarTriage: ReturnType<typeof vi.fn<(id: string) => Observable<TriageSiniestro>>>;
    descargarSoporte: ReturnType<
      typeof vi.fn<(id: string, soporte: string) => Observable<EnlaceSoporte>>
    >;
    descargarRadicado: ReturnType<typeof vi.fn<(id: string) => Observable<Blob>>>;
  };

  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    }),
  );
  afterEach(() => vi.useRealTimers());

  async function renderizar({
    caso = of(CASO) as Observable<DetalleSiniestro>,
    hist = of(historial('in_evaluation')) as Observable<HistorialSiniestro>,
    triage = of(ASIGNADO) as Observable<TriageSiniestro>,
  } = {}) {
    api = {
      consultarSiniestro: vi.fn().mockReturnValue(caso),
      consultarHistorial: vi.fn().mockReturnValue(hist),
      consultarTriage: vi.fn().mockReturnValue(triage),
      descargarSoporte: vi.fn(),
      descargarRadicado: vi.fn(),
    };
    return render(DetalleSiniestroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => CASO.id } } } },
      ],
    });
  }

  const lineaDeTiempo = () => screen.getByRole('region', { name: 'Línea de tiempo' });
  const etapa = (clave: string) => document.querySelector<HTMLElement>(`[data-etapa="${clave}"]`)!;

  it('lee el caso, su historial y su prioridad en paralelo', async () => {
    await renderizar();

    expect(api.consultarSiniestro).toHaveBeenCalledWith(CASO.id);
    expect(api.consultarHistorial).toHaveBeenCalledWith(CASO.id);
    expect(api.consultarTriage).toHaveBeenCalledWith(CASO.id);
  });

  it('el encabezado dice la etapa y la fecha del último cambio, y los datos reportados (CA-1)', async () => {
    await renderizar();

    expect(
      screen.getByRole('heading', { level: 1, name: /Siniestro SIN-2026-01712/ }),
    ).toBeTruthy();
    expect(screen.getByText('En evaluación', { selector: '.insignia' })).toBeTruthy();
    expect(screen.getByText(/Radicado el .* · Último cambio .*/).textContent).toContain(
      'Autos · AU-2025-118204',
    );
    expect(screen.getByText(/Actualizado: /)).toBeTruthy();
    const dato = (nombre: string) =>
      screen.getByText(nombre, { selector: 'dt' }).nextElementSibling as HTMLElement;
    expect(dato('Lugar del hecho').textContent).toBe('Calle 80 con carrera 30, Bogotá');
    expect(dato('Monto estimado').textContent).toMatch(/4\.800\.000 COP/);
    expect(screen.getByRole('link', { name: 'Mis siniestros' }).getAttribute('href')).toBe(
      '/siniestros/mis-siniestros',
    );
  });

  it('si el caso no trae monto muestra «—»', async () => {
    await renderizar({ caso: of(CASO_SIN_MONTO), hist: of(historial('active')) });

    expect(
      screen
        .getByText('Monto estimado', { selector: 'dt' })
        .nextElementSibling?.textContent?.trim(),
    ).toBe('—');
  });

  it('en evaluación la etapa actual dice la prioridad, el tiempo estimado y el prestador', async () => {
    await renderizar({
      hist: of(
        historial('in_evaluation', {
          provider: { name: 'Servicios Hogar Norte', distance_km: 2.3, assigned_at: CAMBIO },
        }),
      ),
    });

    const actual = within(lineaDeTiempo()).getByRole('listitem', { current: 'step' });
    expect(actual.textContent).toContain('En evaluación');
    expect(actual.textContent).toContain(
      'Prioridad Triage 3 · Tiempo estimado de resolución: 10 días hábiles',
    );
    expect(actual.textContent).toContain('Prestador asignado: Servicios Hogar Norte (2.3 km)');
    expect(etapa('revision').textContent).toContain('Revisión del asesor: aprobada');
    expect(etapa('revision').textContent).toContain('Juan Ríos');
    expect(etapa('pagado').textContent).toContain('Desembolso a tu medio de pago registrado');
    expect(screen.getByText(/Servicios Hogar Norte atenderá tu siniestro/)).toBeTruthy();
    expect(screen.queryByText(/severidad/i)).toBeNull();
  });

  it('un caso pagado muestra el monto aprobado y la fecha del pago', async () => {
    const paid = historial('paid', {
      decision: {
        outcome: 'approved',
        decided_at: CAMBIO,
        amount_minor: 435_000_000,
        currency: 'COP',
        payout_status: 'confirmed',
        paid_at: '2026-09-18T15:00:00Z',
        rejection_reason: null,
      },
    });
    await renderizar({ caso: of({ ...CASO, estado: 'paid' }), hist: of(paid) });

    expect(etapa('aprobado').textContent).toMatch(/Monto aprobado: \$\s?4\.350\.000 COP/);
    expect(etapa('pagado').getAttribute('aria-current')).toBe('step');
    expect(etapa('pagado').textContent).toContain('Desembolsado a tu medio de pago registrado');
    expect(screen.getByText(/Tu siniestro está pagado/)).toBeTruthy();
  });

  it('un caso rechazado termina en «Rechazado» con su motivo', async () => {
    const rechazado = historial('rejected', {
      decision: {
        outcome: 'rejected',
        decided_at: CAMBIO,
        amount_minor: null,
        currency: null,
        payout_status: null,
        paid_at: null,
        rejection_reason: 'El daño no está cubierto por la póliza.',
      },
    });
    await renderizar({ caso: of({ ...CASO, estado: 'rejected' }), hist: of(rechazado) });

    expect(etapa('rechazado').textContent).toContain(
      'Motivo: El daño no está cubierto por la póliza.',
    );
    expect(document.querySelector('[data-etapa="pagado"]')).toBeNull();
  });

  it('un caso devuelto ofrece «Corregir y reenviar» (HU-W2.1-04)', async () => {
    const devuelto = historial('returned', {
      last_return: { ...DEVOLUCION_DTO, facts_to_correct: ['place'] },
    });
    await renderizar({ caso: of({ ...CASO, estado: 'returned' }), hist: of(devuelto) });

    expect(screen.getByText('El asesor devolvió tu radicación')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Corregir y reenviar' }).getAttribute('href')).toBe(
      `/siniestros/${CASO.id}/corregir`,
    );
    expect(etapa('revision').getAttribute('aria-current')).toBe('step');
    expect(etapa('revision').textContent).toContain('Revisión del asesor: devuelta');
    // «Agregar soporte» del encabezado lleva al mismo reenvío de A9.
    expect(screen.getByRole('link', { name: 'Agregar soporte' }).getAttribute('href')).toBe(
      `/siniestros/${CASO.id}/corregir`,
    );
  });

  it('un caso que no está devuelto no ofrece corregirlo', async () => {
    await renderizar();

    expect(screen.queryByRole('link', { name: 'Corregir y reenviar' })).toBeNull();
    // En evaluación no se agregan soportes: el backend solo los recibe con el reenvío.
    expect(screen.queryByRole('link', { name: 'Agregar soporte' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descargar radicado' })).toBeTruthy();
  });

  it('descarga un soporte con su enlace firmado', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    await renderizar();
    const enlace: EnlaceSoporte = {
      soporteId: SINIESTRO_RADICADO_DTO.supports.items[0].files[0].support_id,
      nombreArchivo: 'croquis.pdf',
      tipoContenido: 'application/pdf',
      tamanoBytes: 482113,
      url: 'https://bucket.test/croquis.pdf?firma=1',
      venceEn: CAMBIO,
    };
    api.descargarSoporte.mockReturnValue(of(enlace));

    expect(screen.getByText('croquis.pdf · PDF · 471 KB')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar croquis.pdf' }));

    expect(api.descargarSoporte).toHaveBeenCalledWith(CASO.id, enlace.soporteId);
    expect(abrir).toHaveBeenCalledWith(enlace.url, '_blank', 'noopener');
    abrir.mockRestore();
  });

  it('si la descarga falla lo dice en su soporte', async () => {
    const { detectChanges } = await renderizar();
    api.descargarSoporte.mockReturnValue(
      throwError(() => new ErrorSiniestro('claims_unavailable')),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Descargar croquis.pdf' }));
    detectChanges();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos descargar el archivo');
  });

  it('descarga el radicado en PDF, y si falla lo dice', async () => {
    const { detectChanges } = await renderizar();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:radicado');
    URL.revokeObjectURL = vi.fn();
    api.descargarRadicado.mockReturnValue(of(new Blob(['%PDF'])));

    fireEvent.click(screen.getByRole('button', { name: 'Descargar radicado' }));
    expect(api.descargarRadicado).toHaveBeenCalledWith(CASO.id);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:radicado');

    api.descargarRadicado.mockReturnValue(
      throwError(() => new ErrorSiniestro('claims_unavailable')),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Descargar radicado' }));
    detectChanges();
    expect(screen.getByText('No pudimos descargar el radicado. Inténtalo de nuevo.')).toBeTruthy();
  });

  it('cada minuto vuelve a leer el caso sin «Cargando», y un cambio de etapa se ve (CA-2)', async () => {
    const { detectChanges } = await renderizar();
    api.consultarSiniestro.mockReturnValue(of({ ...CASO, estado: 'approved' }));
    api.consultarHistorial.mockReturnValue(of(historial('approved')));

    await vi.advanceTimersByTimeAsync(INTERVALO_REFRESCO_MS);
    detectChanges();

    expect(api.consultarSiniestro).toHaveBeenCalledTimes(2);
    expect(api.consultarTriage).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Aprobado · pago en curso', { selector: '.insignia' })).toBeTruthy();
    expect(etapa('aprobado').getAttribute('aria-current')).toBe('step');
    expect(screen.queryByText('Consultando tu siniestro…')).toBeNull();
  });

  it('una relectura que falla deja el caso que ya se ve, y «Actualizar» lee al momento', async () => {
    const { detectChanges } = await renderizar();
    api.consultarHistorial.mockReturnValue(
      throwError(() => new ErrorSiniestro('claims_unavailable')),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    detectChanges();

    expect(api.consultarHistorial).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { level: 1, name: /SIN-2026-01712/ })).toBeTruthy();
  });

  it('con pending dice «Calculando prioridad…» y pasa al nivel con el sondeo', async () => {
    const { detectChanges } = await renderizar({ triage: of(PENDIENTE) });
    expect(screen.getByText('Calculando prioridad…')).toBeTruthy();

    api.consultarTriage.mockReturnValue(of(ASIGNADO));
    await vi.advanceTimersByTimeAsync(5_000);
    detectChanges();

    expect(screen.queryByText('Calculando prioridad…')).toBeNull();
    expect(etapa('evaluacion').textContent).toContain('Prioridad Triage 3');
  });

  it('si sigue pending a los 90 s se detiene y «Actualizar» de la prioridad vuelve a leer', async () => {
    const { detectChanges } = await renderizar({ triage: of(PENDIENTE) });

    await vi.advanceTimersByTimeAsync(95_000);
    detectChanges();

    expect(screen.getByText('La prioridad aún no está disponible')).toBeTruthy();
    api.consultarTriage.mockReturnValue(of(ASIGNADO));
    const aviso = screen
      .getByText('La prioridad aún no está disponible')
      .closest('.aviso') as HTMLElement;
    fireEvent.click(within(aviso).getByRole('button', { name: 'Actualizar' }));
    detectChanges();
    expect(etapa('evaluacion').textContent).toContain('Prioridad Triage 3');
  });

  it('si falla solo la prioridad, el caso se muestra y el bloque ofrece «Reintentar»', async () => {
    await renderizar({ triage: throwError(() => new ErrorSiniestro('claims_unavailable')) });

    expect(screen.getByRole('heading', { level: 1, name: /SIN-2026-01712/ })).toBeTruthy();
    expect(screen.getByText('No pudimos consultar la prioridad')).toBeTruthy();
    api.consultarTriage.mockReturnValue(of(ASIGNADO));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(etapa('evaluacion').textContent).toContain('Prioridad Triage 3');
  });

  it('la vista completa (no debería llegar al asegurado) se trata como error del bloque', async () => {
    await renderizar({ triage: of(mapearTriageSiniestro(TRIAGE_OPERACIONES_DTO)) });

    expect(screen.getByText('No pudimos consultar la prioridad')).toBeTruthy();
    expect(screen.queryByText(/severidad|monto alto/i)).toBeNull();
  });

  it('un 404 muestra «No encontramos este siniestro» con «Volver a Mis siniestros»', async () => {
    await renderizar({ caso: throwError(() => new ErrorSiniestro('claim_not_found')) });

    expect(screen.getByRole('heading', { name: 'No encontramos este siniestro' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a Mis siniestros' }).getAttribute('href')).toBe(
      '/siniestros/mis-siniestros',
    );
  });

  it('un 503 del caso muestra el error y «Reintentar» vuelve a leer', async () => {
    await renderizar({ caso: throwError(() => new ErrorSiniestro('claims_unavailable')) });
    expect(screen.getByRole('alert').textContent).toContain('El servicio no respondió');

    api.consultarSiniestro.mockReturnValue(of(CASO));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('heading', { level: 1, name: /SIN-2026-01712/ })).toBeTruthy();
  });
});
