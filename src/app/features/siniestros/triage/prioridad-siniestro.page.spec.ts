import { ActivatedRoute, provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import {
  ID_CASO_TRIAGE,
  TRIAGE_ASEGURADO_DTO,
  TRIAGE_OPERACIONES_DTO,
  TRIAGE_OPERACIONES_PENDIENTE_DTO,
} from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { TriageSiniestro, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { PrioridadSiniestroPage } from './prioridad-siniestro.page';

const ASIGNADO = mapearTriageSiniestro(TRIAGE_OPERACIONES_DTO);
const PENDIENTE = mapearTriageSiniestro(TRIAGE_OPERACIONES_PENDIENTE_DTO);

describe('PrioridadSiniestroPage (O6 reducida · HU-W2.2-01, F2)', () => {
  let consultarTriage: ReturnType<typeof vi.fn<(id: string) => Observable<TriageSiniestro>>>;

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  async function renderizar({ triage = of(ASIGNADO) as Observable<TriageSiniestro>, casos = null as string | null } = {}) {
    consultarTriage = vi.fn().mockReturnValue(triage);
    return render(PrioridadSiniestroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: { consultarTriage } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (k: string) => (k === 'id' ? ID_CASO_TRIAGE : null) },
              queryParamMap: { get: (k: string) => (k === 'casos' ? casos : null) },
            },
          },
        },
      ],
    });
  }

  it('muestra la prioridad y el historial del caso (CA-3, CA-4)', async () => {
    await renderizar();

    expect(consultarTriage).toHaveBeenCalledWith(ID_CASO_TRIAGE);
    expect(screen.getByRole('heading', { level: 1, name: `Siniestro ${ID_CASO_TRIAGE}` })).toBeTruthy();
    expect(screen.getByText('Triage 1 · severidad media · monto alto', { selector: 'span:not(.insignia)' })).toBeTruthy();
    const historial = within(screen.getByRole('region', { name: 'Historial de prioridad' }));
    expect(historial.getAllByRole('listitem')).toHaveLength(2);
    expect(historial.getByText(/Triage 2 asignado · automático/)).toBeTruthy();
    expect(historial.getByText(/Prioridad recalculada: Triage 2 → Triage 1 · Cambió el monto estimado/)).toBeTruthy();
  });

  it('las migas vuelven a la cola y conservan la búsqueda', async () => {
    await renderizar({ casos: 'a,b' });

    const migas = screen.getByRole('link', { name: 'Cola de siniestros' });

    expect(migas.getAttribute('href')).toBe('/siniestros/cola?casos=a,b');
  });

  it('sin búsqueda previa las migas van a la cola sin parámetros', async () => {
    await renderizar();

    expect(screen.getByRole('link', { name: 'Cola de siniestros' }).getAttribute('href')).toBe('/siniestros/cola');
  });

  it('con pending dice «Calculando prioridad…» y pasa a la prioridad con el sondeo (CA-1)', async () => {
    const { detectChanges } = await renderizar({ triage: of(PENDIENTE) });
    expect(screen.getByRole('status').textContent).toContain('Calculando prioridad…');
    expect(screen.queryByRole('region', { name: 'Historial de prioridad' })).toBeNull();

    consultarTriage.mockReturnValue(of(ASIGNADO));
    await vi.advanceTimersByTimeAsync(5_000);
    detectChanges();

    expect(consultarTriage).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Calculando prioridad…')).toBeNull();
    expect(screen.getByText(/Triage 1 · severidad media/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Historial de prioridad' })).toBeTruthy();
  });

  it('si sigue pending a los 90 s se detiene y «Actualizar» vuelve a leer', async () => {
    const { detectChanges } = await renderizar({ triage: of(PENDIENTE) });

    await vi.advanceTimersByTimeAsync(95_000);
    detectChanges();

    expect(screen.getByText('La prioridad aún no está disponible')).toBeTruthy();
    const llamadas = consultarTriage.mock.calls.length;
    consultarTriage.mockReturnValue(of(ASIGNADO));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    detectChanges();
    expect(consultarTriage).toHaveBeenCalledTimes(llamadas + 1);
    expect(screen.getByText(/Triage 1 · severidad media/)).toBeTruthy();
  });

  it('con not_applicable dice «Sin prioridad»', async () => {
    await renderizar({
      triage: of(mapearTriageSiniestro({ ...TRIAGE_OPERACIONES_PENDIENTE_DTO, state: 'not_applicable' })),
    });

    expect(screen.getByText('Sin prioridad')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Historial de prioridad' })).toBeNull();
  });

  it('un 404 muestra «No encontramos este siniestro» con «Volver a la cola»', async () => {
    await renderizar({ triage: throwError(() => new ErrorSiniestro('claim_not_found')) });

    expect(screen.getByRole('heading', { name: 'No encontramos este siniestro' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a la cola' }).getAttribute('href')).toBe('/siniestros/cola');
  });

  it('un 503 muestra el error y «Reintentar» vuelve a leer', async () => {
    await renderizar({ triage: throwError(() => new ErrorSiniestro('claims_unavailable')) });
    expect(screen.getByRole('alert').textContent).toContain('El servicio no respondió');

    consultarTriage.mockReturnValue(of(ASIGNADO));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText(/Triage 1 · severidad media/)).toBeTruthy();
  });

  it('la vista insured (no debería llegar al analista) se trata como error', async () => {
    await renderizar({ triage: of(mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO)) });

    expect(screen.getByRole('heading', { name: 'No pudimos consultar la prioridad' })).toBeTruthy();
    expect(screen.queryByText(/severidad/)).toBeNull();
  });
});
