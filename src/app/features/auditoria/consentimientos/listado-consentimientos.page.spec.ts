import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PAGINA_DTO, PAGINA_VACIA_DTO } from '@testing/listado-consentimientos-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  ErrorListado,
  FiltroConsentimientos,
  PaginaConsentimientos,
  mapearPaginaConsentimientos,
} from '@core/api/auditoria/listado-consentimientos.modelos';

import { ListadoConsentimientosPage } from './listado-consentimientos.page';
import { UltimoListadoService } from './servicios/ultimo-listado.service';

const PAGINA = mapearPaginaConsentimientos(PAGINA_DTO);
const VACIA = mapearPaginaConsentimientos(PAGINA_VACIA_DTO);

describe('ListadoConsentimientosPage (O14 / O14b · HU-W4.2-01)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroConsentimientos) => Observable<PaginaConsentimientos>>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    listar = vi.fn<(filtro: FiltroConsentimientos) => Observable<PaginaConsentimientos>>().mockReturnValue(of(PAGINA));
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([{ path: 'auditoria/consentimientos', component: ListadoConsentimientosPage }]),
        { provide: AuditoriaApiService, useValue: { listarConsentimientos: listar } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const abrir = (consulta = '') => harness.navigateByUrl(`/auditoria/consentimientos${consulta}`);
  const url = () => TestBed.inject(Router).url;
  const ultimaConsulta = () => listar.mock.lastCall?.[0];
  const SIN_FILTRO: FiltroConsentimientos = { estado: null, desde: null, hasta: null, entidad: null, cliente: null, pagina: 1, tamano: 6 };

  it('sin filtro pide la página 1 de 6 y muestra título, indicadores, filtros y tabla (CA-1)', async () => {
    await abrir();

    expect(ultimaConsulta()).toEqual(SIN_FILTRO);
    expect(screen.getByRole('heading', { level: 1, name: 'Consentimientos Open Finance' })).toBeTruthy();
    expect(screen.getByText(/Universo de consentimientos otorgados por los clientes/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Indicadores de los consentimientos' })).toBeTruthy();
    expect(screen.getByRole('search', { name: 'Filtrar consentimientos' })).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(7);
    const entidad = screen.getByLabelText('Entidad') as HTMLSelectElement;
    expect([...entidad.options].map((o) => o.textContent?.trim())).toEqual(['Todas', 'Banco Aliado', 'Cooperativa Andina']);
  });

  it('mientras consulta lo dice', async () => {
    listar.mockReturnValue(new Subject<PaginaConsentimientos>());

    await abrir();

    expect(screen.getByRole('status').textContent).toContain('Cargando consentimientos…');
  });

  it('lee el filtro de la URL y lo guarda para «Volver» del detalle (CA-2)', async () => {
    await abrir('?estado=revoked&desde=2026-09-01&hasta=2026-09-16&entidad=cooperativa-andina&cliente=Rojas&pagina=2');

    expect(ultimaConsulta()).toEqual({
      estado: 'revoked',
      desde: '2026-09-01',
      hasta: '2026-09-16',
      entidad: 'cooperativa-andina',
      cliente: 'Rojas',
      pagina: 2,
      tamano: 6,
    });
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('revoked');
    expect(TestBed.inject(UltimoListadoService).parametros()).toEqual({
      estado: 'revoked',
      desde: '2026-09-01',
      hasta: '2026-09-16',
      entidad: 'cooperativa-andina',
      cliente: 'Rojas',
      pagina: '2',
    });
  });

  it('cambiar un filtro lo lleva a la URL y vuelve a la página 1 (CA-2)', async () => {
    await abrir('?pagina=3&cliente=ana');

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'expired');
    await harness.fixture.whenStable();

    expect(url()).toBe('/auditoria/consentimientos?estado=expired&cliente=ana');
    expect(ultimaConsulta()).toEqual({ ...SIN_FILTRO, estado: 'expired', cliente: 'ana' });
  });

  it('paginar conserva el filtro (CA-2)', async () => {
    await abrir('?estado=active');
    listar.mockReturnValue(of({ ...PAGINA, pagina: 2 }));

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await harness.fixture.whenStable();

    expect(url()).toBe('/auditoria/consentimientos?estado=active&pagina=2');
    expect(ultimaConsulta()).toEqual({ ...SIN_FILTRO, estado: 'active', pagina: 2 });
    expect(screen.getByText(/7 a 12 de 1\.433 registros · página 2 de 239/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await harness.fixture.whenStable();
    expect(url()).toBe('/auditoria/consentimientos?estado=active');
  });

  it('sin resultados muestra el estado vacío y «Limpiar filtros» quita el filtro (CA-3)', async () => {
    listar.mockReturnValue(of(VACIA));
    await abrir('?estado=revoked&entidad=cooperativa-andina&desde=2026-09-01&hasta=2026-09-16&cliente=Rojas%20Mej%C3%ADa');

    expect(
      screen.getByText(
        'No hay consentimientos de Cooperativa Andina en estado Revocado, otorgados entre el 01/09/2026 y el 16/09/2026, para el cliente buscado.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Indicadores de los consentimientos' }).textContent).toContain('1.284');
    expect(screen.queryByRole('alert')).toBeNull();

    listar.mockReturnValue(of(PAGINA));
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await harness.fixture.whenStable();

    expect(url()).toBe('/auditoria/consentimientos');
    expect(ultimaConsulta()).toEqual(SIN_FILTRO);
  });

  it('un fallo del servicio muestra el error con «Reintentar», que vuelve a consultar', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorListado('service_unavailable')));
    await abrir('?estado=active');

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar los consentimientos');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(listar).toHaveBeenCalledTimes(2);
    expect(ultimaConsulta()).toEqual({ ...SIN_FILTRO, estado: 'active' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('un error que no es del contrato también se muestra como falla del servicio', async () => {
    listar.mockReturnValueOnce(throwError(() => new Error('red')));
    await abrir();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar los consentimientos');
  });

  it('un 403 no pinta aviso propio: lo resuelve el interceptor', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorListado('forbidden')));
    await abrir();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un rango de fechas al revés en la URL no consulta y lo avisa', async () => {
    await abrir('?desde=2026-09-16&hasta=2026-09-01');

    expect(listar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('no puede ser anterior');
    expect(screen.getByRole('status').textContent).toContain('Corrige el rango de fechas');
  });
});
