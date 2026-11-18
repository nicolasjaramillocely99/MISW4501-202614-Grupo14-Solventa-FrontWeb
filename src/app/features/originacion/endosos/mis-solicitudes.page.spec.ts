import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PAGINA_SOLICITUDES_DTO, PAGINA_SOLICITUDES_VACIA_DTO } from '@testing/solicitud-modificacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  ErrorSolicitudModificacion,
  FiltroSolicitudes,
  PaginaSolicitudes,
  mapearPaginaSolicitudes,
} from '@core/api/originacion/solicitud-modificacion.modelos';

import { MisSolicitudesPage } from './mis-solicitudes.page';
import { filtroDesdeParametros, parametrosDesdeFiltro } from './modelos/filtro-solicitudes';

const PAGINA = mapearPaginaSolicitudes(PAGINA_SOLICITUDES_DTO);
const VACIA = mapearPaginaSolicitudes(PAGINA_SOLICITUDES_VACIA_DTO);
const SIN_FILTRO: FiltroSolicitudes = { estado: null, polizaId: null, desde: null, pagina: 1, tamano: 20 };

describe('MisSolicitudesPage (A11 · HU-W1.4-01 · CA-2)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroSolicitudes) => Observable<PaginaSolicitudes>>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    listar = vi.fn<(filtro: FiltroSolicitudes) => Observable<PaginaSolicitudes>>().mockReturnValue(of(PAGINA));
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([{ path: 'originacion/solicitudes', component: MisSolicitudesPage }]),
        { provide: OriginacionApiService, useValue: { listarMisSolicitudes: listar } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const abrir = (consulta = '') => harness.navigateByUrl(`/originacion/solicitudes${consulta}`);
  const url = () => TestBed.inject(Router).url;
  const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

  it('muestra los indicadores, la tabla con el estado que ve el asegurado y «Ver detalle»', async () => {
    await abrir();

    expect(listar).toHaveBeenLastCalledWith(SIN_FILTRO);
    expect(screen.getByRole('heading', { level: 1, name: 'Mis solicitudes' })).toBeTruthy();
    const indicadores = screen.getByRole('region', { name: 'Resumen de tus solicitudes' });
    expect(indicadores.textContent).toContain('En revisión');
    expect(indicadores.textContent).toContain('SOL-MOD-2026-0042 · cambio de beneficiarios');
    expect(indicadores.textContent).toContain('Aplicadas este año');
    expect(indicadores.textContent).toContain('actualización de datos');
    expect(indicadores.textContent).toContain('SOL-MOD-2026-0050');
    expect(screen.getByText('6 solicitudes')).toBeTruthy();

    const [devuelta, trabajando, radicada, enRevision, aplicada, rechazada] = filas();
    expect(devuelta.textContent).toContain('Rechazada');
    expect(devuelta.textContent).toContain('El documento de un beneficiario no es válido');
    expect(trabajando.textContent).toContain('En revisión');
    expect(radicada.textContent).toContain('Radicada');
    expect(radicada.textContent).toContain('Vida hipotecario · Beneficiarios');
    expect(enRevision.textContent).toContain('En revisión');
    expect(aplicada.textContent).toContain('Aplicada');
    expect(rechazada.textContent).toContain('Falta el avalúo del inmueble');
    expect(screen.getByRole('link', { name: 'Ver detalle de SOL-MOD-2026-0042' }).getAttribute('href')).toBe('/originacion/solicitudes/SOL-MOD-2026-0042');
    expect(screen.getByRole('link', { name: /Nueva solicitud/ }).getAttribute('href')).toBe('/originacion/polizas');
  });

  it('los filtros viven en la URL y se piden al servicio', async () => {
    await abrir();

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'rejected');
    expect(url()).toBe('/originacion/solicitudes?estado=rejected');
    await userEvent.selectOptions(screen.getByLabelText('Póliza'), 'pol-acc-4f2a');
    expect(url()).toBe('/originacion/solicitudes?estado=rejected&poliza=pol-acc-4f2a');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/solicitudes?estado=rejected&poliza=pol-acc-4f2a&desde=2026-01-01');
    expect(listar).toHaveBeenLastCalledWith({ estado: 'rejected', polizaId: 'pol-acc-4f2a', desde: '2026-01-01', pagina: 1, tamano: 20 });
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('rejected');
  });

  it('pagina conservando el filtro', async () => {
    listar.mockReturnValue(of({ ...PAGINA, total: 45, totalPaginas: 3, pagina: 2 }));
    await abrir('?estado=in_review&pagina=2');

    expect(screen.getByText('Página 2 de 3')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));

    expect(url()).toBe('/originacion/solicitudes?estado=in_review&pagina=3');
    await userEvent.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(url()).toBe('/originacion/solicitudes?estado=in_review');
  });

  it('sin solicitudes muestra el estado vacío con «Ver mis pólizas»', async () => {
    listar.mockReturnValue(of(VACIA));
    await abrir();

    expect(screen.getByText('Aún no tienes solicitudes de modificación')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver mis pólizas' }).getAttribute('href')).toBe('/originacion/polizas');
    expect(filas()).toHaveLength(0);
  });

  it('sin resultados para el filtro ofrece limpiarlo', async () => {
    listar.mockReturnValue(of(VACIA));
    await abrir('?estado=applied');

    expect(screen.getByText('Ninguna solicitud cumple el filtro')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(url()).toBe('/originacion/solicitudes');
  });

  it('una falla del servicio permite reintentar; 403 lo resuelve el interceptor', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorSolicitudModificacion('change_request_unavailable')));
    await abrir();
    expect(screen.getByText('No pudimos cargar tus solicitudes')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(filas()).toHaveLength(6);

    listar.mockReturnValueOnce(throwError(() => new ErrorSolicitudModificacion('forbidden')));
    await abrir('?estado=filed');
    expect(screen.queryByText('No pudimos cargar tus solicitudes')).toBeNull();
  });
});

describe('filtro-solicitudes', () => {
  it('descarta lo inválido de la URL y solo escribe lo que tiene valor', () => {
    expect(filtroDesdeParametros({ estado: 'not_applied', poliza: 'pol x', desde: '2026-02-30', pagina: '0' })).toEqual(SIN_FILTRO);
    expect(filtroDesdeParametros({ estado: ['applied'], poliza: 'pol-acc-4f2a', desde: '2026-01-01', pagina: '3' })).toEqual({
      estado: 'applied',
      polizaId: 'pol-acc-4f2a',
      desde: '2026-01-01',
      pagina: 3,
      tamano: 20,
    });
    expect(parametrosDesdeFiltro({ estado: null, polizaId: null, desde: null, pagina: 1 })).toEqual({});
  });
});
