import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { TarjetaCreditoComponent } from './tarjeta-credito.component';

describe('TarjetaCreditoComponent', () => {
  it('muestra el banco, el monto, el plazo y la cuota con la moneda formateada', async () => {
    await render(TarjetaCreditoComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: {
        solicitud: {
          numero: '48213',
          aliado: 'Banco Aliado',
          banco: 'Banco Aliado',
          montoAprobado: 250000000,
          plazoAnios: 20,
          cuotaEstimada: 2180000,
          moneda: 'COP',
        },
      },
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Tu crédito' })).toBeTruthy();
    expect(screen.getByText('Banco Aliado')).toBeTruthy();
    expect(screen.getByText(/250\.000\.000 COP/)).toBeTruthy();
    expect(screen.getByText('20 años')).toBeTruthy();
    expect(screen.getByText(/2\.180\.000 COP \/ mes/)).toBeTruthy();
  });
});
