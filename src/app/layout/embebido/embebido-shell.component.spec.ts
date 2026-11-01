import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';

import { EmbebidoShellComponent } from './embebido-shell.component';

describe('EmbebidoShellComponent', () => {
  async function renderizar(aliado: string | null) {
    const resultado = await render(EmbebidoShellComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
    });
    resultado.fixture.debugElement.injector.get(ContextoAliadoService).establecer(aliado);
    resultado.fixture.detectChanges();
    return resultado;
  }

  it('muestra el aliado, «Protegido por Solventa» y un único main', async () => {
    await renderizar('Banco Aliado');

    expect(screen.getByRole('banner').textContent).toContain('Banco Aliado');
    expect(screen.getByRole('banner').textContent).toContain('Protegido por');
    expect(screen.getByRole('banner').textContent).toContain('Solventa');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('rotula el aliado de forma genérica mientras no se conoce', async () => {
    await renderizar(null);

    expect(screen.getByRole('banner').textContent).toContain('Aliado');
  });
});
