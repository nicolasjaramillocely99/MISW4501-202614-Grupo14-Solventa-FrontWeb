import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import {
  ProveedorIdentidadFalso,
  crearProveedorIdentidadFalso,
  crearTokensPrueba,
  iniciarSesionComo,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';

import { ErrorIdentidad } from '../proveedor-identidad';
import { CLAVE_RENOVACION } from '../sesion.service';
import { autenticacionGuard } from './autenticacion.guard';

describe('autenticacionGuard', () => {
  let proveedor: ProveedorIdentidadFalso;

  beforeEach(() => {
    sessionStorage.clear();
    proveedor = crearProveedorIdentidadFalso();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...proveerSesionPrueba(proveedor)],
    });
  });

  afterEach(() => sessionStorage.clear());

  function ejecutar(url = '/inicio') {
    return TestBed.runInInjectionContext(() =>
      autenticacionGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  function serializar(resultado: unknown): string {
    expect(resultado).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(resultado as UrlTree);
  }

  it('deja pasar con una sesión activa', async () => {
    await iniciarSesionComo('asesor');

    expect(await ejecutar()).toBe(true);
  });

  it('recupera la sesión tras recargar la página con el token de renovación', async () => {
    sessionStorage.setItem(CLAVE_RENOVACION, 'renovacion');
    proveedor.refrescar.mockResolvedValue(crearTokensPrueba('operaciones'));

    expect(await ejecutar()).toBe(true);
  });

  it('sin sesión lleva al inicio de sesión con la URL pedida', async () => {
    expect(serializar(await ejecutar('/inicio?x=1'))).toBe(
      '/acceso/iniciar-sesion?returnUrl=%2Finicio%3Fx%3D1',
    );
  });

  it('si la sesión venció sin poder renovarse lleva a sesión expirada', async () => {
    sessionStorage.setItem(CLAVE_RENOVACION, 'revocado');
    proveedor.refrescar.mockRejectedValue(new ErrorIdentidad('sesion-invalida'));

    expect(serializar(await ejecutar())).toBe('/acceso/sesion-expirada');
  });
});
