import { provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PAGINA_SINIESTROS_DTO } from '@testing/siniestros-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import {
  ErrorSiniestro,
  FiltroSiniestros,
  PaginaSiniestros,
  PaginaSiniestrosDto,
  mapearPaginaSiniestros,
} from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { MisSiniestrosPage } from './mis-siniestros.page';
import { INTERVALO_REFRESCO_MS } from './modelos/refresco';

// HU-W2.1-02: A7 con la etapa, el último cambio, los indicadores y el refresco.

const CAMBIO = '2026-09-15T14:12:00Z';
const CON_RESUMEN: PaginaSiniestrosDto = {
  ...PAGINA_SINIESTROS_DTO,
  items: [
    { ...PAGINA_SINIESTROS_DTO.items[0], status: 'returned', last_changed_at: CAMBIO },
    ...PAGINA_SINIESTROS_DTO.items.slice(1),
  ],
  summary: {
    in_progress: 2,
    by_status: { returned: 1, in_evaluation: 1, paid: 1 },
    paid_this_year: { claims: 1, amount_minor: 18_000_000, currency: 'COP' },
    pending_action: [
      { claim_id: PAGINA_SINIESTROS_DTO.items[0].claim_id, filing_number: 'SIN-2026-01712' },
    ],
    policies: [
      { policy_id: 'AU-2025-118204', line: 'auto', product: 'Autos', insured_object: 'KJT-482' },
      { policy_id: 'AU-2024-000777', line: null, product: null, insured_object: null },
    ],
  },
};

describe('MisSiniestrosPage · estado de los siniestros (A7 · HU-W2.1-02)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroSiniestros) => Observable<PaginaSiniestros>>>;

  async function renderizar(
    pagina: Observable<PaginaSiniestros> = of(mapearPaginaSiniestros(CON_RESUMEN)),
  ) {
    listar = vi.fn().mockReturnValue(pagina);
    const resultado = await render(MisSiniestrosPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        {
          provide: SiniestrosApiService,
          useValue: {
            listarSiniestros: listar,
            consultarOpcionesRadicacion: vi.fn().mockReturnValue(NEVER),
          },
        },
      ],
    });
    return { ...resultado, usuario: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
  }

  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    }),
  );
  afterEach(() => vi.useRealTimers());

  it('muestra los indicadores de todos los casos: en curso, pagados en el año y lo pendiente', async () => {
    await renderizar();

    const indicadores = within(screen.getByRole('list', { name: 'Resumen de tus siniestros' }));
    const tarjeta = (titulo: string) => indicadores.getByText(titulo).closest('li') as HTMLElement;
    expect(tarjeta('En curso').textContent).toContain('2');
    expect(tarjeta('En curso').textContent).toContain(
      '1 · Devuelto al cliente · 1 · En evaluación',
    );
    expect(tarjeta('Pagados este año').textContent).toMatch(/180\.000 COP/);
    const pendiente = tarjeta('Acción pendiente de tu parte');
    expect(
      within(pendiente)
        .getByRole('link', { name: 'SIN-2026-01712 · corregir soportes' })
        .getAttribute('href'),
    ).toBe(`/siniestros/${CON_RESUMEN.items[0].claim_id}/corregir`);
  });

  it('sin nada pendiente ni pagado lo dice', async () => {
    const sinPendientes: PaginaSiniestrosDto = {
      ...CON_RESUMEN,
      summary: {
        in_progress: 0,
        by_status: {},
        paid_this_year: { claims: 0, amount_minor: 0, currency: null },
        pending_action: [],
      },
    };
    await renderizar(of(mapearPaginaSiniestros(sinPendientes)));

    expect(screen.getByText('Nada pendiente')).toBeTruthy();
  });

  it('sin resumen del backend no muestra indicadores', async () => {
    await renderizar(of(mapearPaginaSiniestros(PAGINA_SINIESTROS_DTO)));

    expect(screen.queryByRole('list', { name: 'Resumen de tus siniestros' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
  });

  it('la tabla dice el último cambio y un caso devuelto ofrece «Corregir» (CA-1)', async () => {
    await renderizar();

    const fila = screen
      .getByRole('rowheader', { name: 'SIN-2026-01712' })
      .closest('tr') as HTMLElement;
    expect(within(fila).getByText('Devuelto al cliente')).toBeTruthy();
    expect(
      within(fila)
        .getByRole('link', { name: 'Corregir el siniestro SIN-2026-01712' })
        .getAttribute('href'),
    ).toBe(`/siniestros/${CON_RESUMEN.items[0].claim_id}/corregir`);
    expect(screen.getByRole('columnheader', { name: 'Último cambio' })).toBeTruthy();
  });

  it('filtra por etapa empezando sin token', async () => {
    const { usuario } = await renderizar();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'returned');

    expect(listar).toHaveBeenLastCalledWith({
      polizaId: '',
      desde: '',
      estado: 'returned',
      tamanoPagina: 20,
    });
  });

  it('cada minuto vuelve a leer lo que se ve sin «Cargando» (CA-2)', async () => {
    const { detectChanges } = await renderizar();
    const pagado = mapearPaginaSiniestros({
      ...CON_RESUMEN,
      items: [{ ...CON_RESUMEN.items[0], status: 'paid' }, ...CON_RESUMEN.items.slice(1)],
    });
    listar.mockReturnValue(of(pagado));

    await vi.advanceTimersByTimeAsync(INTERVALO_REFRESCO_MS);
    detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    const fila = screen
      .getByRole('rowheader', { name: 'SIN-2026-01712' })
      .closest('tr') as HTMLElement;
    expect(within(fila).getByText('Pagado')).toBeTruthy();
    expect(screen.queryByText('Consultando tus siniestros…')).toBeNull();
  });

  it('una relectura que falla deja la lista que se ve; «Actualizar» lee al momento', async () => {
    const { usuario, detectChanges } = await renderizar();
    listar.mockReturnValue(throwError(() => new ErrorSiniestro('claims_unavailable')));

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));
    detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
  });

  describe('los tres filtros y «Radicar un siniestro»', () => {
    const ultimoFiltro = () => listar.mock.calls[listar.mock.calls.length - 1][0];

    it('«Póliza» ofrece las de los siniestros, también la vencida o la del móvil', async () => {
      await renderizar();

      const opciones = Array.from(
        (screen.getByRole('combobox', { name: 'Póliza' }) as HTMLSelectElement).options,
      ).map((o) => o.value);
      expect(opciones).toEqual(['', 'AU-2025-118204', 'AU-2024-000777']);
    });

    it('sin resumen, «Póliza» ofrece las vigentes de la radicación', async () => {
      listar = vi.fn();
      await render(MisSiniestrosPage, {
        imports: [proveerTranslocoPruebas()],
        providers: [
          provideRouter([]),
          {
            provide: SiniestrosApiService,
            useValue: {
              listarSiniestros: listar.mockReturnValue(
                of(mapearPaginaSiniestros(PAGINA_SINIESTROS_DTO)),
              ),
              consultarOpcionesRadicacion: vi.fn().mockReturnValue(
                of({
                  polizas: [
                    {
                      id: 'AU-2025-555555',
                      ramo: 'auto',
                      producto: 'Autos',
                      objetoAsegurado: 'ABC-123',
                    },
                  ],
                }),
              ),
            },
          },
        ],
      });

      const opciones = Array.from(
        (screen.getByRole('combobox', { name: 'Póliza' }) as HTMLSelectElement).options,
      ).map((o) => o.value);
      expect(opciones).toEqual(['', 'AU-2025-555555']);
    });

    it('cada filtro consulta desde la primera página y se combinan entre sí', async () => {
      const { usuario } = await renderizar();

      await usuario.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'in_evaluation');
      expect(ultimoFiltro()).toEqual({
        polizaId: '',
        desde: '',
        estado: 'in_evaluation',
        tamanoPagina: 20,
      });

      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Póliza' }),
        'AU-2024-000777',
      );
      expect(ultimoFiltro()).toEqual({
        polizaId: 'AU-2024-000777',
        desde: '',
        estado: 'in_evaluation',
        tamanoPagina: 20,
      });

      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } });
      expect(ultimoFiltro()).toEqual({
        polizaId: 'AU-2024-000777',
        desde: '2026-09-01',
        estado: 'in_evaluation',
        tamanoPagina: 20,
      });
    });

    it('la póliza elegida sigue en la lista aunque el resumen ya no la traiga', async () => {
      const { usuario, detectChanges } = await renderizar();
      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Póliza' }),
        'AU-2024-000777',
      );

      listar.mockReturnValue(
        of(
          mapearPaginaSiniestros({
            ...CON_RESUMEN,
            summary: { ...CON_RESUMEN.summary!, policies: [CON_RESUMEN.summary!.policies![0]] },
          }),
        ),
      );
      await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));
      detectChanges();

      const poliza = screen.getByRole('combobox', { name: 'Póliza' }) as HTMLSelectElement;
      expect(Array.from(poliza.options).map((o) => o.value)).toContain('AU-2024-000777');
      expect(poliza.value).toBe('AU-2024-000777');
    });

    it('«Desde» no acepta un día futuro: lo dice y no consulta', async () => {
      const { detectChanges } = await renderizar();
      const desde = screen.getByLabelText('Desde') as HTMLInputElement;
      expect(desde.max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const llamadas = listar.mock.calls.length;

      fireEvent.change(desde, { target: { value: '2999-01-01' } });
      detectChanges();

      expect(screen.getByText('La fecha no puede ser futura.')).toBeTruthy();
      expect(desde.getAttribute('aria-invalid')).toBe('true');
      expect(listar.mock.calls.length).toBe(llamadas);

      fireEvent.change(desde, { target: { value: '2026-01-01' } });
      detectChanges();
      expect(screen.queryByText('La fecha no puede ser futura.')).toBeNull();
      expect(ultimoFiltro().desde).toBe('2026-01-01');
    });

    it('sin resultados, «Limpiar filtros» quita los tres y vuelve a consultar todo', async () => {
      const { usuario, detectChanges } = await renderizar();
      listar.mockReturnValue(
        of(mapearPaginaSiniestros({ ...CON_RESUMEN, items: [], next_page_token: null })),
      );
      await usuario.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'rejected');
      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Póliza' }),
        'AU-2025-118204',
      );
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } });
      // Luego un día futuro, que no llega al filtro pero sí se ve en el campo.
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2999-01-01' } });
      detectChanges();

      listar.mockReturnValue(of(mapearPaginaSiniestros(CON_RESUMEN)));
      await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
      detectChanges();

      expect(ultimoFiltro()).toEqual({ polizaId: '', desde: '', tamanoPagina: 20 });
      expect((screen.getByRole('combobox', { name: 'Etapa' }) as HTMLSelectElement).value).toBe('');
      expect((screen.getByRole('combobox', { name: 'Póliza' }) as HTMLSelectElement).value).toBe(
        '',
      );
      expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
      expect(screen.queryByText('La fecha no puede ser futura.')).toBeNull();
      expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
    });

    it('«Limpiar filtros» borra también un día futuro que no llegó al filtro', async () => {
      const { usuario, detectChanges } = await renderizar();
      listar.mockReturnValue(
        of(mapearPaginaSiniestros({ ...CON_RESUMEN, items: [], next_page_token: null })),
      );
      await usuario.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'rejected');
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2999-01-01' } });
      detectChanges();

      await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
      detectChanges();

      expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
      expect(screen.queryByText('La fecha no puede ser futura.')).toBeNull();
    });

    it('«Radicar un siniestro» lleva a la radicación', async () => {
      await renderizar();

      expect(screen.getByRole('link', { name: 'Radicar un siniestro' }).getAttribute('href')).toBe(
        '/siniestros/radicar',
      );
    });
  });
});
