import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { iniciarSesionComo, proveerSesionPrueba } from '@testing/sesion-pruebas';

import { Rol } from '../modelos/rol';
import { rolGuard } from './rol.guard';

describe('rolGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...proveerSesionPrueba()] });
  });

  afterEach(() => sessionStorage.clear());

  function ejecutar(...roles: Rol[]) {
    return TestBed.runInInjectionContext(() =>
      rolGuard(...roles)({} as ActivatedRouteSnapshot, { url: '/x' } as RouterStateSnapshot),
    );
  }

  function serializar(resultado: unknown): string {
    expect(resultado).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  it('deja pasar al rol permitido', async () => {
    await iniciarSesionComo('operaciones');

    expect(ejecutar('asesor', 'operaciones')).toBe(true);
  });

  it.each<[Rol, Rol[]]>([
    ['asegurado', ['asesor', 'operaciones']],
    ['asesor', ['operaciones']],
    ['socio', ['asegurado', 'asesor', 'operaciones']],
    ['operaciones', ['socio']],
  ])('con el rol %s, una ruta de %j lleva a acceso no autorizado', async (rol, permitidos) => {
    await iniciarSesionComo(rol);

    expect(serializar(ejecutar(...permitidos))).toBe('/acceso/no-autorizado');
  });

  it('sin sesión lleva al inicio de sesión', () => {
    expect(serializar(ejecutar('asesor'))).toBe('/acceso/iniciar-sesion');
  });
});
