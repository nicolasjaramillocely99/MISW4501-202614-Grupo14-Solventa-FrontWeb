import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';
import { PAGINA_REVISIONES_DTO } from '@testing/revision-radicacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { of, throwError } from 'rxjs';

import { mapearPaginaCola } from '@core/api/siniestros/evaluacion.modelos';
import { ErrorRevision } from '@core/api/siniestros/revision.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { RadicacionesRevisionPage } from './radicaciones-revision.page';

describe('RadicacionesRevisionPage (HU-W2.1-03)', () => {
  let api: { listarRevisiones: ReturnType<typeof vi.fn> };

  async function renderizar(primera = of(mapearPaginaCola(PAGINA_REVISIONES_DTO))) {
    api = { listarRevisiones: vi.fn().mockReturnValue(primera) };
    await render(RadicacionesRevisionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), { provide: SiniestrosApiService, useValue: api }],
    });
    return userEvent.setup();
  }

  it('lista las radicaciones por revisar y cada una abre S8', async () => {
    await renderizar();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Radicaciones por revisar' }),
    ).toBeTruthy();
    expect(screen.getByText('SIN-2026-01877')).toBeTruthy();
    expect(screen.getByText('Autos · Colisión')).toBeTruthy();
    expect(screen.getByText('Portal web')).toBeTruthy();
    expect(screen.getByText(/3\.200\.000/)).toBeTruthy();
    const revisar = screen.getByRole('link', { name: 'Revisar la radicación SIN-2026-01877' });
    expect(revisar.getAttribute('href')).toBe(`/siniestros/revision/${ID_EVALUADO}`);
  });

  it('carga la página siguiente y actualiza', async () => {
    const usuario = await renderizar();
    api.listarRevisiones.mockReturnValue(of({ items: [], siguienteToken: null }));

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(api.listarRevisiones).toHaveBeenLastCalledWith('tok-2');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(api.listarRevisiones).toHaveBeenLastCalledWith();
    expect(screen.getByRole('status').textContent).toContain(
      'No hay radicaciones pendientes de revisión.',
    );
  });

  it('si falla, lo dice y deja reintentar', async () => {
    const usuario = await renderizar(throwError(() => new ErrorRevision('claims_unavailable')));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar las radicaciones');
    api.listarRevisiones.mockReturnValue(of(mapearPaginaCola(PAGINA_REVISIONES_DTO)));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('SIN-2026-01877')).toBeTruthy();
  });

  it('si falla al cargar más, muestra el error', async () => {
    const usuario = await renderizar();
    api.listarRevisiones.mockReturnValue(throwError(() => new ErrorRevision('claims_unavailable')));

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
