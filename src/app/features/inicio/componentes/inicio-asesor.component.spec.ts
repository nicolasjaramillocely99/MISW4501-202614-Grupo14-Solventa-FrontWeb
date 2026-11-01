import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { MENU_POR_ROL } from '@core/navegacion/menu-por-rol';

import { InicioAsesorComponent } from './inicio-asesor.component';

describe('InicioAsesorComponent', () => {
  it('muestra el encabezado del rol y sus accesos rápidos', async () => {
    await render(InicioAsesorComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { nombre: 'Laura', accesos: MENU_POR_ROL.asesor.slice(1) },
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Laura' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(MENU_POR_ROL.asesor.length - 1);
  });
});
