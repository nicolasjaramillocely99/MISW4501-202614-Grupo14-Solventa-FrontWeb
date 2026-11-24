import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  BANDEJA_DTO,
  BANDEJA_SIN_DESPACHOS_DTO,
  BANDEJA_VACIA_DTO,
  DETALLE_ATENDIDA_DTO,
  ID_CON_GPS,
  ID_DESPACHADA,
  ID_SIN_GPS,
} from '@testing/asistencia-pruebas';
import { LeafletFalso, crearLeafletFalso } from '@testing/leaflet-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import {
  BandejaAsistencias,
  ErrorAsistencia,
  mapearBandeja,
  mapearDetalleAsistencia,
} from '@core/api/siniestros/asistencia.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import {
  BandejaAsistenciasPage,
  INTERVALO_BANDEJA_MS,
  LIMITE_BANDEJA,
} from './bandeja-asistencias.page';
import { CARGAR_LEAFLET } from './modelos/mapa';

const BANDEJA = mapearBandeja(BANDEJA_DTO);

describe('BandejaAsistenciasPage (O9 · HU-W2.3-03)', () => {
  let api: {
    listarBandejaAsistencias: ReturnType<typeof vi.fn>;
    atenderAsistencia: ReturnType<typeof vi.fn>;
  };
  let leaflet: LeafletFalso;

  async function renderizar(lectura: Observable<BandejaAsistencias> = of(BANDEJA)) {
    leaflet = crearLeafletFalso();
    api = {
      listarBandejaAsistencias: vi.fn().mockReturnValue(lectura),
      atenderAsistencia: vi.fn().mockReturnValue(NEVER),
    };
    const vista = await render(BandejaAsistenciasPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        { provide: CARGAR_LEAFLET, useValue: () => Promise.resolve(leaflet.modulo) },
      ],
    });
    const router = vista.fixture.debugElement.injector.get(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return { vista, navegar };
  }

  const fila = (numero: string) =>
    screen.getByRole('cell', { name: numero }).closest('tr') as HTMLElement;

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('muestra el encabezado, los indicadores, el aviso sin GPS y la tabla (CA-1)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Asistencias en sitio' })).toBeTruthy();
    expect(api.listarBandejaAsistencias).toHaveBeenCalledWith({ limite: LIMITE_BANDEJA });
    expect(screen.getByRole('region', { name: 'Indicadores de hoy' })).toBeTruthy();
    expect(screen.getByText('Solicitudes sin GPS')).toBeTruthy();
    expect(screen.getByText('Hay 1 solicitud sin ubicación registrada.')).toBeTruthy();
    expect(screen.getByText(/^Actualizado a las \d\d:\d\d$/)).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('pinta cada fila con la póliza, la ubicación, la hora y el estado (S4)', async () => {
    await renderizar();

    const conGps = within(fila('AST-2026-0001'));
    expect(conGps.getByText('Carolina Pérez')).toBeTruthy();
    expect(conGps.getByText('AU-2026-868766')).toBeTruthy();
    expect(conGps.getByText('Autos · IZJ-766')).toBeTruthy();
    expect(conGps.getByText('Autopista Norte km 12, Bogotá')).toBeTruthy();
    expect(conGps.getByText('4,7712 N · 74,0452 O · ±8 m')).toBeTruthy();
    expect(conGps.getByText('Nueva')).toBeTruthy();
    expect(fila('AST-2026-0001').classList).toContain('fila--nueva');

    const enLlamada = within(fila('AST-2026-0002'));
    expect(enLlamada.getByText('Sin GPS · ubicación por voz')).toBeTruthy();
    expect(enLlamada.getByText('Vía Cali–Palmira km 4')).toBeTruthy();
    expect(enLlamada.getByText('En llamada')).toBeTruthy();
    expect(enLlamada.getByText('con Diana Torres')).toBeTruthy();
    expect(fila('AST-2026-0002').classList).not.toContain('fila--nueva');

    const sinGps = within(fila('AST-2026-0005'));
    expect(sinGps.getByText('Sin GPS · ubicación por voz')).toBeTruthy();
    expect(sinGps.getByText('Sin señal GPS')).toBeTruthy();

    const hogar = within(fila('AST-2026-0003'));
    expect(hogar.getByText('Hogar')).toBeTruthy();
    expect(hogar.getByText('Cerrada')).toBeTruthy();
    expect(hogar.getByText('Permiso de ubicación negado')).toBeTruthy();

    expect(within(fila('AST-2026-0004')).getByText('Despachada')).toBeTruthy();
  });

  it('ofrece Atender, Continuar o Ver según el estado', async () => {
    await renderizar();

    expect(screen.getByRole('button', { name: 'Atender AST-2026-0001' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar AST-2026-0002' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver AST-2026-0004' }).getAttribute('href')).toBe(
      `/siniestros/asistencias/${ID_DESPACHADA}`,
    );
    expect(screen.getByRole('link', { name: 'Ver AST-2026-0003' })).toBeTruthy();
  });

  it('pone en el mapa solo las abiertas con coordenadas, encuadradas (F2, S7)', async () => {
    await renderizar();
    await new Promise((resolver) => setTimeout(resolver));

    expect(
      screen.getByRole('heading', { level: 2, name: 'Mapa de las solicitudes abiertas' }),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mapa de las solicitudes abiertas' })).toBeTruthy();
    expect(screen.getByText('2 solicitudes abiertas con ubicación')).toBeTruthy();
    expect(leaflet.capas.map((c) => c.etiqueta)).toEqual([
      'AST-2026-0002 · En llamada',
      'AST-2026-0001 · Nueva',
    ]);
    expect(leaflet.encuadres).toHaveLength(1);
  });

  it('atiende y abre el detalle con la respuesta (S5)', async () => {
    const { navegar } = await renderizar();
    const detalle = mapearDetalleAsistencia(DETALLE_ATENDIDA_DTO);
    api.atenderAsistencia.mockReturnValue(of(detalle));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Atender AST-2026-0001' }));

    expect(api.atenderAsistencia).toHaveBeenCalledWith(ID_CON_GPS);
    expect(navegar).toHaveBeenCalledWith(['/siniestros/asistencias', ID_CON_GPS], {
      state: { detalle },
    });
  });

  it('mientras atiende, deshabilita las demás acciones', async () => {
    await renderizar();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar AST-2026-0002' }));

    expect(api.atenderAsistencia).toHaveBeenCalledWith(ID_SIN_GPS);
    expect(screen.getByRole('button', { name: 'Continuar AST-2026-0002' }).textContent).toContain(
      'Atendiendo…',
    );
    expect(
      (screen.getByRole('button', { name: 'Atender AST-2026-0001' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('si otro analista ya la despachó o cerró, avisa y relee (409)', async () => {
    const { navegar } = await renderizar();
    api.atenderAsistencia.mockReturnValue(
      throwError(() => new ErrorAsistencia('assistance_not_open')),
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Atender AST-2026-0001' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'Otro analista ya despachó o cerró esa solicitud',
    );
    expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(2);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('con otro error al atender, avisa sin releer', async () => {
    await renderizar();
    api.atenderAsistencia.mockReturnValue(
      throwError(() => new ErrorAsistencia('assistance_unavailable')),
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Atender AST-2026-0001' }));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos atender la solicitud');
    expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(1);
  });

  it('sin solicitudes lo dice y no muestra la tabla ni el mapa', async () => {
    await renderizar(of(mapearBandeja(BANDEJA_VACIA_DTO)));

    expect(screen.getByText('No hay solicitudes de asistencia')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Mapa de las solicitudes abiertas' })).toBeNull();
    expect(screen.queryByText(/sin ubicación registrada/)).toBeNull();
  });

  it('si la primera lectura falla, muestra el error y «Reintentar» vuelve a leer', async () => {
    await renderizar(throwError(() => new ErrorAsistencia('assistance_unavailable')));

    expect(screen.getByText('No pudimos cargar las solicitudes de asistencia')).toBeTruthy();
    api.listarBandejaAsistencias.mockReturnValue(of(BANDEJA));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('«Actualizar» relee la bandeja', async () => {
    await renderizar();
    api.listarBandejaAsistencias.mockReturnValue(of(mapearBandeja(BANDEJA_SIN_DESPACHOS_DTO)));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  describe('sondeo de 30 s (S1)', () => {
    it('vuelve a leer cada 30 s y deja de hacerlo al salir', async () => {
      vi.useFakeTimers();
      const { vista } = await renderizar();

      await vi.advanceTimersByTimeAsync(INTERVALO_BANDEJA_MS - 1);
      expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(INTERVALO_BANDEJA_MS);
      expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(3);

      vista.fixture.destroy();
      await vi.advanceTimersByTimeAsync(INTERVALO_BANDEJA_MS * 3);
      expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(3);
    });

    it('un refresco que falla conserva la tabla con un aviso y sigue intentando', async () => {
      vi.useFakeTimers();
      await renderizar();
      api.listarBandejaAsistencias.mockReturnValue(
        throwError(() => new ErrorAsistencia('assistance_unavailable')),
      );

      await vi.advanceTimersByTimeAsync(INTERVALO_BANDEJA_MS);
      await vi.advanceTimersByTimeAsync(100);

      expect(
        screen.getByText('No pudimos actualizar la bandeja; se muestra la última lectura.'),
      ).toBeTruthy();
      expect(screen.getAllByRole('row')).toHaveLength(6);

      api.listarBandejaAsistencias.mockReturnValue(of(BANDEJA));
      await vi.advanceTimersByTimeAsync(INTERVALO_BANDEJA_MS);
      await vi.advanceTimersByTimeAsync(100);
      expect(screen.queryByText(/No pudimos actualizar la bandeja/)).toBeNull();
    });

    it('con la pestaña oculta no consulta y al volver lee enseguida', async () => {
      vi.useFakeTimers();
      await renderizar();

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(INTERVALO_BANDEJA_MS * 3);
      expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(api.listarBandejaAsistencias).toHaveBeenCalledTimes(2);
    });
  });
});
