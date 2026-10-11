import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ACCESO_ROUTES } from './acceso.routes';
import { SesionExpiradaPage } from './sesion-expirada.page';

describe('SesionExpiradaPage', () => {
  it('explica que la sesión expiró y lleva a iniciar sesión de nuevo', async () => {
    await render(SesionExpiradaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Tu sesión expiró' })).toBeTruthy();
    expect(screen.getByText(/Por seguridad cerramos tu sesión/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión de nuevo' }).getAttribute('href'),
    ).toBe('/acceso/iniciar-sesion');
  });

  it('se muestra en inglés con el diccionario en-US', async () => {
    await render(SesionExpiradaPage, {
      imports: [proveerTranslocoPruebas({ translocoConfig: { defaultLang: 'en-US' } })],
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Your session expired' })).toBeTruthy();
  });
});

describe('ACCESO_ROUTES', () => {
  it('declara las tres pantallas de acceso y redirige la raíz al inicio de sesión', () => {
    expect(ACCESO_ROUTES.map((ruta) => ruta.path)).toEqual([
      '',
      'iniciar-sesion',
      'no-autorizado',
      'sesion-expirada',
    ]);
    expect(ACCESO_ROUTES[0].redirectTo).toBe('iniciar-sesion');
  });
});
