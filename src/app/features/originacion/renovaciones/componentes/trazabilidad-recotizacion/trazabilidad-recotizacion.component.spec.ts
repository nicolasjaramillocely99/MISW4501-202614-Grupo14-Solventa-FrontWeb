import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RECOTIZACION_BASE_DTO, RECOTIZACION_CACHE_DTO, RECOTIZACION_DTO } from '@testing/renovacion-asistida-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { RecotizacionRenovacion, mapearRecotizacion } from '@core/api/originacion/renovacion-asistida.modelos';

import { MotivoPendiente, TrazabilidadRecotizacionComponent } from './trazabilidad-recotizacion.component';

async function renderizar(recotizacion: RecotizacionRenovacion | null, extra: { trazabilidad?: boolean; pendiente?: MotivoPendiente | null } = {}) {
  return render(TrazabilidadRecotizacionComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { recotizacion, ...extra },
  });
}

function filas(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

describe('TrazabilidadRecotizacionComponent (HU-W1.5-03 · CA-1, CA-5)', () => {
  it('muestra cada fuente con su latencia, el motor con su versión y la nota general', async () => {
    await renderizar(mapearRecotizacion(RECOTIZACION_DTO));

    expect(screen.getByRole('heading', { name: 'Recotización' })).toBeTruthy();
    const [openFinance, openData, kyc, motor] = filas();
    expect(openFinance.textContent).toContain('Open Finance');
    expect(openFinance.textContent).toContain('Consultado · 96 ms');
    expect(openFinance.textContent).toContain('Operativo');
    expect(openData.textContent).toContain('88 ms');
    expect(kyc.textContent).toContain('KYC');
    expect(motor.textContent).toContain('Versión v1 · edad, riesgo y plazo');
    expect(motor.textContent).toContain('Aplicado');
    expect(screen.getByText(/Si Open Finance no responde, la recotización usa el último perfil en caché/)).toBeTruthy();
  });

  it('deja ver los factores del motor', async () => {
    await renderizar(mapearRecotizacion(RECOTIZACION_DTO));

    await userEvent.click(screen.getByText('Ver factores del motor'));

    expect(screen.getByText('Tasa mensual base')).toBeTruthy();
    expect(screen.getByText('Redondeo')).toBeTruthy();
  });

  it('en modo degradado marca la fuente «No disponible» y da la fecha del perfil en caché', async () => {
    await renderizar(mapearRecotizacion(RECOTIZACION_CACHE_DTO));

    const openFinance = filas()[0];
    expect(openFinance.textContent).toContain('No disponible');
    expect(openFinance.textContent).toContain('Sin respuesta · corte a los 120 ms');
    expect(screen.getByText(/Perfil en caché del 27\/08\/2026 \(dentro de los 30 días\)/)).toBeTruthy();
  });

  it('con el perfil actuarial base lo dice', async () => {
    await renderizar(mapearRecotizacion(RECOTIZACION_BASE_DTO));

    expect(screen.getByText(/No hay un perfil reciente en caché: se usó el perfil actuarial base/)).toBeTruthy();
  });

  it('cuando el motor no tarifó, repite las condiciones vigentes sin aplicar', async () => {
    await renderizar({ ...mapearRecotizacion(RECOTIZACION_DTO), recotizada: false, factores: [], versionMotor: null });

    const motor = filas().at(-1)!;
    expect(motor.textContent).toContain('No se pudo tarifar');
    expect(motor.textContent).toContain('Sin aplicar');
    expect(screen.queryByText('Ver factores del motor')).toBeNull();
  });

  it('sin recotización muestra las fuentes pendientes, o sin autorización', async () => {
    const { rerender } = await renderizar(null, { pendiente: 'autorizacion' });
    expect(filas()[0].textContent).toContain('Pendiente de la autorización');

    await rerender({ inputs: { recotizacion: null, pendiente: 'sinAutorizacion' } });
    expect(filas()[0].textContent).toContain('No consultado');
    expect(filas()[0].textContent).toContain('Sin autorización');

    await rerender({ inputs: { recotizacion: null, pendiente: 'sinVerificar' } });
    expect(filas()[0].textContent).toContain('No consultado');
    expect(filas()[0].textContent).toContain('Sin verificar');

    await rerender({ inputs: { recotizacion: null, pendiente: null } });
    expect(filas()[0].textContent).toContain('Se consulta al recotizar');
  });

  it('en S7b se titula «Trazabilidad de la recotización»', async () => {
    await renderizar(mapearRecotizacion(RECOTIZACION_DTO), { trazabilidad: true });

    expect(screen.getByRole('heading', { name: 'Trazabilidad de la recotización' })).toBeTruthy();
  });
});
