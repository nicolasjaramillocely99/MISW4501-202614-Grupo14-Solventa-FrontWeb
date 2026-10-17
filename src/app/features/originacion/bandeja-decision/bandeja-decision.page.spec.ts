import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SOLICITUD_AJUSTADA_DTO, SOLICITUD_PENDIENTE_DTO } from '@testing/revision-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  ErrorRevision,
  FiltroBandeja,
  ListaSolicitudesRevision,
  mapearSolicitudRevision,
} from '@core/api/originacion/revision.modelos';

import { BandejaDecisionPage } from './bandeja-decision.page';
import { AvisoDecisionService } from './servicios/aviso-decision.service';

const PENDIENTES: ListaSolicitudesRevision = {
  solicitudes: [mapearSolicitudRevision(SOLICITUD_PENDIENTE_DTO)],
  conteos: { pendientes: 1, decididas: 4 },
};

const DECIDIDAS: ListaSolicitudesRevision = {
  solicitudes: [mapearSolicitudRevision(SOLICITUD_AJUSTADA_DTO)],
  conteos: { pendientes: 1, decididas: 4 },
};

describe('BandejaDecisionPage (S4 / S4b · HU-W1.1-02)', () => {
  let listar: ReturnType<typeof vi.fn<(filtro: FiltroBandeja) => Observable<ListaSolicitudesRevision>>>;

  let avisos: AvisoDecisionService;

  async function renderizar(...respuestas: Observable<ListaSolicitudesRevision>[]) {
    listar = vi.fn();
    for (const r of respuestas) {
      listar.mockReturnValueOnce(r);
    }
    listar.mockReturnValue(of(PENDIENTES));
    return render(BandejaDecisionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: { listarSolicitudesRevision: listar } },
        { provide: AvisoDecisionService, useValue: avisos },
      ],
    });
  }

  beforeEach(() => {
    avisos = new AvisoDecisionService();
  });

  it('pide las pendientes, la más antigua primero, e informa que carga', async () => {
    await renderizar(new Subject<ListaSolicitudesRevision>());

    expect(listar).toHaveBeenCalledWith({ estado: 'pending', motivo: null, orden: 'asc' });
    expect(screen.getByRole('status').textContent).toContain('Cargando las solicitudes');
    expect(screen.getByRole('heading', { level: 1, name: 'Bandeja de decisión humana' })).toBeTruthy();
  });

  it('muestra las pestañas con sus conteos y la tabla de pendientes (CA-1, CA-5)', async () => {
    await renderizar(of(PENDIENTES));

    const pendientes = screen.getByRole('tab', { name: 'Pendientes (1)' });
    expect(pendientes.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Decididas (4)' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tabpanel')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Solicitudes pendientes de decisión' })).toBeTruthy();
    expect(screen.getByText('Carolina Pérez Ruiz')).toBeTruthy();
  });

  it('la pestaña «Decididas» pide las decididas y muestra su registro (CA-4, CA-5)', async () => {
    await renderizar(of(PENDIENTES), of(DECIDIDAS));

    await userEvent.click(screen.getByRole('tab', { name: 'Decididas (4)' }));

    expect(listar).toHaveBeenLastCalledWith({ estado: 'decided', motivo: null, orden: 'asc' });
    expect(screen.getByRole('table', { name: 'Solicitudes decididas' })).toBeTruthy();
    expect(screen.getByText('Ajustada')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Decididas (4)' }).getAttribute('aria-selected')).toBe('true');
  });

  it('hacer clic en la pestaña activa no vuelve a consultar', async () => {
    await renderizar(of(PENDIENTES));

    await userEvent.click(screen.getByRole('tab', { name: 'Pendientes (1)' }));

    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('las flechas del teclado cambian de pestaña y llevan el foco', async () => {
    await renderizar(of(PENDIENTES), of(DECIDIDAS), of(PENDIENTES), of(DECIDIDAS), of(PENDIENTES));
    const pendientes = screen.getByRole('tab', { name: 'Pendientes (1)' });
    pendientes.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'decided' }));
    expect(document.activeElement?.id).toBe('pestana-decided');

    await userEvent.keyboard('{ArrowLeft}');
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'pending' }));
    await userEvent.keyboard('{End}');
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'decided' }));
    await userEvent.keyboard('{Home}');
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'pending' }));
    const llamadas = listar.mock.calls.length;
    await userEvent.keyboard('a');
    expect(listar).toHaveBeenCalledTimes(llamadas);
  });

  it('filtra por motivo y ordena por llegada', async () => {
    await renderizar(of(PENDIENTES), of(PENDIENTES), of(PENDIENTES), of(PENDIENTES));

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'Puntaje de riesgo alto');
    expect(listar).toHaveBeenLastCalledWith({ estado: 'pending', motivo: 'high_risk_score', orden: 'asc' });

    await userEvent.selectOptions(screen.getByLabelText('Orden por llegada'), 'La más reciente primero');
    expect(listar).toHaveBeenLastCalledWith({ estado: 'pending', motivo: 'high_risk_score', orden: 'desc' });

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'Todos');
    await userEvent.selectOptions(screen.getByLabelText('Orden por llegada'), 'La más antigua primero');
    expect(listar).toHaveBeenLastCalledWith({ estado: 'pending', motivo: null, orden: 'asc' });
  });

  it.each([
    ['pending', 'No hay solicitudes pendientes de decisión.'],
    ['decided', 'Todavía no hay solicitudes decididas.'],
  ] as const)('sin solicitudes %s muestra el estado vacío', async (estado, texto) => {
    const vacia: ListaSolicitudesRevision = { solicitudes: [], conteos: { pendientes: 0, decididas: 0 } };
    await renderizar(of(vacia), of(vacia));
    if (estado === 'decided') {
      await userEvent.click(screen.getByRole('tab', { name: 'Decididas (0)' }));
    }

    expect(screen.getByText(texto)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('con un motivo filtrado sin resultados lo dice', async () => {
    const vacia: ListaSolicitudesRevision = { solicitudes: [], conteos: { pendientes: 0, decididas: 0 } };
    await renderizar(of(PENDIENTES), of(vacia));

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'Perfil provisional (fuente caída)');

    expect(screen.getByText('No hay solicitudes con este motivo.')).toBeTruthy();
  });

  it('si la bandeja no carga muestra el error y reintenta', async () => {
    await renderizar(throwError(() => new ErrorRevision('review_unavailable')), of(PENDIENTES));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar la bandeja');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(listar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Carolina Pérez Ruiz')).toBeTruthy();
  });

  it('al volver del detalle anuncia «Decisión registrada» una sola vez (S4b)', async () => {
    avisos.publicar({ aceptacionId: 'acc-1', solicitante: 'Carolina Pérez Ruiz', tipo: 'adjust' });

    await renderizar(of(PENDIENTES));

    expect(screen.getByRole('heading', { level: 1, name: 'Decisión registrada' })).toBeTruthy();
    expect(screen.getByText(/La decisión de Carolina Pérez Ruiz quedó registrada/)).toBeTruthy();
    expect(avisos.consumir()).toBeNull();
  });
});
