import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import { PAGINA_SINIESTROS_DTO } from '@testing/siniestros-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { mapearPaginaSiniestros } from '@core/api/siniestros/siniestro.modelos';

import { TablaSiniestrosComponent } from './tabla-siniestros.component';

const CASOS = mapearPaginaSiniestros(PAGINA_SINIESTROS_DTO).items;

describe('TablaSiniestrosComponent (A7 mínima · HU-W2.1-01)', () => {
  beforeEach(async () => {
    await render(TablaSiniestrosComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { casos: CASOS },
    });
  });

  it('tiene encabezados de columna y un nombre accesible', () => {
    const tabla = screen.getByRole('table', { name: 'Siniestros radicados' });
    expect(within(tabla).getAllByRole('columnheader').map((celda) => celda.textContent?.trim())).toEqual([
      'Radicado',
      'Póliza y tipo',
      'Fecha del hecho',
      'Etapa',
      'Radicado el',
      'Acciones',
    ]);
  });

  it('muestra el caso web con su ramo, tipo corto, póliza, objeto y etapa (CA-6)', () => {
    const fila = screen.getByRole('rowheader', { name: 'SIN-2026-01712' }).closest('tr') as HTMLElement;

    expect(within(fila).getByText('Autos · Colisión')).toBeTruthy();
    expect(within(fila).getByText('AU-2025-118204 · KJT-482')).toBeTruthy();
    expect(within(fila).getByText('Radicado')).toBeTruthy();
    expect(within(fila).getAllByText(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/)).toHaveLength(2);
  });

  it('muestra el caso del móvil sin ramo y con «Radicado desde la app»', () => {
    const fila = screen.getByRole('rowheader', { name: 'SIN-2026-01655' }).closest('tr') as HTMLElement;

    expect(within(fila).getByText('Hurto')).toBeTruthy();
    expect(within(fila).getByText('AU-2025-118204 · Radicado desde la app')).toBeTruthy();
  });

  it('«Ver detalle» lleva al detalle del caso y su nombre accesible incluye el radicado (HU-W2.2-01)', () => {
    const enlace = screen.getByRole('link', { name: 'Ver detalle del siniestro SIN-2026-01712' });

    expect(enlace.textContent?.trim()).toBe('Ver detalle');
    expect(enlace.getAttribute('href')).toBe('/siniestros/8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90');
    expect(screen.getAllByRole('link', { name: /^Ver detalle del siniestro/ })).toHaveLength(2);
  });
});
