import { render, screen, within } from '@testing-library/angular';
import {
  CANCELACION_EN_PROCESO_DTO,
  CANCELACION_NO_PROCESADA_DTO,
  CANCELACION_REEMBOLSADA_DTO,
  CANCELACION_SIN_REEMBOLSO_DTO,
} from '@testing/cancelacion-voluntaria-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CancelacionPolizaDto, CancelacionAPedido, mapearCancelacion } from '@core/api/originacion/pago-poliza.modelos';

import { DetalleCancelacionComponent } from './detalle-cancelacion.component';

// HU-W1.6-01: A5b · el reembolso registrado con la cancelación (CA-2) y su estado.

async function renderizar(dto: CancelacionPolizaDto) {
  return render(DetalleCancelacionComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { cancelacion: mapearCancelacion(dto) as CancelacionAPedido },
  });
}

describe('DetalleCancelacionComponent (A5b · HU-W1.6-01)', () => {
  it('muestra el reembolso con su monto, método, referencia, fecha y motivo (CA-2)', async () => {
    await renderizar(CANCELACION_EN_PROCESO_DTO);

    const detalle = within(screen.getByRole('region', { name: 'Detalle del reembolso' }));
    expect(detalle.getByText('Monto').nextElementSibling?.textContent).toContain('66.406 COP');
    expect(detalle.getByText('Método').nextElementSibling?.textContent).toContain('Visa •••• 1111');
    expect(detalle.getByText('Referencia').nextElementSibling?.textContent).toContain('REF-2026-00001');
    expect(detalle.getByText('Fecha de cancelación').nextElementSibling?.textContent).toMatch(/\d{2}\/\d{2}\/2026 · \d{2}:\d{2}/);
    expect(detalle.getByText('Motivo').nextElementSibling?.textContent).toContain('Pagué el crédito hipotecario');
    expect(detalle.getByText('En proceso', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('se está enviando a tu Visa •••• 1111');
    expect(screen.getByRole('region', { name: 'Estado de la póliza' }).textContent).toContain(
      'No disponible · requiere nueva póliza',
    );
    expect(screen.queryByText(/constancia|correo/i)).toBeNull();
  });

  it('dice si el reembolso se hizo, no se pudo procesar o no aplica', async () => {
    const { rerender } = await renderizar(CANCELACION_REEMBOLSADA_DTO);
    expect(screen.getByText('Reembolsado', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('5 a 10 días hábiles');

    await rerender({ inputs: { cancelacion: mapearCancelacion(CANCELACION_NO_PROCESADA_DTO) as CancelacionAPedido } });
    expect(screen.getByText('No se pudo procesar', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Conserva la referencia REF-2026-00001');

    await rerender({ inputs: { cancelacion: mapearCancelacion(CANCELACION_SIN_REEMBOLSO_DTO) as CancelacionAPedido } });
    expect(screen.getByText('Sin reembolso', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('no hay reembolso');
    expect(screen.getByText('Referencia').nextElementSibling?.textContent).toContain('No aplica');
  });
});
