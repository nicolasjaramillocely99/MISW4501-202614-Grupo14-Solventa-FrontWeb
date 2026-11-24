import { render, screen } from '@testing-library/angular';
import {
  DETALLE_CERRADA_DTO,
  DETALLE_DESPACHADA_DTO,
  DETALLE_UBICADA_POR_VOZ_DTO,
} from '@testing/asistencia-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import {
  AccionHistorial,
  Despacho,
  mapearDetalleAsistencia,
} from '@core/api/siniestros/asistencia.modelos';

import { HistorialAsistenciaComponent } from './historial-asistencia.component';

describe('HistorialAsistenciaComponent (O9b · HU-W2.3-03, S18, CA-5)', () => {
  afterEach(() => vi.useRealTimers());

  const renderizar =(historial: readonly AccionHistorial[], despacho: Despacho | null = null) =>
    render(HistorialAsistenciaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { historial, despacho },
    });

  const lineas = () =>
    screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/\s+/g, ' ').trim());

  it('cada decisión con su hora y su analista, en orden, incluida la toma', async () => {
    // Los datos son del 21/11/2026: la hora va sin fecha solo si el evento es de hoy.
    vi.useFakeTimers({ now: new Date('2026-11-21T17:00:00Z'), toFake: ['Date'] });
    await renderizar(mapearDetalleAsistencia(DETALLE_UBICADA_POR_VOZ_DTO).historial);

    expect(screen.getByRole('heading', { name: 'Historial' })).toBeTruthy();
    expect(lineas()).toEqual([
      expect.stringMatching(/^\d\d:\d\d · Andrés Ruiz atendió la solicitud$/),
      expect.stringMatching(
        /^\d\d:\d\d · Diana Torres tomó la solicitud de operaciones\.local@example\.com$/,
      ),
      expect.stringMatching(/^\d\d:\d\d · Diana Torres registró la necesidad Grúa$/),
      expect.stringMatching(/^\d\d:\d\d · Diana Torres registró la ubicación indicada por voz$/),
    ]);
    expect(screen.getAllByRole('listitem')[0].querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-11-21T16:16:11.389133Z',
    );
  });

  it('el despacho nombra al prestador; sin el despacho, su id', async () => {
    const detalle = mapearDetalleAsistencia(DETALLE_DESPACHADA_DTO);
    const { rerender } = await renderizar(detalle.historial, detalle.despacho);
    expect(lineas()[2]).toMatch(/Andrés Ruiz despachó a Grúas Autopista Norte$/);

    await rerender({ inputs: { historial: detalle.historial, despacho: null } });
    expect(lineas()[2]).toMatch(/Andrés Ruiz despachó a prv-gruas-autopista-norte$/);
  });

  it('el cierre con su motivo; sin nombre, el correo; una acción nueva, con su código', async () => {
    const [cierre] = mapearDetalleAsistencia(DETALLE_CERRADA_DTO).historial;
    await renderizar([
      cierre,
      {
        ...cierre,
        accion: 'reopened',
        por: { correo: 'x@example.com', nombre: null },
        detalle: null,
      },
    ]);

    expect(lineas()).toEqual([
      expect.stringMatching(/Andrés Ruiz cerró la solicitud: Resuelto durante la llamada$/),
      expect.stringMatching(/x@example\.com · reopened$/),
    ]);
  });

  it('sin decisiones lo dice', async () => {
    await renderizar([]);

    expect(screen.getByText('Aún no hay decisiones registradas.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
