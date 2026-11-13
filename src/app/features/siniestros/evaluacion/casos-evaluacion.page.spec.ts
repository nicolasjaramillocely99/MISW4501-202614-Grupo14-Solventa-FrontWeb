import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  ID_EVALUADO,
  PAGINA_COLA_DTO,
  PAGINA_COLA_PRIORIDAD_DTO,
} from '@testing/evaluacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { POLITICA_TRIAGE_DTO } from '@testing/triage-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import {
  ErrorEvaluacion,
  PaginaColaPrioridad,
  mapearPaginaCola,
  mapearPaginaColaPrioridad,
} from '@core/api/siniestros/evaluacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { mapearPoliticaTriage } from '@core/api/siniestros/triage.modelos';

import { CasosEvaluacionPage, INTERVALO_RELOJ_MS } from './casos-evaluacion.page';

const COLA = mapearPaginaColaPrioridad(PAGINA_COLA_PRIORIDAD_DTO);
const EXCEPCIONES = mapearPaginaCola(PAGINA_COLA_DTO);

describe('CasosEvaluacionPage (O5 · HU-W2.2-02 y HU-W2.2-03)', () => {
  let api: {
    listarColaPrioridad: ReturnType<typeof vi.fn>;
    listarCola: ReturnType<typeof vi.fn>;
    consultarPoliticaTriage: ReturnType<typeof vi.fn>;
  };

  async function renderizar(
    cola: Observable<PaginaColaPrioridad> = of(COLA),
    politica = of(mapearPoliticaTriage(POLITICA_TRIAGE_DTO)),
  ) {
    api = {
      listarColaPrioridad: vi.fn().mockReturnValue(cola),
      listarCola: vi.fn().mockReturnValue(of(EXCEPCIONES)),
      consultarPoliticaTriage: vi.fn().mockReturnValue(politica),
    };
    await render(CasosEvaluacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), { provide: SiniestrosApiService, useValue: api }],
    });
    return userEvent.setup();
  }

  afterEach(() => vi.useRealTimers());

  it('lista la cola por prioridad con asegurado, monto y «Evaluar» (CA-1)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Cola de siniestros' })).toBeTruthy();
    expect(api.listarColaPrioridad).toHaveBeenCalledWith({}, undefined);
    const filas = screen.getAllByRole('row');
    const primera = within(filas[1]);
    expect(primera.getByText('Triage 2')).toBeTruthy();
    expect(primera.getByText('SIN-2026-01655')).toBeTruthy();
    expect(primera.getByText('Carolina Pérez Ruiz')).toBeTruthy();
    expect(primera.getByText('CC 1020345678')).toBeTruthy();
    expect(primera.getByText('Hogar · Daño por agua')).toBeTruthy();
    expect(primera.getByText(/4\.800\.000/)).toBeTruthy();
    expect(
      primera.getByRole('link', { name: 'Abrir el siniestro SIN-2026-01655' }).getAttribute('href'),
    ).toBe(`/siniestros/${ID_EVALUADO}/evaluar`);
    expect(
      primera
        .getByRole('link', { name: 'Ver la prioridad del siniestro SIN-2026-01655' })
        .getAttribute('href'),
    ).toBe(`/siniestros/cola/${ID_EVALUADO}`);
    expect(screen.getByRole('link', { name: 'Buscar por id' }).getAttribute('href')).toBe(
      '/siniestros/cola',
    );
    const segunda = within(filas[2]);
    expect(segunda.getByText('Sin calcular')).toBeTruthy();
    expect(segunda.getByText('No disponible'), 'sin el asegurado, la fila sigue').toBeTruthy();
  });

  it('muestra los indicadores de toda la cola con su objetivo y el tiempo medio (O5)', async () => {
    await renderizar();

    expect(document.querySelector('[data-nivel="1"]')?.textContent?.trim()).toBe('3');
    expect(document.querySelector('[data-nivel="2"]')?.textContent?.trim()).toBe('7');
    expect(document.querySelector('[data-nivel="3"]')?.textContent?.trim()).toBe('12');
    expect(screen.getByText('Tiempo medio de resolución')).toBeTruthy();
    expect(screen.getByText('4.2 días')).toBeTruthy();
    expect(screen.getByText('Últimos 30 días')).toBeTruthy();
    expect(screen.getByText(/2 casos en cola · actualizado hace 0 s/)).toBeTruthy();
  });

  it('con la cola vacía muestra ceros y «Sin casos decididos», sin datos ficticios (CA-4)', async () => {
    await renderizar(
      of({
        items: [],
        siguienteToken: null,
        resumen: {
          total: 0,
          coinciden: 0,
          porNivel: { 1: 0, 2: 0, 3: 0 },
          sinNivel: 0,
          tiempoMedioDias: null,
          decididosEnVentana: 0,
          diasVentana: 30,
        },
      }),
    );

    expect(screen.getByText('No hay siniestros en evaluación.')).toBeTruthy();
    expect(document.querySelector('[data-nivel="1"]')?.textContent?.trim()).toBe('0');
    expect(screen.getByText('Sin casos decididos')).toBeTruthy();
  });

  it('filtra por prioridad, estado y producto, y quitar un filtro vuelve a toda la cola', async () => {
    const usuario = await renderizar();

    await usuario.selectOptions(screen.getByLabelText('Prioridad'), '1');
    expect(api.listarColaPrioridad).toHaveBeenLastCalledWith({ nivel: '1' }, undefined);
    await usuario.selectOptions(screen.getByLabelText('Producto'), 'home');
    expect(api.listarColaPrioridad).toHaveBeenLastCalledWith(
      { nivel: '1', ramo: 'home' },
      undefined,
    );
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'in_evaluation');
    expect(api.listarColaPrioridad).toHaveBeenLastCalledWith(
      { nivel: '1', ramo: 'home', estado: 'in_evaluation' },
      undefined,
    );
    await usuario.selectOptions(screen.getByLabelText('Prioridad'), '');
    expect(api.listarColaPrioridad).toHaveBeenLastCalledWith(
      { ramo: 'home', estado: 'in_evaluation' },
      undefined,
    );
  });

  it('«actualizado hace …» avanza con el reloj y «Actualizar» trae el orden vigente (CA-3)', async () => {
    // Solo el reloj de la página es falso: con `shouldAdvanceTime` el tiempo real se colaba entre el arranque del
    // intervalo y la lectura de la cola, y en un runner lento el segundo tic marcaba 9 s en vez de 10.
    // `setTimeout` sigue real para que Angular (sin zona) pinte los cambios.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const usuario = await renderizar();

    vi.advanceTimersByTime(INTERVALO_RELOJ_MS * 2);
    expect(await screen.findByText(/actualizado hace 10 s/)).toBeTruthy();

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(api.listarColaPrioridad).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/actualizado hace 0 s/)).toBeTruthy();
  });

  it('cambia a las excepciones de pago, que no llevan indicadores, y vuelve con el teclado', async () => {
    const usuario = await renderizar();
    api.listarCola.mockReturnValue(of({ items: [], siguienteToken: null }));

    await usuario.click(screen.getByRole('tab', { name: 'Excepciones de pago' }));

    expect(api.listarCola).toHaveBeenLastCalledWith('payment-exceptions', undefined);
    expect(screen.getByRole('status').textContent).toContain('No hay pagos en excepción.');
    expect(screen.queryByLabelText('Prioridad')).toBeNull();
    expect(screen.queryByText('Asegurado')).toBeNull();

    screen.getByRole('tab', { name: 'Excepciones de pago' }).focus();
    await usuario.keyboard('{ArrowLeft}');
    expect(api.listarColaPrioridad).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('tab', { name: 'En evaluación' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('carga la página siguiente con el token y los filtros', async () => {
    const usuario = await renderizar(of({ ...COLA, siguienteToken: 'tok-2' }));
    api.listarColaPrioridad.mockReturnValue(
      of({
        ...COLA,
        items: [{ ...COLA.items[0], id: 'otro', numeroRadicado: 'SIN-2026-01800' }],
        siguienteToken: null,
      }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(api.listarColaPrioridad).toHaveBeenLastCalledWith({}, 'tok-2');
    expect(screen.getByText('SIN-2026-01800')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('muestra el error con reintento y se recupera', async () => {
    const usuario = await renderizar(throwError(() => new ErrorEvaluacion('claims_unavailable')));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar la cola');
    api.listarColaPrioridad.mockReturnValue(of(COLA));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('SIN-2026-01655')).toBeTruthy();
  });

  it('un error al cargar más también se muestra', async () => {
    const usuario = await renderizar(of({ ...COLA, siguienteToken: 'tok-2' }));
    api.listarColaPrioridad.mockReturnValue(
      throwError(() => new ErrorEvaluacion('claims_unavailable')),
    );

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('si la política no carga, los indicadores lo dicen y la cola sigue', async () => {
    const usuario = await renderizar(
      of(COLA),
      throwError(() => new Error('x')),
    );

    expect(screen.getByText('No pudimos consultar el objetivo de cada nivel.')).toBeTruthy();
    expect(screen.getByText('SIN-2026-01655')).toBeTruthy();
    api.consultarPoliticaTriage.mockReturnValue(NEVER);
    await usuario.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    expect(api.consultarPoliticaTriage).toHaveBeenCalledTimes(2);
  });
});
