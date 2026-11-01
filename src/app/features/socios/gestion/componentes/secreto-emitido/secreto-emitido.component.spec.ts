import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { simularDialogoNativo } from '@testing/dialogo-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { SecretoEmitidoComponent } from './secreto-emitido.component';

describe('SecretoEmitidoComponent (HU-W3.1-01 CA-4)', () => {
  beforeAll(() => simularDialogoNativo());

  async function renderizar(portapapeles: { writeText: (texto: string) => Promise<void> } | undefined) {
    Object.defineProperty(navigator, 'clipboard', { value: portapapeles, configurable: true });
    const cerrado = vi.fn();
    const { fixture } = await render(SecretoEmitidoComponent, {
      imports: [proveerTranslocoPruebas()],
      on: { cerrado },
    });
    fixture.componentInstance.mostrar({ clientId: 'sol_1', clientSecret: 'SECRETO-1234', cabecera: 'x-api-key' });
    fixture.detectChanges();
    return { cerrado };
  }

  it('copia el client ID y el secreto y lo anuncia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await renderizar({ writeText });

    await userEvent.click(screen.getByRole('button', { name: 'Copiar secreto' }));
    expect(writeText).toHaveBeenCalledWith('SECRETO-1234');
    expect(await screen.findByText('Secreto copiado.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Copiar client ID' }));
    expect(writeText).toHaveBeenCalledWith('sol_1');
    expect(screen.getByText(/cabecera x-api-key/)).toBeTruthy();
  });

  it('si no se puede copiar, pide copiarlo a mano; al confirmar lo olvida', async () => {
    const { cerrado } = await renderizar({ writeText: vi.fn().mockRejectedValue(new Error('denegado')) });

    await userEvent.click(screen.getByRole('button', { name: 'Copiar secreto' }));
    expect(await screen.findByText(/cópielo manualmente/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Ya guardé el secreto' }));
    expect(screen.queryByText('SECRETO-1234')).toBeNull();
    expect(cerrado).toHaveBeenCalled();
  });

  it('sin portapapeles también lo avisa', async () => {
    await renderizar(undefined);

    await userEvent.click(screen.getByRole('button', { name: 'Copiar client ID' }));

    expect(await screen.findByText(/cópielo manualmente/)).toBeTruthy();
  });
});
