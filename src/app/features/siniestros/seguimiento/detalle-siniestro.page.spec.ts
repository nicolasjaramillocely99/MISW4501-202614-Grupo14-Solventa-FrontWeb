import { ActivatedRoute, provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import { SINIESTRO_RADICADO_DTO } from '@testing/siniestros-pruebas';
import { TRIAGE_ASEGURADO_DTO, TRIAGE_ASEGURADO_PENDIENTE_DTO, TRIAGE_OPERACIONES_DTO } from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { DetalleSiniestro, ErrorSiniestro, mapearDetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { TriageSiniestro, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { DetalleSiniestroPage } from './detalle-siniestro.page';

const CASO = mapearDetalleSiniestro({ ...SINIESTRO_RADICADO_DTO, estimated_amount_minor: 480000000 });
const CASO_SIN_MONTO = mapearDetalleSiniestro(SINIESTRO_RADICADO_DTO);
const ASIGNADO = mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO);
const PENDIENTE = mapearTriageSiniestro(TRIAGE_ASEGURADO_PENDIENTE_DTO);

describe('DetalleSiniestroPage (A8 mínima · HU-W2.2-01, F3)', () => {
  let api: {
    consultarSiniestro: ReturnType<typeof vi.fn<(id: string) => Observable<DetalleSiniestro>>>;
    consultarTriage: ReturnType<typeof vi.fn<(id: string) => Observable<TriageSiniestro>>>;
  };

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  async function renderizar({
    caso = of(CASO) as Observable<DetalleSiniestro>,
    triage = of(ASIGNADO) as Observable<TriageSiniestro>,
  } = {}) {
    api = { consultarSiniestro: vi.fn().mockReturnValue(caso), consultarTriage: vi.fn().mockReturnValue(triage) };
    return render(DetalleSiniestroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => CASO.id } } } },
      ],
    });
  }

  it('lee el caso y su prioridad en paralelo', async () => {
    await renderizar();

    expect(api.consultarSiniestro).toHaveBeenCalledWith(CASO.id);
    expect(api.consultarTriage).toHaveBeenCalledWith(CASO.id);
  });

  it('muestra el encabezado con la insignia «Radicado» y los datos reportados con el monto estimado', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: /Siniestro SIN-2026-01712/ })).toBeTruthy();
    expect(screen.getByText('Radicado', { selector: '.insignia' })).toBeTruthy();
    const dato = (nombre: string) => screen.getByText(nombre, { selector: 'dt' }).nextElementSibling as HTMLElement;
    expect(dato('Póliza').textContent).toBe('Autos · AU-2025-118204 · KJT-482');
    expect(dato('Tipo de siniestro').textContent).toBe('Colisión con daños al vehículo');
    expect(dato('Lugar del hecho').textContent).toBe('Calle 80 con carrera 30, Bogotá');
    expect(dato('Monto estimado').textContent).toMatch(/4\.800\.000 COP/);
    expect(screen.getByRole('link', { name: 'Mis siniestros' }).getAttribute('href')).toBe('/siniestros/mis-siniestros');
  });

  it('si el caso no trae monto muestra «—»', async () => {
    await renderizar({ caso: of(CASO_SIN_MONTO) });

    expect(screen.getByText('Monto estimado', { selector: 'dt' }).nextElementSibling?.textContent).toBe('—');
  });

  it('en la etapa «En evaluación» dice la prioridad y el tiempo estimado, sin severidad ni banda (CA-4)', async () => {
    await renderizar();

    const etapas = screen.getByRole('region', { name: 'Etapas del siniestro' });
    expect(within(etapas).getByText('Prioridad Triage 3')).toBeTruthy();
    expect(within(etapas).getByText('Tiempo estimado de resolución: 10 días hábiles')).toBeTruthy();
    expect(within(etapas).getByRole('listitem', { current: 'step' }).textContent).toContain('En evaluación');
    expect(screen.queryByText(/severidad/i)).toBeNull();
  });

  it('con pending dice «Calculando prioridad…» y pasa al nivel con el sondeo (CA-1)', async () => {
    const { detectChanges } = await renderizar({ triage: of(PENDIENTE) });
    expect(screen.getByRole('status').textContent).toContain('Calculando prioridad…');

    api.consultarTriage.mockReturnValue(of(ASIGNADO));
    await vi.advanceTimersByTimeAsync(5_000);
    detectChanges();

    expect(api.consultarTriage).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Calculando prioridad…')).toBeNull();
    expect(screen.getByText('Prioridad Triage 3')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.consultarTriage).toHaveBeenCalledTimes(2);
  });

  it('si sigue pending a los 90 s se detiene y «Actualizar» vuelve a leer', async () => {
    const { detectChanges } = await renderizar({ triage: of(PENDIENTE) });

    await vi.advanceTimersByTimeAsync(95_000);
    detectChanges();

    expect(screen.getByText('La prioridad aún no está disponible')).toBeTruthy();
    api.consultarTriage.mockReturnValue(of(ASIGNADO));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    detectChanges();
    expect(screen.getByText('Prioridad Triage 3')).toBeTruthy();
  });

  it('con not_applicable no pinta el bloque de prioridad y el caso sigue en «Radicado»', async () => {
    await renderizar({
      triage: of(mapearTriageSiniestro({ ...TRIAGE_ASEGURADO_PENDIENTE_DTO, state: 'not_applicable' })),
    });

    expect(screen.queryByText(/Prioridad Triage/)).toBeNull();
    expect(screen.queryByText('Calculando prioridad…')).toBeNull();
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toContain('Radicado');
  });

  it('si falla solo la prioridad, el caso se muestra y el bloque ofrece «Reintentar»', async () => {
    await renderizar({ triage: throwError(() => new ErrorSiniestro('claims_unavailable')) });

    expect(screen.getByRole('heading', { level: 1, name: /SIN-2026-01712/ })).toBeTruthy();
    expect(screen.getByText('No pudimos consultar la prioridad')).toBeTruthy();
    api.consultarTriage.mockReturnValue(of(ASIGNADO));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('Prioridad Triage 3')).toBeTruthy();
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
