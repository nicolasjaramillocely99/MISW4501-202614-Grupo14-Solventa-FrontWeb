import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { TipoCambioComponent } from './tipo-cambio.component';

describe('TipoCambioComponent (HU-W1.4-01 · CA-1)', () => {
  it('ofrece los tres tipos de cambio y enlaza el elegido', async () => {
    const { fixture } = await render(TipoCambioComponent, { imports: [proveerTranslocoPruebas()], providers: [provideRouter([])] });

    expect(screen.getByRole('group', { name: 'Tipo de cambio' })).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /Sumas aseguradas/ }));

    expect(fixture.componentInstance.seleccionado()).toBe('insured_amount');
    expect(screen.getByText('Dirección, correo o teléfono')).toBeTruthy();
  });

  it('bloquea el tipo con una solicitud abierta y enlaza a ella (D-6)', async () => {
    await render(TipoCambioComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { abiertas: [{ solicitudId: 'SOL-MOD-2026-0042', tipo: 'beneficiaries', estadoGuardado: 'filed', radicadaEn: '2026-09-16T20:10:00Z' }] },
    });

    expect((screen.getByRole('radio', { name: /Beneficiarios/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Ya tienes la solicitud SOL-MOD-2026-0042 en curso/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver solicitud' }).getAttribute('href')).toBe('/originacion/solicitudes/SOL-MOD-2026-0042');
    expect((screen.getByRole('radio', { name: /Datos personales/ }) as HTMLInputElement).disabled).toBe(false);
  });
});
