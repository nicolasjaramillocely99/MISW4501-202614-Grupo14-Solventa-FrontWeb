import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ACCIONES_DTO, LISTA_EMISIONES_DTO } from '@testing/emision-monitor-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  CodigoErrorEmision,
  ErrorEmision,
  FiltroEmisiones,
  ListaEmisiones,
  ReintentoEmision,
  mapearListaAcciones,
  mapearListaEmisiones,
} from '@core/api/originacion/emision-monitor.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { EmisionesPage, INTERVALO_SONDEO_MS } from './emisiones.page';

const LISTA = mapearListaEmisiones(LISTA_EMISIONES_DTO);
const VACIA: ListaEmisiones = { emisiones: [], conteos: LISTA.conteos };
const falla = (codigo: CodigoErrorEmision) => throwError(() => new ErrorEmision(codigo));
const SIN_FILTROS: FiltroEmisiones = { estado: null, canal: null, desde: null, hasta: null };

describe('EmisionesPage (O1 · HU-W1.3-04)', () => {
  let listar: ReturnType<typeof vi.fn<(f: FiltroEmisiones) => Observable<ListaEmisiones>>>;
  let reintentar: ReturnType<typeof vi.fn<(id: string, nota: string) => Observable<ReintentoEmision>>>;

  async function renderizar(respuesta: Observable<ListaEmisiones> = of(LISTA)) {
    listar = vi.fn().mockReturnValue(respuesta);
    reintentar = vi.fn().mockReturnValue(of({ aceptacionId: 'acc-0004', accion: 'resume' }));
    return render(EmisionesPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        {
          provide: OriginacionApiService,
          useValue: {
            listarEmisiones: listar,
            listarAccionesEmision: vi.fn().mockReturnValue(of(mapearListaAcciones({ items: ACCIONES_DTO }))),
            reintentarEmision: reintentar,
          },
        },
      ],
    });
  }

  const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
  const celdas = (fila: HTMLElement) => within(fila).getAllByRole('cell');

  it('muestra las cinco tarjetas con los conteos de todas las emisiones (O1)', async () => {
    await renderizar();

    const tarjetas = within(screen.getByRole('list', { name: 'Resumen de las emisiones' })).getAllByRole('listitem');
    expect(tarjetas.map((t) => Array.from(t.querySelectorAll('span')).map((s) => s.textContent?.trim()))).toEqual([
      ['Aceptadas', '18', 'Suscripción en curso'],
      ['En cobro', '6', '2 con reintentos'],
      ['Activas hoy', '42', 'Cobertura activada'],
      ['Notificadas', '40', 'Documento entregado hoy'],
      ['En excepción', '3', 'Requieren intervención · 1 sin atender'],
    ]);
  });

  it('el encabezado trae «Actualizar» y la descripción del mockup', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { name: 'Monitoreo de emisiones', level: 1 })).toBeTruthy();
    expect(
      screen.getByText('Estado en tiempo real de las emisiones en curso y sus excepciones. Las que fluyen sin excepciones no requieren ninguna acción.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeTruthy();
    expect(listar).toHaveBeenCalledWith(SIN_FILTROS);
  });

  it('cada emisión muestra su cliente, canal, estado, último paso y hora (CA-1)', async () => {
    await renderizar();

    expect(screen.getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual([
      'Emisión',
      'Cliente',
      'Canal',
      'Estado',
      'Último paso',
      'Hora',
      'Acciones',
    ]);
    expect(filas()).toHaveLength(6);
    const [excepcion, , notificada, activa, enCobro, aceptada] = filas().map(celdas);
    expect(excepcion[0].textContent).toBe('acc-0004');
    expect(excepcion[1].textContent).toContain('Luis Fernando Castro');
    expect(excepcion[1].textContent).toContain('off-0004');
    expect(excepcion[2].textContent).toBe('Web');
    expect(excepcion[3].textContent).toContain('En excepción');
    expect(excepcion[4].textContent).toBe('Dependencia caída · pasarela de pagos');
    expect(notificada[3].textContent?.trim()).toBe('Notificada');
    expect(notificada[4].textContent).toBe('Documento generado y notificado');
    expect(activa[3].textContent?.trim()).toBe('Activa');
    expect(activa[4].textContent).toBe('Documento generado · aviso pendiente');
    expect(enCobro[3].textContent?.trim()).toBe('En cobro');
    expect(enCobro[4].textContent).toBe('Reintento 3 · pasarela sin respuesta');
    expect(aceptada[1].textContent).toContain('Sin nombre registrado');
    expect(aceptada[2].textContent).toBe('Móvil');
    expect(aceptada[3].textContent?.trim()).toBe('Aceptada');
    expect(aceptada[4].textContent).toBe('Suscripción automática en curso');
  });

  it('una excepción trae su motivo en el último paso (CA-2) y la que lleva 30 minutos queda marcada', async () => {
    await renderizar();

    const [sinAtender, documento] = filas();
    expect(within(sinAtender).getByText('Sin atender')).toBeTruthy();
    expect(within(documento).getByText('Dependencia caída · generador de documentos')).toBeTruthy();
    expect(within(documento).queryByText('Sin atender')).toBeNull();
  });

  it('las excepciones se «Gestionan» y las demás solo se «Ven», sin pedir ninguna acción (CA-5)', async () => {
    await renderizar();

    expect(screen.getAllByRole('button', { name: /^Gestionar la excepción de la emisión/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Ver la emisión/ })).toHaveLength(4);
    expect(within(filas()[2]).getByRole('button', { name: 'Ver la emisión acc-0006' }).textContent?.trim()).toBe('Ver');
    expect(within(filas()[0]).getByRole('button').textContent?.trim()).toBe('Gestionar');
  });

  it('una emisión sin excepción abre el detalle en solo lectura', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Ver la emisión acc-0006' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Detalle de la emisión' });
    expect(within(dialogo).getByText('Marta Ruiz Ospina')).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('filtra por estado en el servidor, incluida la notificada (CA-4)', async () => {
    await renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'notified');

    expect(listar).toHaveBeenLastCalledWith({ ...SIN_FILTROS, estado: 'notified' });
  });

  it('filtra por canal', async () => {
    await renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'mobile');

    expect(listar).toHaveBeenLastCalledWith({ ...SIN_FILTROS, canal: 'mobile' });
  });

  it('filtra por rango de fechas (CA-4)', async () => {
    await renderizar();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-19' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-20' } });

    expect(listar).toHaveBeenLastCalledWith({ ...SIN_FILTROS, desde: '2026-10-19', hasta: '2026-10-20' });
  });

  it('no consulta con un rango al revés y lo avisa', async () => {
    await renderizar();
    listar.mockClear();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-21' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-20' } });

    expect((await screen.findByRole('alert')).textContent).toContain('La fecha inicial no puede ser posterior a la final.');
    expect(screen.getByLabelText('Desde').getAttribute('aria-invalid')).toBe('true');
    expect(listar).toHaveBeenCalledTimes(1); // solo la de «desde» sola, que aún era válida
  });

  it('sin resultados muestra la vista vacía, sin error (CA-4)', async () => {
    await renderizar(of(VACIA));

    expect(screen.getByRole('status').textContent).toContain('No hay emisiones por mostrar.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('con filtros activos el vacío lo dice y «Limpiar filtros» vuelve a todo', async () => {
    await renderizar(of(VACIA));
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'active');

    expect(screen.getByText('No hay emisiones con estos filtros.')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'web');
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect((screen.getByLabelText('Estado') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Canal') as HTMLSelectElement).value).toBe('');
    expect(listar).toHaveBeenLastCalledWith(SIN_FILTROS);
  });

  it('avisa cuando el servicio no responde y deja reintentar', async () => {
    await renderizar(falla('charge_unavailable'));

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cargar las emisiones');
    listar.mockReturnValue(of(LISTA));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('«Actualizar» vuelve a consultar y dice hace cuánto se actualizó', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(listar).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/^Actualizado hace \d+ s$/)).toBeTruthy();
  });

  describe('con el reloj controlado', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }));
    afterEach(() => vi.useRealTimers());

    it('se actualiza solo cada 30 s sin vaciar la lista (CA-1, «tiempo real»)', async () => {
      const { fixture } = await renderizar();
      expect(listar).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS);
      await fixture.whenStable();

      expect(listar).toHaveBeenCalledTimes(2);
      expect(filas()).toHaveLength(6);
      expect(screen.queryByText('Cargando emisiones…')).toBeNull();
    });

    it('«Actualizado hace N s» corre solo, y pasa a minutos', async () => {
      const { fixture } = await renderizar();

      await vi.advanceTimersByTimeAsync(8_000);
      await fixture.whenStable();
      expect(screen.getByText('Actualizado hace 8 s')).toBeTruthy();

      listar.mockReturnValue(falla('charge_unavailable')); // la lista no se renueva: solo corre el reloj
      await vi.advanceTimersByTimeAsync(2 * INTERVALO_SONDEO_MS);
      await fixture.whenStable();
      expect(screen.getByText('Actualizado hace 1 min')).toBeTruthy();
    });

    it('si una actualización falla conserva la lista y lo avisa sin bloquear la vista', async () => {
      const { fixture } = await renderizar();
      listar.mockReturnValue(falla('charge_unavailable'));

      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS);
      await fixture.whenStable();

      expect(filas()).toHaveLength(6);
      expect(screen.getByText(/No pudimos actualizar la lista/)).toBeTruthy();
      listar.mockReturnValue(of(LISTA));
      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS);
      await fixture.whenStable();
      expect(screen.queryByText(/No pudimos actualizar la lista/)).toBeNull();
    });
  });

  it('gestiona la excepción: la reintenta con una nota, lo anuncia y refresca la lista (CA-3)', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Gestionar la excepción de la emisión acc-0004' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Excepción de emisión' });
    await userEvent.type(within(dialogo).getByLabelText('Nota del reintento'), 'Pasarela restablecida');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reintentar' }));

    expect(reintentar).toHaveBeenCalledWith('acc-0004', 'Pasarela restablecida');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Reintento registrado')).toBeTruthy();
    expect(screen.getByText(/Se reintentó la emisión acc-0004/)).toBeTruthy();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('al cerrar el diálogo devuelve el foco al botón que lo abrió', async () => {
    await renderizar();
    const boton = screen.getByRole('button', { name: 'Gestionar la excepción de la emisión acc-0004' });

    await userEvent.click(boton);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await Promise.resolve();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(boton);
  });
});
