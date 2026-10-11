import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { MENU_POR_ROL } from '@core/navegacion/menu-por-rol';

import { CentroOperacionesComponent } from './centro-operaciones.component';

describe('CentroOperacionesComponent', () => {
  it('muestra el encabezado del rol y sus accesos rápidos', async () => {
    await render(CentroOperacionesComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { accesos: MENU_POR_ROL.operaciones.slice(1) },
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Centro de operaciones' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(MENU_POR_ROL.operaciones.length - 1);
  });
});
