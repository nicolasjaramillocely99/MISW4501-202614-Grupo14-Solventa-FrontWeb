import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { MENU_POR_ROL } from '@core/navegacion/menu-por-rol';

import { AccesosRapidosComponent } from './accesos-rapidos.component';

describe('AccesosRapidosComponent', () => {
  it('enlaza cada acceso a la ruta de su pantalla', async () => {
    await render(AccesosRapidosComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { accesos: MENU_POR_ROL.socio },
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Accesos rápidos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Credenciales' }).getAttribute('href')).toBe(
      '/socios/credenciales',
    );
  });
});
