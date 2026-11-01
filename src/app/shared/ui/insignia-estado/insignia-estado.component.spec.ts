import { render, screen } from '@testing-library/angular';

import { InsigniaEstadoComponent } from './insignia-estado.component';

describe('InsigniaEstadoComponent', () => {
  it('muestra el texto recibido y aplica el tono', async () => {
    const { container } = await render(
      `<app-insignia-estado tono="exito">Listo</app-insignia-estado>`,
      { imports: [InsigniaEstadoComponent] },
    );

    expect(screen.getByText('Listo')).toBeTruthy();
    expect(container.querySelector('app-insignia-estado')?.classList).toContain('insignia--exito');
  });

  it('usa el tono neutro por defecto y oculta el punto a los lectores de pantalla', async () => {
    const { container } = await render(`<app-insignia-estado>Pendiente</app-insignia-estado>`, {
      imports: [InsigniaEstadoComponent],
    });

    expect(container.querySelector('app-insignia-estado')?.classList).toContain('insignia--neutro');
    expect(container.querySelector('.insignia__punto')?.getAttribute('aria-hidden')).toBe('true');
  });
});
