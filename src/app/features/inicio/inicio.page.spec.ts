import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import { iniciarSesionComo, proveerSesionPrueba } from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ROLES, Rol } from '@core/auth/modelos/rol';

import { INICIO_ROUTES } from './inicio.routes';
import { InicioPage } from './inicio.page';

describe('InicioPage (/inicio)', () => {
  async function renderizar(rol: Rol) {
    const resultado = await render(InicioPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), ...proveerSesionPrueba()],
    });
    await iniciarSesionComo(rol);
    await resultado.fixture.whenStable();
  }

  afterEach(() => sessionStorage.clear());

  function accesos(): string[] {
    const tarjeta = screen.getByRole('region', { name: 'Accesos rápidos' });
    return within(tarjeta)
      .getAllByRole('link')
      .map((enlace) => enlace.textContent?.trim() ?? '');
  }

  it.each<[Rol, string, string, string[]]>([
    [
      'asegurado',
      'Hola, Carolina',
      'Resumen de tus seguros, pagos y trámites en curso',
      ['Mis pólizas', 'Mis siniestros', 'Mis solicitudes', 'Mi perfil'],
    ],
    [
      'asesor',
      'Hola, Laura',
      'Tu jornada comercial en un vistazo',
      ['Cotizaciones', 'Bandeja de decisión', 'Renovaciones', 'Siniestros'],
    ],
    [
      'operaciones',
      'Centro de operaciones',
      'Excepciones y colas que requieren atención',
      ['Emisiones', 'Endosos', 'Siniestros', 'Asistencias', 'Socios', 'Auditoría', 'Consentimientos'],
    ],
    [
      'socio',
      'Hola, Banco',
      'Tu integración con Solventa: credenciales y desempeño técnico',
      ['Tablero', 'Desempeño técnico', 'Credenciales'],
    ],
  ])('muestra el inicio del rol %s', async (rol, titulo, subtitulo, enlaces) => {
    await renderizar(rol);

    expect(screen.getByRole('heading', { level: 1 }).textContent?.trim()).toBe(titulo);
    expect(screen.getByText(subtitulo)).toBeTruthy();
    expect(accesos()).toEqual(enlaces);
  });

  it('sin sesión no muestra contenido', async () => {
    await render(InicioPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), ...proveerSesionPrueba()],
    });

    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('la ruta admite los cuatro roles humanos', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...proveerSesionPrueba()] });
    const guard = INICIO_ROUTES[0].canActivate?.[0] as CanActivateFn;

    expect(INICIO_ROUTES[0].component).toBe(InicioPage);
    for (const rol of ROLES) {
      await iniciarSesionComo(rol);
      expect(
        TestBed.runInInjectionContext(() =>
          guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
        ),
      ).toBe(true);
    }
  });
});
