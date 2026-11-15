import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  DESEMPENO_DEGRADADO_DTO,
  DESEMPENO_NO_DISPONIBLE_DTO,
  DESEMPENO_OPERATIVO_DTO,
} from '@testing/desempeno-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  DesempenoApi,
  ErrorDesempeno,
  PeriodoDesempeno,
  mapearDesempeno,
} from '@core/api/socios/desempeno.modelos';
import { SociosApiService } from '@core/api/socios/socios-api.service';

import { DesempenoPage } from './desempeno.page';

const DEGRADADO = mapearDesempeno(DESEMPENO_DEGRADADO_DTO);
const OPERATIVO = mapearDesempeno(DESEMPENO_OPERATIVO_DTO);
const NO_DISPONIBLE = mapearDesempeno(DESEMPENO_NO_DISPONIBLE_DTO);

describe('DesempenoPage (B3 · HU-W3.2-03)', () => {
  let consultar: ReturnType<typeof vi.fn<(periodo: PeriodoDesempeno) => Observable<DesempenoApi>>>;

  beforeEach(() => {
    consultar = vi.fn<(periodo: PeriodoDesempeno) => Observable<DesempenoApi>>().mockReturnValue(of(OPERATIVO));
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([{ path: 'socios/tablero/desempeno', component: DesempenoPage }]),
        { provide: SociosApiService, useValue: { consultarDesempeno: consultar } },
      ],
    });
  });

  const abrir = async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/socios/tablero/desempeno');
    return harness;
  };
  const estado = () => screen.getByTestId('estado-api');
  const texto = (id: string) => screen.getByTestId(id).textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('abre con los últimos 7 días y muestra el estado operativo, la disponibilidad y el p95 (CA-1)', async () => {
    await abrir();

    expect(consultar).toHaveBeenCalledWith('7d');
    expect(screen.getByRole('heading', { level: 1, name: 'Desempeño técnico de la API' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Últimos 7 días' }).getAttribute('aria-pressed')).toBe('true');
    expect(estado().className).toContain('estado--operational');
    expect(within(estado()).getByRole('heading', { name: 'Operativo' })).toBeTruthy();
    expect(texto('tarjeta-disponibilidad')).toContain('100 %');
    expect(texto('tarjeta-disponibilidad')).toContain('Objetivo ≥ 99,9 %');
    expect(texto('tarjeta-p95')).toContain('360 ms');
    expect(texto('tarjeta-p95')).toContain('Presupuesto 400 ms');
    expect(screen.getByText(/actualizado a las 22:30/)).toBeTruthy();
  });

  it('sin incidentes dice que la integración operó sin interrupciones (CA-4)', async () => {
    await abrir();

    expect(texto('sin-incidentes')).toBe('La integración operó sin interrupciones en el período.');
    expect(screen.queryAllByTestId('incidente')).toHaveLength(0);
  });

  it('degradado: resalta el estado, marca el p95 sobre el presupuesto y cita el incidente abierto (CA-1, CA-2)', async () => {
    consultar.mockReturnValue(of(DEGRADADO));

    await abrir();

    expect(estado().className).toContain('estado--degraded');
    expect(within(estado()).getByRole('heading', { name: 'Degradado' })).toBeTruthy();
    expect(estado().textContent).toContain('Incidente abierto en POST /v1/offers desde el 16/09/2026 16:20');
    expect(texto('tarjeta-p95')).toContain('1.150 ms');
    expect(texto('tarjeta-p95')).toContain('sobre el presupuesto');
    expect(screen.getByTestId('tarjeta-p95').querySelector('.indicador__valor--error')).not.toBeNull();
    expect(texto('tarjeta-disponibilidad')).toContain('99,96 %');
    expect(texto('tarjeta-disponibilidad')).not.toContain('por debajo del objetivo');
  });

  it('no disponible: resalta el estado de otra forma y marca la disponibilidad bajo el objetivo (CA-2)', async () => {
    consultar.mockReturnValue(of(NO_DISPONIBLE));

    await abrir();

    expect(estado().className).toContain('estado--unavailable');
    expect(estado().className).not.toContain('estado--degraded');
    expect(within(estado()).getByRole('heading', { name: 'No disponible' })).toBeTruthy();
    expect(texto('tarjeta-disponibilidad')).toContain('97,5 %');
    expect(texto('tarjeta-disponibilidad')).toContain('por debajo del objetivo');
  });

  it('lista los incidentes con fecha, hora de inicio, duración y estado (CA-3)', async () => {
    consultar.mockReturnValue(of(DEGRADADO));

    await abrir();

    const [abierto, resuelto] = screen.getAllByTestId('incidente').map((i) => i.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(abierto).toContain('Degradado · POST /v1/offers');
    expect(abierto).toContain('En curso');
    expect(abierto).toContain('Inicio 16/09/2026 16:20');
    expect(abierto).toContain('en curso hace 42 min');
    expect(resuelto).toContain('No disponible · POST /v1/risk-profiles/resolve');
    expect(resuelto).toContain('Resuelto');
    expect(resuelto).toContain('Inicio 08/09/2026 03:12');
    expect(resuelto).toContain('duración 14 min');
  });

  it('al cambiar de periodo consulta ese periodo (CA-3)', async () => {
    await abrir();

    consultar.mockReturnValue(of(DEGRADADO));
    await userEvent.click(screen.getByRole('button', { name: 'Últimos 30 días' }));

    expect(consultar).toHaveBeenLastCalledWith('30d');
    expect(screen.getByRole('button', { name: 'Últimos 30 días' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByTestId('incidente')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(consultar).toHaveBeenLastCalledWith('today');
  });

  it('sin solicitudes en el periodo el p95 no tiene valor', async () => {
    consultar.mockReturnValue(of({ ...OPERATIVO, latencia: { p95Ms: null, presupuestoMs: 400 } }));

    await abrir();

    expect(texto('tarjeta-p95')).toContain('—');
    expect(texto('tarjeta-p95')).toContain('Sin solicitudes en el período');
  });

  it('muestra cargando mientras consulta', async () => {
    const pendiente = new Subject<DesempenoApi>();
    consultar.mockReturnValue(pendiente);

    await abrir();

    expect(screen.getByRole('status').textContent).toContain('Consultando el desempeño de la API');
    pendiente.next(OPERATIVO);
    pendiente.complete();
  });

  it('una falla muestra «Reintentar» y reintenta el mismo periodo', async () => {
    consultar.mockReturnValueOnce(throwError(() => new ErrorDesempeno('telemetry_unavailable')));
    const harness = await abrir();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos consultar el desempeño de la API');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    harness.detectChanges();

    expect(consultar).toHaveBeenCalledTimes(2);
    expect(consultar).toHaveBeenLastCalledWith('7d');
    expect(estado().className).toContain('estado--operational');
  });

  it('un error que no es del contrato también se muestra como falla', async () => {
    consultar.mockReturnValueOnce(throwError(() => new Error('x')));

    await abrir();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos consultar el desempeño de la API');
  });

  it('un estado desconocido se muestra neutro', async () => {
    consultar.mockReturnValue(of({ ...OPERATIVO, estado: 'desconocido' }));

    await abrir();

    expect(within(estado()).getByRole('heading', { name: 'Estado desconocido' })).toBeTruthy();
  });
});
