import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CambioSumaAseguradaComponent } from './cambio-suma-asegurada.component';

const LIMITES = { valorMinimo: 10_000_000, valorMaximo: 2_000_000_000 };

describe('CambioSumaAseguradaComponent (HU-W1.4-01)', () => {
  it('muestra el valor actual, los límites y enlaza el nuevo', async () => {
    const { fixture } = await render(CambioSumaAseguradaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { actual: 68_000_000, limites: LIMITES },
    });

    expect((screen.getByLabelText('Valor asegurado actual') as HTMLInputElement).value).toMatch(/68\.000\.000 COP/);
    expect(screen.getByText(/Entre .*10\.000\.000 COP y .*2\.000\.000\.000 COP/)).toBeTruthy();

    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '300.000.000');

    expect(fixture.componentInstance.texto()).toBe('300.000.000');
  });

  it('muestra el error del campo cuando ya se tocó', async () => {
    await render(CambioSumaAseguradaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { actual: 68_000_000, limites: LIMITES, errores: [{ campo: 'insured_amount', codigo: 'out_of_range' }] },
    });
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '5');
    await userEvent.tab();

    expect(screen.getByRole('alert').textContent).toMatch(/Debe estar entre .*10\.000\.000 COP y .*2\.000\.000\.000 COP/);
    expect(screen.getByLabelText('Nuevo valor asegurado (COP)').getAttribute('aria-invalid')).toBe('true');
  });
});
