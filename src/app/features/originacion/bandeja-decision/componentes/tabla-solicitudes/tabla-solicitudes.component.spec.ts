import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import { SOLICITUD_AJUSTADA_DTO, SOLICITUD_PENDIENTE_DTO, SOLICITUD_RECHAZADA_DTO } from '@testing/revision-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { EstadoSolicitudRevision, SolicitudRevision, mapearSolicitudRevision } from '@core/api/originacion/revision.modelos';

import { TablaSolicitudesComponent } from './tabla-solicitudes.component';

const PENDIENTE = mapearSolicitudRevision(SOLICITUD_PENDIENTE_DTO);

async function renderizar(solicitudes: readonly SolicitudRevision[], estado: EstadoSolicitudRevision) {
  return render(TablaSolicitudesComponent, {
    imports: [proveerTranslocoPruebas()],
    providers: [provideRouter([])],
    inputs: { solicitudes, estado },
  });
}

describe('TablaSolicitudesComponent (S4 · HU-W1.1-02)', () => {
  it('muestra cada solicitud pendiente con solicitante, oferta, motivo, llegada y «Revisar» (CA-1)', async () => {
    await renderizar([PENDIENTE], 'pending');

    const tabla = screen.getByRole('table', { name: 'Solicitudes pendientes de decisión' });
    const encabezados = within(tabla).getAllByRole('columnheader').map((c) => c.textContent?.trim());
    expect(encabezados).toEqual(['Solicitud', 'Solicitante', 'Oferta', 'Motivo del enrutamiento', 'Llegada', 'Acciones']);

    const fila = within(tabla).getAllByRole('row')[1];
    expect(within(fila).getByText(PENDIENTE.aceptacionId)).toBeTruthy();
    expect(within(fila).getByText('Carolina Pérez Ruiz')).toBeTruthy();
    expect(within(fila).getByText('CC 1020345678')).toBeTruthy();
    expect(within(fila).getByText('demo-review-1792212135')).toBeTruthy();
    expect(within(fila).getByText(/89\.500 COP \/ mes/)).toBeTruthy();
    expect(within(fila).getByText('Perfil provisional (fuente caída)')).toBeTruthy();
    expect(within(fila).getByText(/2026/)).toBeTruthy();
    const enlace = within(fila).getByRole('link', { name: `Revisar la solicitud ${PENDIENTE.aceptacionId}` });
    expect(enlace.getAttribute('href')).toBe(`/originacion/bandeja-decision/${PENDIENTE.aceptacionId}`);
  });

  it('en «Decididas» agrega la decisión, el asesor y la fecha (CA-4)', async () => {
    await renderizar([mapearSolicitudRevision(SOLICITUD_AJUSTADA_DTO), mapearSolicitudRevision(SOLICITUD_RECHAZADA_DTO)], 'decided');

    const tabla = screen.getByRole('table', { name: 'Solicitudes decididas' });
    expect(within(tabla).getByRole('columnheader', { name: 'Decisión' })).toBeTruthy();
    expect(within(tabla).getByRole('columnheader', { name: 'Asesor' })).toBeTruthy();
    expect(within(tabla).getByRole('columnheader', { name: 'Decidida' })).toBeTruthy();
    expect(within(tabla).getByText('Ajustada')).toBeTruthy();
    expect(within(tabla).getByText('Rechazada')).toBeTruthy();
    expect(within(tabla).getByText('Puntaje de riesgo alto')).toBeTruthy();
    expect(within(tabla).getAllByText('asesor@example.com')).toHaveLength(2);
    expect(within(tabla).getAllByRole('link', { name: /^Ver detalle de la solicitud/ })).toHaveLength(2);
  });

  it('un motivo que la web no conoce se muestra con el texto genérico', async () => {
    await renderizar([{ ...PENDIENTE, motivo: 'motivo_nuevo_del_motor' }], 'pending');

    expect(screen.getByText('Validación adicional de suscripción')).toBeTruthy();
    expect(screen.queryByText(/bandejaDecision\.motivos/)).toBeNull();
  });
});
