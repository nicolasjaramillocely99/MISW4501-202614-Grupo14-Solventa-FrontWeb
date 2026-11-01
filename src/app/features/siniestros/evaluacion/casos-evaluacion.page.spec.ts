import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ID_EVALUADO, PAGINA_COLA_DTO } from '@testing/evaluacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { ErrorEvaluacion, PaginaCola, mapearPaginaCola } from '@core/api/siniestros/evaluacion.modelos';
import { ListaOperaciones, SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { CasosEvaluacionPage } from './casos-evaluacion.page';

const PAGINA = mapearPaginaCola(PAGINA_COLA_DTO);

describe('CasosEvaluacionPage (HU-W2.2-03)', () => {
  let listar: ReturnType<typeof vi.fn<(lista: ListaOperaciones, token?: string) => Observable<PaginaCola>>>;

  async function renderizar(pagina: Observable<PaginaCola> = of(PAGINA)) {
    listar = vi.fn().mockReturnValue(pagina);
    await render(CasosEvaluacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), { provide: SiniestrosApiService, useValue: { listarCola: listar } }],
    });
    return userEvent.setup();
  }

  it('lista los casos en evaluación con su prioridad, monto y la acción «Evaluar» (CA-1)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Casos en evaluación' })).toBeTruthy();
    expect(listar).toHaveBeenCalledWith('evaluations');
    const filas = screen.getAllByRole('row');
    const primera = within(filas[1]);
    expect(primera.getByText('Triage 2')).toBeTruthy();
    expect(primera.getByText('SIN-2026-01655')).toBeTruthy();
    expect(primera.getByText('Hogar · Daño por agua')).toBeTruthy();
    expect(primera.getByText(/4\.800\.000/)).toBeTruthy();
    expect(primera.getByRole('link', { name: 'Abrir el siniestro SIN-2026-01655' }).getAttribute('href')).toBe(
      `/siniestros/${ID_EVALUADO}/evaluar`,
    );
    // HU-W2.2-01: la prioridad del caso y la cola por id siguen a un clic.
    expect(primera.getByRole('link', { name: 'Ver la prioridad del siniestro SIN-2026-01655' }).getAttribute('href')).toBe(
      `/siniestros/cola/${ID_EVALUADO}`,
    );
    expect(screen.getByRole('link', { name: 'Buscar por id' }).getAttribute('href')).toBe('/siniestros/cola');
    const segunda = within(filas[2]);
    expect(segunda.getByText('Sin calcular')).toBeTruthy();
    expect(segunda.getByText('Sin declarar')).toBeTruthy();
  });

  it('cambia a las excepciones de pago y vuelve con el teclado', async () => {
    const usuario = await renderizar();
    listar.mockReturnValue(of({ items: [], siguienteToken: null }));

    await usuario.click(screen.getByRole('tab', { name: 'Excepciones de pago' }));

    expect(listar).toHaveBeenLastCalledWith('payment-exceptions');
    expect(screen.getByRole('status').textContent).toContain('No hay pagos en excepción.');

    screen.getByRole('tab', { name: 'Excepciones de pago' }).focus();
    await usuario.keyboard('{ArrowLeft}');
    expect(listar).toHaveBeenLastCalledWith('evaluations');
    expect(screen.getByRole('tab', { name: 'En evaluación' }).getAttribute('aria-selected')).toBe('true');
  });

  it('carga la página siguiente con el token', async () => {
    const usuario = await renderizar(of({ ...PAGINA, siguienteToken: 'tok-2' }));
    listar.mockReturnValue(of({ items: [{ ...PAGINA.items[0], id: 'otro', numeroRadicado: 'SIN-2026-01800' }], siguienteToken: null }));

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(listar).toHaveBeenLastCalledWith('evaluations', 'tok-2');
    expect(screen.getByText('SIN-2026-01800')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('muestra el error con reintento y se recupera', async () => {
    const usuario = await renderizar(throwError(() => new ErrorEvaluacion('claims_unavailable')));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar la cola');
    listar.mockReturnValue(of(PAGINA));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('SIN-2026-01655')).toBeTruthy();
  });

  it('un error al cargar más también se muestra', async () => {
    const usuario = await renderizar(of({ ...PAGINA, siguienteToken: 'tok-2' }));
    listar.mockReturnValue(throwError(() => new ErrorEvaluacion('claims_unavailable')));

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
