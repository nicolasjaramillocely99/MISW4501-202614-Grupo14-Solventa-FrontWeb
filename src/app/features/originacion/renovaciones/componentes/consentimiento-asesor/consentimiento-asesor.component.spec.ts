import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ConsentimientoAsesorComponent } from './consentimiento-asesor.component';

describe('ConsentimientoAsesorComponent (HU-W1.5-03 · D-13 c)', () => {
  it('pide la casilla y la enlaza con la página', async () => {
    const cambios: boolean[] = [];
    const { fixture } = await render(ConsentimientoAsesorComponent, { imports: [proveerTranslocoPruebas()] });
    fixture.componentInstance.afirmado.subscribe((v) => cambios.push(v));

    expect(screen.getByText('Póliza vendida por un asesor')).toBeTruthy();
    const casilla = screen.getByRole('checkbox', { name: /El cliente autorizó consultar sus datos financieros/ }) as HTMLInputElement;
    expect(casilla.checked).toBe(false);

    await userEvent.click(casilla);

    expect(cambios).toEqual([true]);
    expect(fixture.componentInstance.afirmado()).toBe(true);
  });

  it('muestra el error del 422 mientras la casilla no esté marcada', async () => {
    const { fixture } = await render(ConsentimientoAsesorComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { conError: true },
    });

    const casilla = screen.getByRole('checkbox');
    expect(casilla.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('sin la autorización del cliente no se consulta ningún dato');

    fixture.componentInstance.afirmado.set(true);
    fixture.detectChanges();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('se deshabilita mientras se recotiza', async () => {
    await render(ConsentimientoAsesorComponent, { imports: [proveerTranslocoPruebas()], inputs: { deshabilitado: true } });

    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('en S7b dice quién afirmó el consentimiento y cuándo, en solo lectura', async () => {
    await render(ConsentimientoAsesorComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { soloLectura: { asesor: 'Laura Gómez', fecha: '2026-09-16T21:02:00Z' } },
    });

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(/Consentimiento afirmado por Laura Gómez el/)).toBeTruthy();
  });
});
