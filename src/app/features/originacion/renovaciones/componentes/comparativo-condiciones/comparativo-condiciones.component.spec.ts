import { render, screen, within } from '@testing-library/angular';
import { RECOTIZACION_DTO } from '@testing/renovacion-asistida-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { RecotizacionRenovacion, mapearRecotizacion } from '@core/api/originacion/renovacion-asistida.modelos';

import { ComparativoCondicionesComponent } from './comparativo-condiciones.component';

const RECOTIZACION = mapearRecotizacion(RECOTIZACION_DTO);

async function renderizar(recotizacion: RecotizacionRenovacion | null) {
  return render(ComparativoCondicionesComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { vigente: RECOTIZACION.vigente, recotizacion },
  });
}

function fila(nombre: string): HTMLElement {
  return screen.getByRole('rowheader', { name: nombre }).closest('tr') as HTMLElement;
}

describe('ComparativoCondicionesComponent (HU-W1.5-03 · CA-1)', () => {
  it('muestra la vigencia actual junto a la recotizada, con la variación de la prima', async () => {
    await renderizar(RECOTIZACION);

    expect(screen.getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual(['Condición', 'Vigencia actual', 'Recotizada']);
    const prima = within(fila('Prima mensual')).getAllByRole('cell');
    expect(prima[0].textContent).toMatch(/142\.300 COP/);
    expect(prima[1].textContent).toMatch(/149\.800 COP \(\+5,3\s?%\)/);
    expect(within(fila('Vigencia')).getAllByRole('cell')[1].textContent).toContain('02/10/2026 → 02/10/2027');
    expect(within(fila('Valor asegurado')).getAllByRole('cell')[1].textContent).toMatch(/68\.000\.000 COP/);
    expect(within(fila('Descuento por buena experiencia')).getAllByRole('cell')[1].textContent).toMatch(/8\s?% · sin siniestros en 12 meses/);
    expect(within(fila('Coberturas')).getAllByRole('cell')[1].textContent?.trim()).toBe('Sin cambios');
    expect(within(fila('Coberturas')).getAllByRole('cell')[0].textContent).toContain('Fallecimiento, Incapacidad total y permanente');
  });

  it('nombra las coberturas renovadas cuando cambian y dice si no hay descuento', async () => {
    await renderizar({
      ...RECOTIZACION,
      descuento: 0,
      renovada: { ...RECOTIZACION.renovada, coberturas: [{ codigo: 'death', valorAsegurado: 68000000 }] },
    });

    expect(within(fila('Coberturas')).getAllByRole('cell')[1].textContent?.trim()).toBe('Fallecimiento');
    expect(within(fila('Descuento por buena experiencia')).getAllByRole('cell')[1].textContent?.trim()).toBe('Sin descuento');
  });

  it('sin recotización la columna recotizada muestra «—»', async () => {
    await renderizar(null);

    for (const nombre of ['Prima mensual', 'Vigencia', 'Valor asegurado', 'Descuento por buena experiencia', 'Coberturas']) {
      expect(within(fila(nombre)).getAllByRole('cell')[1].textContent?.trim()).toBe('—');
    }
  });
});
