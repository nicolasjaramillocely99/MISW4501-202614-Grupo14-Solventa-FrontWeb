import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CriteriosListado, SIN_CRITERIOS } from '../../modelos/filtro-listado';
import { ESPERA_BUSQUEDA_MS, FiltrosConsentimientosComponent } from './filtros-consentimientos.component';

const ENTIDADES = [
  { codigo: 'aliado-banco-1', nombre: 'Banco Aliado' },
  { codigo: 'cooperativa-andina', nombre: 'Cooperativa Andina' },
];

describe('FiltrosConsentimientosComponent (O14 · HU-W4.2-01)', () => {
  afterEach(() => vi.useRealTimers());

  async function renderizar(criterios: CriteriosListado = SIN_CRITERIOS) {
    const cambio = vi.fn<(criterios: CriteriosListado) => void>();
    const vista = await render(FiltrosConsentimientosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { criterios, entidades: ENTIDADES },
      on: { cambio },
    });
    return { vista, cambio };
  }

  const fecha = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

  it('tiene los cinco filtros con etiqueta permanente y las opciones del estado y la entidad', async () => {
    await renderizar();

    expect(screen.getByRole('search', { name: 'Filtrar consentimientos' })).toBeTruthy();
    const estado = screen.getByLabelText('Estado') as HTMLSelectElement;
    expect([...estado.options].map((o) => o.textContent?.trim())).toEqual(['Todos', 'Activo', 'Revocado', 'Revocación parcial', 'Vencido']);
    expect(screen.getByLabelText('Otorgado desde').getAttribute('type')).toBe('date');
    expect(screen.getByLabelText('Hasta').getAttribute('type')).toBe('date');
    expect(screen.getAllByText('DD/MM/AAAA')).toHaveLength(2);
    const entidad = screen.getByLabelText('Entidad') as HTMLSelectElement;
    expect([...entidad.options].map((o) => o.textContent?.trim())).toEqual(['Todas', 'Banco Aliado', 'Cooperativa Andina']);
    expect(screen.getByLabelText('Buscar cliente').getAttribute('placeholder')).toBe('Documento o nombre');
  });

  it('muestra los criterios vigentes', async () => {
    await renderizar({ estado: 'revoked', desde: '2026-09-01', hasta: '2026-09-16', entidad: 'cooperativa-andina', cliente: 'Rojas Mejía' });

    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('revoked');
    expect((screen.getByLabelText('Otorgado desde') as HTMLInputElement).value).toBe('2026-09-01');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-09-16');
    expect((screen.getByLabelText('Entidad') as HTMLSelectElement).value).toBe('cooperativa-andina');
    expect((screen.getByLabelText('Buscar cliente') as HTMLInputElement).value).toBe('Rojas Mejía');
  });

  it('el estado y la entidad emiten los criterios completos', async () => {
    const { cambio } = await renderizar({ ...SIN_CRITERIOS, cliente: 'perez' });

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'expired');
    expect(cambio).toHaveBeenLastCalledWith({ ...SIN_CRITERIOS, estado: 'expired', cliente: 'perez' });

    await userEvent.selectOptions(screen.getByLabelText('Entidad'), 'aliado-banco-1');
    expect(cambio).toHaveBeenLastCalledWith({ ...SIN_CRITERIOS, entidad: 'aliado-banco-1', cliente: 'perez' });

    await userEvent.selectOptions(screen.getByLabelText('Estado'), '');
    expect(cambio).toHaveBeenLastCalledWith({ ...SIN_CRITERIOS, cliente: 'perez' });
  });

  it('las fechas emiten un rango válido; uno al revés se avisa en «Hasta» y no se emite', async () => {
    const { cambio } = await renderizar();

    fecha('Otorgado desde', '2026-09-16');
    expect(cambio).toHaveBeenLastCalledWith({ ...SIN_CRITERIOS, desde: '2026-09-16' });

    fecha('Hasta', '2026-09-01');
    expect(cambio).toHaveBeenCalledTimes(1);
    const hasta = screen.getByLabelText('Hasta');
    expect(hasta.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('«Hasta» no puede ser anterior a «Otorgado desde».');
    expect(hasta.getAttribute('aria-describedby')).toBe('filtro-hasta-error');

    fecha('Hasta', '2026-09-30');
    expect(cambio).toHaveBeenLastCalledWith({ ...SIN_CRITERIOS, desde: '2026-09-16', hasta: '2026-09-30' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un rango inválido que llega de la URL también se avisa', async () => {
    await renderizar({ ...SIN_CRITERIOS, desde: '2026-09-16', hasta: '2026-09-01' });

    expect(screen.getByRole('alert').textContent).toContain('no puede ser anterior');
  });

  it('la búsqueda se emite 400 ms después de la última tecla, recortada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { cambio } = await renderizar();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await usuario.type(screen.getByLabelText('Buscar cliente'), ' nunez ');
    expect(cambio).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS);

    expect(cambio).toHaveBeenCalledTimes(1);
    expect(cambio).toHaveBeenLastCalledWith({ ...SIN_CRITERIOS, cliente: 'nunez' });
  });

  it('Enter busca de inmediato y no repite la misma búsqueda', async () => {
    const { cambio } = await renderizar({ ...SIN_CRITERIOS, cliente: 'perez' });
    const campo = screen.getByLabelText('Buscar cliente');

    await userEvent.type(campo, '{Enter}');
    expect(cambio).not.toHaveBeenCalled();

    await userEvent.clear(campo);
    await userEvent.type(campo, '1020304050{Enter}');
    expect(cambio).toHaveBeenCalledWith({ ...SIN_CRITERIOS, cliente: '1020304050' });
  });

  it('vaciar la búsqueda la quita del filtro', async () => {
    const { cambio } = await renderizar({ ...SIN_CRITERIOS, cliente: 'perez' });
    const campo = screen.getByLabelText('Buscar cliente');

    await userEvent.clear(campo);
    await userEvent.type(campo, '{Enter}');

    expect(cambio).toHaveBeenLastCalledWith(SIN_CRITERIOS);
  });

  it('sigue a la URL: limpiar los filtros vacía los controles', async () => {
    const { vista } = await renderizar({ estado: 'revoked', desde: '2026-09-01', hasta: null, entidad: null, cliente: 'perez' });

    vista.fixture.componentRef.setInput('criterios', SIN_CRITERIOS);
    vista.fixture.detectChanges();

    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Otorgado desde') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Buscar cliente') as HTMLInputElement).value).toBe('');
  });

  it('al destruirse cancela una búsqueda pendiente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { vista, cambio } = await renderizar();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await usuario.type(screen.getByLabelText('Buscar cliente'), 'ana');
    vista.fixture.destroy();
    await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS * 2);

    expect(cambio).not.toHaveBeenCalled();
  });
});
