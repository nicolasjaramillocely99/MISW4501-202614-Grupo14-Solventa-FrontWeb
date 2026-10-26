import { provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { OPCIONES_RADICACION_DTO, PAGINA_SINIESTROS_DTO, SINIESTRO_MOVIL_DTO } from '@testing/siniestros-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { ErrorRadicacion, OpcionesRadicacion, mapearOpcionesRadicacion } from '@core/api/siniestros/radicacion.modelos';
import {
  ErrorSiniestro,
  FiltroSiniestros,
  PaginaSiniestros,
  mapearPaginaSiniestros,
} from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { MisSiniestrosPage } from './mis-siniestros.page';

const PAGINA = mapearPaginaSiniestros(PAGINA_SINIESTROS_DTO);
const VACIA: PaginaSiniestros = { items: [], siguienteToken: null };

describe('MisSiniestrosPage (A7 mínima · HU-W2.1-01)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroSiniestros) => Observable<PaginaSiniestros>>>;

  async function renderizar({
    pagina = of(PAGINA) as Observable<PaginaSiniestros>,
    opciones = of(mapearOpcionesRadicacion(OPCIONES_RADICACION_DTO)) as Observable<OpcionesRadicacion>,
  } = {}) {
    listar = vi.fn().mockReturnValue(pagina);
    await render(MisSiniestrosPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        {
          provide: SiniestrosApiService,
          useValue: { listarSiniestros: listar, consultarOpcionesRadicacion: vi.fn().mockReturnValue(opciones) },
        },
      ],
    });
    return userEvent.setup();
  }

  it('lista los casos de los dos canales con «Radicar un siniestro» (CA-6)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Mis siniestros' })).toBeTruthy();
    expect(listar).toHaveBeenCalledWith({ polizaId: '', desde: '', tamanoPagina: 20 });
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01655' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('2 siniestros');
    expect(screen.getByRole('link', { name: 'Radicar un siniestro' }).getAttribute('href')).toBe('/siniestros/radicar');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('filtra por póliza y fecha empezando sin token', async () => {
    const usuario = await renderizar();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Póliza' }), 'AU-2025-118204');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } });

    expect(listar).toHaveBeenLastCalledWith({ polizaId: 'AU-2025-118204', desde: '2026-09-01', tamanoPagina: 20 });
  });

  it('carga la página siguiente con el token y conserva el filtro', async () => {
    const usuario = await renderizar({ pagina: of({ ...PAGINA, siguienteToken: 'tok-2' }) });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Póliza' }), 'AU-2025-118204');
    listar.mockReturnValue(of({ items: [mapearPaginaSiniestros({ items: [{ ...SINIESTRO_MOVIL_DTO, claim_id: 'c3', filing_number: 'SIN-2026-01410' }], next_page_token: null }).items[0]], siguienteToken: null }));

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(listar).toHaveBeenLastCalledWith({ polizaId: 'AU-2025-118204', desde: '', tamanoPagina: 20, tokenPagina: 'tok-2' });
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01410' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('sin casos muestra el estado vacío', async () => {
    await renderizar({ pagina: of(VACIA) });

    expect(screen.getByRole('heading', { name: 'Aún no has radicado siniestros' })).toBeTruthy();
  });

  it('sin resultados para el filtro ofrece limpiar los filtros', async () => {
    const usuario = await renderizar();
    listar.mockReturnValue(of(VACIA));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });

    expect(screen.getByRole('heading', { name: 'No hay siniestros con estos filtros' })).toBeTruthy();
    listar.mockReturnValue(of(PAGINA));
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(listar).toHaveBeenLastCalledWith({ polizaId: '', desde: '', tamanoPagina: 20 });
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
  });

  it('si el listado falla ofrece reintentar, y un fallo al cargar más conserva lo ya visto', async () => {
    const usuario = await renderizar({ pagina: throwError(() => new ErrorSiniestro('claims_unavailable')) });
    expect(screen.getByRole('heading', { name: 'No pudimos consultar tus siniestros' })).toBeTruthy();

    listar.mockReturnValue(of({ ...PAGINA, siguienteToken: 'tok-2' }));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    listar.mockReturnValue(throwError(() => new ErrorSiniestro('claims_unavailable')));
    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(screen.getByRole('alert').textContent).toContain('El servicio no respondió');
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
  });

  it('si no hay pólizas para el filtro lo oculta y la tabla sigue', async () => {
    await renderizar({ opciones: throwError(() => new ErrorRadicacion('policy_directory_unavailable')) });

    expect(screen.queryByRole('combobox', { name: 'Póliza' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'SIN-2026-01712' })).toBeTruthy();
  });
});
