import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PAGINA_ENDOSOS_DTO, PAGINA_ENDOSOS_VACIA_DTO } from '@testing/endosos-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { ErrorEndoso, FiltroEndosos, PaginaEndosos, SolicitudEndoso, mapearPaginaEndosos } from '@core/api/originacion/endosos.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { BandejaEndososPage } from './bandeja-endosos.page';

@Component({ selector: 'app-detalle-falso', template: '' })
class DetalleFalso {}

const PAGINA = mapearPaginaEndosos(PAGINA_ENDOSOS_DTO);
const VACIA = mapearPaginaEndosos(PAGINA_ENDOSOS_VACIA_DTO);

describe('BandejaEndososPage (O2 · HU-W1.4-02)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroEndosos) => Observable<PaginaEndosos>>>;
  let tomar: ReturnType<typeof vi.fn<(id: string) => Observable<SolicitudEndoso>>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    listar = vi.fn<(filtro: FiltroEndosos) => Observable<PaginaEndosos>>().mockReturnValue(of(PAGINA));
    tomar = vi.fn<(id: string) => Observable<SolicitudEndoso>>().mockReturnValue(of(PAGINA.items[0]));
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([
          { path: 'originacion/endosos', component: BandejaEndososPage },
          { path: 'originacion/endosos/:id', component: DetalleFalso },
        ]),
        { provide: OriginacionApiService, useValue: { listarSolicitudesEndoso: listar, iniciarRevisionEndoso: tomar } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const abrir = (consulta = '') => harness.navigateByUrl(`/originacion/endosos${consulta}`);
  const url = () => TestBed.inject(Router).url;
  const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

  it('por defecto pide las pendientes y muestra los tres indicadores del frame (CA-1)', async () => {
    await abrir();

    expect(listar.mock.lastCall?.[0]).toEqual({ tipo: null, estado: 'pending', desde: null, pagina: 1, tamano: 20 });
    expect(screen.getByRole('heading', { level: 1, name: 'Endosos' })).toBeTruthy();
    const indicadores = screen.getByRole('region', { name: 'Indicadores de los endosos' }).textContent ?? '';
    expect(indicadores).toContain('2 llevan más de 24 h');
    expect(indicadores).toContain('Tiempo medio 3 h 20 min');
    expect(indicadores).toContain('Validación de participación');
    expect(screen.getByText('4 solicitudes')).toBeTruthy();
    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('pending');
  });

  it('cada fila trae el titular con su documento y la acción según su estado', async () => {
    await abrir();

    const [radicada, enRevision, noAplicada, aplicada] = filas();
    expect(radicada.textContent).toContain('Carolina Pérez Ruiz');
    expect(radicada.textContent).toContain('1.020.345.678');
    expect(within(radicada).getByRole('button', { name: 'Revisar la solicitud SOL-MOD-2026-0042' })).toBeTruthy();
    expect(within(enRevision).getByRole('link', { name: 'Continuar la solicitud SOL-MOD-2026-0041' })).toBeTruthy();
    expect(noAplicada.textContent).toContain('No aplicado');
    expect(within(noAplicada).getByRole('link', { name: 'Continuar la solicitud SOL-MOD-2026-0043' })).toBeTruthy();
    expect(within(aplicada).getByRole('link', { name: 'Ver la solicitud SOL-MOD-2026-0039' }).getAttribute('href')).toBe(
      '/originacion/endosos/SOL-MOD-2026-0039',
    );
  });

  it('«Revisar» toma la solicitud y abre su detalle (D-9 a)', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Revisar la solicitud SOL-MOD-2026-0042' }));
    await harness.fixture.whenStable();

    expect(tomar).toHaveBeenCalledWith('SOL-MOD-2026-0042');
    expect(url()).toBe('/originacion/endosos/SOL-MOD-2026-0042');
  });

  it('si otro analista ya la decidió, avisa y se queda en la bandeja', async () => {
    tomar.mockReturnValue(throwError(() => new ErrorEndoso('request_already_decided', 'applied')));
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Revisar la solicitud SOL-MOD-2026-0042' }));

    expect(screen.getByRole('alert').textContent).toContain('No se pudo tomar la solicitud SOL-MOD-2026-0042');
    expect(url()).toBe('/originacion/endosos');
  });

  it('los filtros van a la URL y vuelven a consultar', async () => {
    await abrir();

    fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: 'insured_amount' } });
    await harness.fixture.whenStable();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'all' } });
    await harness.fixture.whenStable();
    fireEvent.change(screen.getByLabelText('Radicada desde'), { target: { value: '2026-09-09' } });
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/endosos?tipo=insured_amount&estado=all&desde=2026-09-09');
    expect(listar.mock.lastCall?.[0]).toEqual({ tipo: 'insured_amount', estado: 'all', desde: '2026-09-09', pagina: 1, tamano: 20 });
  });

  it('sin pendientes muestra el estado vacío; con filtros, «Limpiar filtros»', async () => {
    listar.mockReturnValue(of(VACIA));
    await abrir();
    expect(screen.getByText('No hay solicitudes pendientes')).toBeTruthy();
    expect(screen.getByText('Ninguna lleva más de 24 h')).toBeTruthy();

    await abrir('?estado=applied');
    expect(screen.getByText('No hay solicitudes con estos filtros')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await harness.fixture.whenStable();
    expect(url()).toBe('/originacion/endosos');
  });

  it('pagina con «Siguiente»', async () => {
    listar.mockReturnValue(of({ ...PAGINA, total: 45, totalPaginas: 3 }));
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await harness.fixture.whenStable();

    expect(url()).toBe('/originacion/endosos?pagina=2');
    expect(screen.getByText('Página 1 de 3')).toBeTruthy();
  });

  it('una falla del servicio muestra «Reintentar»', async () => {
    listar.mockReturnValueOnce(throwError(() => new ErrorEndoso('endorsement_unavailable'))).mockReturnValue(of(PAGINA));
    await abrir();
    expect(screen.getByText('No pudimos cargar los endosos')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(filas()).toHaveLength(4);
  });
});
