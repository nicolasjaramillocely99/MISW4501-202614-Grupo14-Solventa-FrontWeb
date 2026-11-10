import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  PAGINA_POR_VENCER_DTO,
  PAGINA_POR_VENCER_VACIA_DTO,
  POLIZA_POR_VENCER_DTO,
  paginaPorVencerDto,
} from '@testing/polizas-por-vencer-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  ErrorPorVencer,
  FiltroPorVencer,
  PaginaPorVencer,
  mapearPaginaPorVencer,
} from '@core/api/originacion/polizas-por-vencer.modelos';

import { PolizasPorVencerPage } from './polizas-por-vencer.page';

const PAGINA = mapearPaginaPorVencer(PAGINA_POR_VENCER_DTO);
const VACIA = mapearPaginaPorVencer(PAGINA_POR_VENCER_VACIA_DTO);
const SIN_FILTRO: FiltroPorVencer = { desde: null, hasta: null, estado: null, pagina: 1, tamano: 20 };

describe('PolizasPorVencerPage (S6 · HU-W1.5-01)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroPorVencer) => Observable<PaginaPorVencer>>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    listar = vi.fn<(filtro: FiltroPorVencer) => Observable<PaginaPorVencer>>().mockReturnValue(of(PAGINA));
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([{ path: 'originacion/renovaciones', component: PolizasPorVencerPage }]),
        { provide: OriginacionApiService, useValue: { listarPolizasPorVencer: listar } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const abrir = (consulta = '') => harness.navigateByUrl(`/originacion/renovaciones${consulta}`);
  const url = () => TestBed.inject(Router).url;
  const ultimaConsulta = () => listar.mock.lastCall?.[0];
  const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
  const fecha = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

  it('sin filtro pide la página 1 de 20 y muestra título, tarjeta, filtros con el rango aplicado y conteo (CA-1)', async () => {
    await abrir();

    expect(ultimaConsulta()).toEqual(SIN_FILTRO);
    expect(screen.getByRole('heading', { level: 1, name: 'Renovaciones' })).toBeTruthy();
    expect(screen.getByText(/Inicia la renovación asistida desde la lista/)).toBeTruthy();
    const tarjeta = screen.getByRole('region', { name: 'Pólizas que vencen en la ventana de renovación' });
    expect(tarjeta.textContent).toContain('Vencen en 30 días');
    expect(tarjeta.textContent).toContain('12');
    expect(screen.getByRole('search', { name: 'Filtrar pólizas próximas a vencer' })).toBeTruthy();
    expect((screen.getByLabelText('Vencen desde') as HTMLInputElement).value).toBe('2026-09-16');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-11-16');
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('');
    expect(screen.getByText('3 resultados')).toBeTruthy();
    expect(filas()).toHaveLength(3);
    expect(screen.queryByRole('navigation', { name: 'Paginación de las pólizas' })).toBeNull();
  });

  it('cada fila muestra póliza, cliente con documento, producto, vencimiento en Colombia, prima y estado (CA-1)', async () => {
    await abrir();

    const [primera, enCurso, masAdelante] = filas();
    expect(primera.textContent).toContain('pol-acc-118204');
    expect(primera.textContent).toContain('Carolina Pérez Ruiz');
    expect(primera.textContent).toContain('1.020.345.678');
    expect(primera.textContent).toContain('Vida');
    expect(primera.textContent).toContain('02/10/2026');
    expect(primera.textContent).toMatch(/142\.300\sCOP/);
    expect(primera.textContent).toContain('Por vencer');
    expect(enCurso.textContent).toContain('Renovación en curso');
    expect(enCurso.textContent).toContain('41.556.902');
    expect(masAdelante.textContent).toContain('15/11/2026');
    expect(masAdelante.textContent).toContain('Por vencer');
  });

  it('«Renovar» lleva a la renovación asistida de la póliza; «Ver», a la renovación en curso (CA-4)', async () => {
    await abrir();

    const renovar = screen.getByRole('link', { name: 'Renovar la póliza pol-acc-118204' });
    expect(renovar.textContent?.trim()).toBe('Renovar');
    expect(renovar.getAttribute('href')).toBe('/originacion/renovaciones/pol-acc-118204');
    const ver = screen.getByRole('link', { name: 'Ver la renovación de la póliza pol-acc-771003' });
    expect(ver.textContent?.trim()).toBe('Ver');
    expect(ver.getAttribute('href')).toBe('/originacion/renovaciones/pol-acc-771003');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('fuera de la ventana no ofrece «Renovar» y dice desde cuándo se puede renovar (D-5 a)', async () => {
    await abrir();

    const masAdelante = filas()[2];
    expect(within(masAdelante).queryByRole('link')).toBeNull();
    expect(masAdelante.textContent).toContain('Renovable desde el 16/10/2026');
  });

  it('mientras consulta lo dice', async () => {
    listar.mockReturnValue(new Subject<PaginaPorVencer>());

    await abrir();

    expect(screen.getByRole('status').textContent).toContain('Cargando las pólizas próximas a vencer…');
  });

  it('lee el filtro de la URL y lo muestra en los campos (CA-2)', async () => {
    await abrir('?desde=2026-10-01&hasta=2026-10-31&estado=renewal_in_progress&pagina=2');

    expect(ultimaConsulta()).toEqual({ desde: '2026-10-01', hasta: '2026-10-31', estado: 'renewal_in_progress', pagina: 2, tamano: 20 });
    expect((screen.getByLabelText('Vencen desde') as HTMLInputElement).value).toBe('2026-10-01');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-10-31');
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('renewal_in_progress');
  });

  it('cambiar una fecha lleva el rango a la URL y vuelve a la página 1 (CA-2)', async () => {
    await abrir('?pagina=2');

    fecha('Vencen desde', '2026-10-01');
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/renovaciones?desde=2026-10-01&hasta=2026-11-16');
    expect(ultimaConsulta()).toEqual({ ...SIN_FILTRO, desde: '2026-10-01', hasta: '2026-11-16' });

    fecha('Hasta', '2026-10-15');
    await harness.fixture.whenStable();
    expect(url()).toBe('/originacion/renovaciones?desde=2026-10-01&hasta=2026-10-15');
  });

  it('cambiar el estado lo lleva a la URL conservando el rango elegido', async () => {
    await abrir('?desde=2026-10-01&hasta=2026-10-31&pagina=3');

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'renewal_in_progress');
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/renovaciones?desde=2026-10-01&hasta=2026-10-31&estado=renewal_in_progress');
    expect(ultimaConsulta()).toEqual({ desde: '2026-10-01', hasta: '2026-10-31', estado: 'renewal_in_progress', pagina: 1, tamano: 20 });

    await userEvent.selectOptions(screen.getByLabelText('Estado'), '');
    await harness.fixture.whenStable();
    expect(url()).toBe('/originacion/renovaciones?desde=2026-10-01&hasta=2026-10-31');
  });

  it('un rango al revés se avisa en «Hasta» y no se consulta', async () => {
    await abrir();
    const consultas = listar.mock.calls.length;

    fecha('Hasta', '2026-09-01');
    await harness.fixture.whenStable();

    expect(listar.mock.calls.length).toBe(consultas);
    expect(url()).toBe('/originacion/renovaciones');
    expect(screen.getByRole('alert').textContent).toContain('«Hasta» no puede ser anterior a «Vencen desde».');
    expect(screen.getByLabelText('Hasta').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un rango al revés en la URL no consulta y lo avisa', async () => {
    await abrir('?desde=2026-10-31&hasta=2026-10-01');

    expect(listar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('no puede ser anterior');
    expect(screen.getByRole('status').textContent).toContain('Corrige el rango de fechas');
  });

  it('el «out_of_range» del backend también se muestra como rango inválido', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorPorVencer('out_of_range')));

    await abrir('?desde=2026-10-01');

    expect(screen.getByRole('alert').textContent).toContain('no puede ser anterior');
  });

  it('sin pólizas en el rango muestra el estado vacío sin errores y «Limpiar filtros» vuelve al rango por defecto (CA-3)', async () => {
    listar.mockReturnValue(of(VACIA));
    await abrir('?desde=2026-12-01&hasta=2026-12-15');

    const vacio = screen.getByRole('heading', { level: 3, name: 'Sin pólizas por vencer en el rango' });
    expect(vacio).toBeTruthy();
    expect(screen.getByText('No hay pólizas que venzan entre el 01/12/2026 y el 15/12/2026 con el estado Todos.')).toBeTruthy();
    expect(screen.getByText('0 resultados')).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.queryByRole('alert')).toBeNull();

    listar.mockReturnValue(of(PAGINA));
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/renovaciones');
    expect(ultimaConsulta()).toEqual(SIN_FILTRO);
  });

  it('el estado vacío nombra el estado filtrado', async () => {
    listar.mockReturnValue(of(VACIA));

    await abrir('?estado=renewal_in_progress');

    expect(screen.getByText(/con el estado Renovación en curso\./)).toBeTruthy();
  });

  it('un fallo del servicio muestra el error con «Reintentar», que vuelve a consultar', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorPorVencer('renewal_unavailable')));
    await abrir('?estado=expiring');

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar las pólizas próximas a vencer');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await harness.fixture.whenStable();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(ultimaConsulta()).toEqual({ ...SIN_FILTRO, estado: 'expiring' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('un error que no es del contrato también se muestra como falla del servicio', async () => {
    listar.mockReturnValueOnce(throwError(() => new Error('red')));
    await abrir();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar las pólizas próximas a vencer');
  });

  it('un 403 no pinta aviso propio: lo resuelve el interceptor', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorPorVencer('forbidden')));
    await abrir();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('con más de una página pagina conservando el filtro (D-9 a)', async () => {
    listar.mockReturnValue(of(mapearPaginaPorVencer(paginaPorVencerDto({ total: 45 }))));
    await abrir('?estado=expiring');

    const paginacion = screen.getByRole('navigation', { name: 'Paginación de las pólizas' });
    expect(paginacion.textContent).toContain('Página 1 de 3');
    expect((screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('45 resultados')).toBeTruthy();

    listar.mockReturnValue(of(mapearPaginaPorVencer(paginaPorVencerDto({ total: 45, page: 2 }))));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/renovaciones?estado=expiring&pagina=2');
    expect(ultimaConsulta()).toEqual({ ...SIN_FILTRO, estado: 'expiring', pagina: 2 });
    expect(screen.getByRole('navigation', { name: 'Paginación de las pólizas' }).textContent).toContain('Página 2 de 3');

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await harness.fixture.whenStable();
    expect(url()).toBe('/originacion/renovaciones?estado=expiring');
  });

  it('una sola póliza dice «1 resultado»; un estado desconocido sale con una insignia neutra', async () => {
    listar.mockReturnValue(
      of(mapearPaginaPorVencer(paginaPorVencerDto({ items: [{ ...POLIZA_POR_VENCER_DTO, status: 'cancelled_non_payment', can_renew: false }], total: 1 }))),
    );

    await abrir();

    expect(screen.getByText('1 resultado')).toBeTruthy();
    expect(filas()[0].textContent).toContain('Otro estado');
    expect(within(filas()[0]).queryByRole('link')).toBeNull();
    expect(filas()[0].textContent).not.toContain('Renovable desde');
  });

  it('muestra el producto si lo hay, el tipo de documento y un documento no numérico tal cual', async () => {
    listar.mockReturnValue(
      of(
        mapearPaginaPorVencer(
          paginaPorVencerDto({
            items: [
              { ...POLIZA_POR_VENCER_DTO, product: 'Vida deudor', holder: { full_name: 'Ana', document_type: 'CC', document_id: '1020345678' } },
              { ...POLIZA_POR_VENCER_DTO, policy_id: 'pol-2', line: 'marine', holder: { full_name: 'Bo', document_type: null, document_id: 'PA-778' } },
              { ...POLIZA_POR_VENCER_DTO, policy_id: 'pol-3', holder: { full_name: 'Cy', document_type: null, document_id: null } },
            ],
            total: 3,
          }),
        ),
      ),
    );

    await abrir();

    const [conProducto, otraLinea, sinDocumento] = filas();
    expect(conProducto.textContent).toContain('Vida deudor');
    expect(conProducto.textContent).toContain('CC 1.020.345.678');
    expect(otraLinea.textContent).toContain('marine');
    expect(otraLinea.textContent).toContain('PA-778');
    expect(sinDocumento.textContent).toContain('Cy');
  });

  it('en inglés traduce los textos y el producto', async () => {
    TestBed.inject(TranslocoService).setActiveLang('en-US');

    await abrir();

    expect(screen.getByRole('heading', { level: 1, name: 'Renewals' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Renew policy pol-acc-118204' })).toBeTruthy();
    expect(filas()[0].textContent).toContain('Life');
    expect(filas()[0].textContent).toContain('10/02/2026');
  });
});
