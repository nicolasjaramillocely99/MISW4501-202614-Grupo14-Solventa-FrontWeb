import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CambioDatosPersonalesComponent } from './cambio-datos-personales.component';

const ACTUAL = { direccion: null, correo: 'carolina@example.com', telefono: null };

describe('CambioDatosPersonalesComponent (HU-W1.4-01 · D-5)', () => {
  it('captura dirección, teléfono y el correo de contacto de la póliza', async () => {
    const { fixture } = await render(CambioDatosPersonalesComponent, { imports: [proveerTranslocoPruebas()], inputs: { actual: ACTUAL } });

    expect(screen.getByText('Es el correo de los avisos de la póliza; tu usuario no cambia')).toBeTruthy();
    expect((screen.getByLabelText('Correo de contacto de la póliza') as HTMLInputElement).placeholder).toBe('carolina@example.com');
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).placeholder).toBe('no registrada');

    await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 45 # 12-30');
    await userEvent.type(screen.getByLabelText('Teléfono'), '3012345678');

    expect(fixture.componentInstance.captura()).toEqual({ direccion: 'Calle 45 # 12-30', correo: '', telefono: '3012345678' });
  });

  it('muestra el error de cada campo tocado y el del grupo al intentar radicar', async () => {
    const { fixture } = await render(CambioDatosPersonalesComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { actual: ACTUAL, errores: [{ campo: 'personal_data.phone', codigo: 'invalid_format' }] },
    });

    await userEvent.type(screen.getByLabelText('Teléfono'), '300');
    await userEvent.tab();
    expect(screen.getByText('El teléfono lleva 10 dígitos.')).toBeTruthy();

    fixture.componentRef.setInput('errores', [{ campo: 'personal_data', codigo: 'required' }]);
    fixture.componentRef.setInput('mostrarTodos', true);
    fixture.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('Escribe al menos un dato nuevo.');
  });
});
