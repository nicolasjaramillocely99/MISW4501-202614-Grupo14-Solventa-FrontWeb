import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { MENU_POR_ROL } from '@core/navegacion/menu-por-rol';

import { InicioAseguradoComponent } from './inicio-asegurado.component';

describe('InicioAseguradoComponent', () => {
  it('muestra el encabezado del rol y sus accesos rápidos', async () => {
    await render(InicioAseguradoComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { nombre: 'Carolina', accesos: MENU_POR_ROL.asegurado.slice(1) },
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Carolina' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(MENU_POR_ROL.asegurado.length - 1);
  });
});
