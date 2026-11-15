import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { crearProveedorIdentidadFalso, iniciarSesionComo, proveerSesionPrueba } from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { ErrorResumenSocio, RangoResumen, ResumenSocio } from '@core/api/originacion/resumen-socio.modelos';

import { TableroPage } from './tablero.page';

/** 16 de septiembre de 2026, 22:30 en Colombia: en UTC ya es el 17. */
const AHORA = new Date('2026-09-17T03:30:00Z');

const resumen = (rango: RangoResumen, cotizaciones: number, polizas: number, tasa: number): ResumenSocio => ({
  socioId: 'socio-001',
  desde: rango.desde,
  hasta: rango.hasta,
  cotizaciones,
  polizasEmitidas: polizas,
  tasaConversion: tasa,
});

describe('TableroPage (B1 · HU-W3.2-01)', () => {
  let consultar: ReturnType<typeof vi.fn<(rango: RangoResumen) => Observable<ResumenSocio>>>;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    consultar = vi
      .fn<(rango: RangoResumen) => Observable<ResumenSocio>>()
      .mockImplementation((rango) => of(resumen(rango, 12480, 1872, 15)));
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([{ path: 'socios/tablero', component: TableroPage }]),
        ...proveerSesionPrueba(crearProveedorIdentidadFalso()),
        { provide: OriginacionApiService, useValue: { consultarResumenSocio: consultar } },
      ],
    });
    await iniciarSesionComo('socio');
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  const abrir = async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/socios/tablero');
    return harness;
  };
  const tarjeta = (id: string) => screen.getByTestId(id).textContent?.replace(/\s+/g, ' ').trim();
  const ultimaConsulta = () => consultar.mock.lastCall?.[0];

  it('abre con los últimos 30 días de Colombia y muestra las tres tarjetas (CA-1)', async () => {
    await abrir();

    expect(ultimaConsulta()).toEqual({ desde: '2026-08-18', hasta: '2026-09-16' });
    expect(screen.getByRole('heading', { level: 1, name: 'Tablero de integración' })).toBeTruthy();
    expect(screen.getByText(/Banco Aliado · últimos 30 días \(18\/08 a 16\/09\/2026\)/)).toBeTruthy();
    expect(tarjeta('tarjeta-cotizaciones')).toContain('12.480');
    expect(tarjeta('tarjeta-polizas')).toContain('1.872');
    expect(tarjeta('tarjeta-conversion')).toContain('15 %');
    expect(tarjeta('tarjeta-conversion')).toContain('Pólizas / cotizaciones × 100');
    expect(screen.getByRole('button', { name: 'Últimos 30 días' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Sin cotizaciones en el rango seleccionado')).toBeNull();
  });

  it('muestra la conversión con un decimal', async () => {
    consultar.mockImplementation((rango) => of(resumen(rango, 9820, 1610, 16.4)));

    await abrir();

    expect(tarjeta('tarjeta-conversion')).toContain('16,4 %');
  });

  it('al cambiar a hoy o a los últimos 7 días actualiza las métricas (CA-2)', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(ultimaConsulta()).toEqual({ desde: '2026-09-16', hasta: '2026-09-16' });
    expect(screen.getByText(/Banco Aliado · hoy 16\/09\/2026/)).toBeTruthy();

    consultar.mockImplementation((rango) => of(resumen(rango, 3100, 465, 15)));
    await userEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }));
    expect(ultimaConsulta()).toEqual({ desde: '2026-09-10', hasta: '2026-09-16' });
    expect(tarjeta('tarjeta-cotizaciones')).toContain('3.100');
    expect(screen.getByRole('button', { name: 'Últimos 7 días' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('el rango personalizado incluye las dos fechas y consulta al aplicar (CA-2)', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    const formulario = screen.getByRole('form', { name: 'Rango personalizado' });
    fireEvent.change(within(formulario).getByLabelText('Fecha inicial'), { target: { value: '2026-09-01' } });
    fireEvent.change(within(formulario).getByLabelText('Fecha final'), { target: { value: '2026-09-15' } });
    await userEvent.click(within(formulario).getByRole('button', { name: 'Aplicar' }));

    expect(ultimaConsulta()).toEqual({ desde: '2026-09-01', hasta: '2026-09-15' });
    expect(screen.getByText(/rango personalizado \(01\/09 a 15\/09\/2026\)/)).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Rango personalizado' })).toBeNull();
  });

  it('no permite una fecha inicial posterior a la final ni consulta ese rango (CA-2)', async () => {
    await abrir();
    const consultasAntes = consultar.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Fecha inicial'), { target: { value: '2026-09-16' } });
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-09-15' } });
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByRole('alert').textContent).toContain('La fecha inicial no puede ser posterior a la fecha final.');
    expect(screen.getByLabelText('Fecha final').getAttribute('aria-invalid')).toBe('true');
    expect(consultar.mock.calls.length).toBe(consultasAntes);

    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-09-16' } });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancelar el rango personalizado conserva el rango anterior', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('form', { name: 'Rango personalizado' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Últimos 30 días' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('un rango sin datos muestra 0 y 0 % sin errores y ofrece ampliar el rango (CA-3)', async () => {
    consultar.mockImplementation((rango) => of(resumen(rango, 0, 0, 0)));
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));

    expect(tarjeta('tarjeta-cotizaciones')).toContain('0');
    expect(tarjeta('tarjeta-cotizaciones')).toContain('Sin solicitudes en el rango');
    expect(tarjeta('tarjeta-polizas')).toContain('Sin emisiones en el rango');
    expect(tarjeta('tarjeta-conversion')).toContain('0 %');
    expect(screen.getByText('Sin cotizaciones en el rango seleccionado')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Ver últimos 7 días' }));
    expect(ultimaConsulta()).toEqual({ desde: '2026-09-10', hasta: '2026-09-16' });
  });

  it('dice que los datos son solo del socio autenticado y nunca envía el socio (CA-4)', async () => {
    await abrir();

    const aviso = screen.getByRole('complementary', { name: 'Aislamiento de datos' });
    expect(aviso.textContent).toContain('exclusivamente las cotizaciones y pólizas de Banco Aliado');
    for (const [rango] of consultar.mock.calls) {
      expect(Object.keys(rango)).toEqual(['desde', 'hasta']);
    }
  });

  it('muestra cargando mientras consulta', async () => {
    const pendiente = new Subject<ResumenSocio>();
    consultar.mockReturnValue(pendiente);

    await abrir();

    expect(screen.getByRole('status').textContent).toContain('Consultando el resumen del rango');
    pendiente.next(resumen({ desde: '2026-08-18', hasta: '2026-09-16' }, 1, 1, 100));
    pendiente.complete();
  });

  it('una falla del servicio muestra «Reintentar» y reintenta el mismo rango', async () => {
    consultar.mockReturnValueOnce(throwError(() => new ErrorResumenSocio('metrics_unavailable')));
    const harness = await abrir();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos consultar el resumen');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    harness.detectChanges();

    expect(consultar).toHaveBeenCalledTimes(2);
    expect(ultimaConsulta()).toEqual({ desde: '2026-08-18', hasta: '2026-09-16' });
    expect(tarjeta('tarjeta-cotizaciones')).toContain('12.480');
  });

  it('un error que no es del contrato también se muestra como falla del servicio', async () => {
    consultar.mockReturnValueOnce(throwError(() => new Error('x')));

    await abrir();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos consultar el resumen');
  });
});
