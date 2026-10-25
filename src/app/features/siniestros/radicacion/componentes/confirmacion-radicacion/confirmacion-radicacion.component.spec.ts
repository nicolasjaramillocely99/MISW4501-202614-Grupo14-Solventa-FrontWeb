import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SINIESTRO_MOVIL_DTO, SINIESTRO_RADICADO_DTO } from '@testing/siniestros-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { DetalleSiniestro, mapearDetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';

import { ConfirmacionRadicacionComponent } from './confirmacion-radicacion.component';

const CASO = mapearDetalleSiniestro(SINIESTRO_RADICADO_DTO);
const CASO_MOVIL = mapearDetalleSiniestro({
  ...SINIESTRO_MOVIL_DTO,
  place: 'Bogotá',
  description: 'Hurto del vehículo en la noche.',
  supports: { required_total: 0, required_attached: 0, files: 0, items: [] },
});

describe('ConfirmacionRadicacionComponent (A6b · HU-W2.1-01)', () => {
  async function renderizar(caso: DetalleSiniestro = CASO, entradas: { descargando?: boolean; errorDescarga?: boolean } = {}) {
    const descargar = vi.fn();
    await render(ConfirmacionRadicacionComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { caso, ...entradas },
      on: { descargar },
    });
    return { descargar };
  }

  it('muestra el radicado, el estado, el resumen y los datos del caso (CA-4)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01712' })).toBeTruthy();
    expect(screen.getAllByText('Radicado').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Colisión con daños al vehículo · Autos AU-2025-118204 · KJT-482 · Radicado el \d{2}\/\d{2}\/2026 a las \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Tu siniestro quedó radicado');
    expect(screen.getByText('SIN-2026-01712', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByText('Autos · AU-2025-118204')).toBeTruthy();
    expect(screen.getByText('3 de 3 obligatorios · 8 archivos')).toBeTruthy();
    expect(screen.getByText('Qué sigue')).toBeTruthy();
  });

  it('muestra las cinco etapas con «Radicado» como la actual', async () => {
    await renderizar();

    const etapas = screen.getByRole('list', { name: 'Etapas del siniestro' });
    expect(etapas.textContent).toContain('Revisión del asesor');
    expect(etapas.textContent).toContain('Pagado');
    expect(etapas.querySelector('[aria-current="step"]')?.textContent).toContain('Radicado');
  });

  it('emite la descarga y no ofrece «Ver el estado del siniestro» (HU-W2.1-02)', async () => {
    const { descargar } = await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Descargar radicado' }));

    expect(descargar).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Ver el estado/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver a mis siniestros' }).getAttribute('href')).toBe('/siniestros/mis-siniestros');
  });

  it('mientras descarga deshabilita el botón y avisa si la descarga falla', async () => {
    await renderizar(CASO, { descargando: true, errorDescarga: true });

    expect((screen.getByRole('button', { name: 'Descargando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('No pudimos descargar el radicado');
  });

  it('pinta un caso del móvil sin los datos de la póliza que no guardó', async () => {
    await renderizar(CASO_MOVIL);

    expect(screen.getByText(/^Hurto · AU-2025-118204 · Radicado el/)).toBeTruthy();
    expect(screen.getByText('AU-2025-118204', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByText('0 de 0 obligatorios · 0 archivos')).toBeTruthy();
  });
});
