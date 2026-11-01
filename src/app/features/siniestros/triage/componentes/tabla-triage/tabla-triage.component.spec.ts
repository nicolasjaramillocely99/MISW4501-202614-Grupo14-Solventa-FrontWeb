import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import { ID_CASO_INEXISTENTE, ID_CASO_TRIAGE, ID_CASO_TRIAGE_2, LOTE_TRIAGE_DTO } from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ResumenTriage, mapearPaginaTriage } from '@core/api/siniestros/triage.modelos';

import { TablaTriageComponent } from './tabla-triage.component';

const FILAS = mapearPaginaTriage(LOTE_TRIAGE_DTO);

describe('TablaTriageComponent (O5 · HU-W2.2-01, CA-4 y CA-5)', () => {
  function renderizar(filas: readonly ResumenTriage[], parametrosEnlace: Record<string, string> | null = null) {
    return render(TablaTriageComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { filas, parametrosEnlace },
    });
  }

  it('tiene encabezados de columna y un nombre accesible', async () => {
    await renderizar(FILAS);

    const tabla = screen.getByRole('table', { name: 'Prioridad de los siniestros consultados' });
    expect(within(tabla).getAllByRole('columnheader').map((celda) => celda.textContent?.trim())).toEqual([
      'Caso',
      'Prioridad',
      'Severidad',
      'Rango de monto',
      'Objetivo',
      'Calculada el',
      'Acciones',
    ]);
  });

  it('pinta el nivel con su texto, severidad, rango de monto y objetivo de cada caso asignado', async () => {
    await renderizar(FILAS);

    const fila = screen.getByRole('rowheader', { name: ID_CASO_TRIAGE }).closest('tr') as HTMLElement;
    expect(within(fila).getByText('Triage 1')).toBeTruthy();
    expect(within(fila).getByText('media')).toBeTruthy();
    expect(within(fila).getByText('monto alto')).toBeTruthy();
    expect(within(fila).getByText('Atención inmediata')).toBeTruthy();
    expect(within(fila).getByText(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/)).toBeTruthy();
    const otra = screen.getByRole('rowheader', { name: ID_CASO_TRIAGE_2 }).closest('tr') as HTMLElement;
    expect(within(otra).getByText('sin monto declarado')).toBeTruthy();
  });

  it('«Ver prioridad» lleva al detalle del caso y conserva los parámetros de la búsqueda', async () => {
    await renderizar(FILAS, { casos: `${ID_CASO_TRIAGE},${ID_CASO_TRIAGE_2}` });

    const enlace = screen.getByRole('link', { name: `Ver prioridad del caso ${ID_CASO_TRIAGE}` });

    expect(enlace.getAttribute('href')).toBe(`/siniestros/cola/${ID_CASO_TRIAGE}?casos=${ID_CASO_TRIAGE},${ID_CASO_TRIAGE_2}`);
  });

  it('omite la fila del caso que no existe', async () => {
    await renderizar(FILAS);

    expect(screen.queryByRole('rowheader', { name: ID_CASO_INEXISTENTE })).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('un caso pending se pinta «Calculando prioridad…» y sin enlace', async () => {
    await renderizar([
      { siniestroId: 'p', estado: 'pending', nivel: null, severidad: null, banda: null, objetivo: null, evaluadoEn: null },
    ]);

    expect(screen.getByText('Calculando prioridad…')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('un caso not_applicable se pinta «Sin prioridad (no está en evaluación)»', async () => {
    await renderizar([
      { siniestroId: 'n', estado: 'not_applicable', nivel: null, severidad: null, banda: null, objetivo: null, evaluadoEn: null },
    ]);

    expect(screen.getByText('Sin prioridad (no está en evaluación)')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('un código de severidad o de banda que no conoce se muestra crudo', async () => {
    await renderizar([
      {
        siniestroId: 'x',
        estado: 'assessed',
        nivel: 2,
        severidad: 'critical' as never,
        banda: 'huge' as never,
        objetivo: { tipo: 'business_days', diasHabiles: 5, diasResolucion: 5 },
        evaluadoEn: '2026-10-31T04:20:28Z',
      },
    ]);

    expect(screen.getByText('critical')).toBeTruthy();
    expect(screen.getByText('huge')).toBeTruthy();
  });
});
