import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  ProveedorIdentidadFalso,
  crearProveedorIdentidadFalso,
  iniciarSesionComo,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { Rol } from '@core/auth/modelos/rol';
import { SesionService } from '@core/auth/sesion.service';

import { NoAutorizadoPage } from './no-autorizado.page';

describe('NoAutorizadoPage (403)', () => {
  let proveedor: ProveedorIdentidadFalso;

  async function renderizar(rol: Rol | null) {
    proveedor = crearProveedorIdentidadFalso();
    const resultado = await render(NoAutorizadoPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), ...proveerSesionPrueba(proveedor)],
    });
    if (rol) {
      await iniciarSesionComo(rol);
      await resultado.fixture.whenStable();
    }
    return resultado;
  }

  afterEach(() => sessionStorage.clear());

  it('explica el 403 y ofrece volver al inicio y cerrar sesión', async () => {
    await renderizar('asegurado');

    expect(screen.getByRole('heading', { level: 1, name: 'Acceso no autorizado' })).toBeTruthy();
    expect(screen.getByText(/Tu rol no tiene permiso/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/inicio');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });

  it('cerrar sesión revoca el token y lleva al inicio de sesión', async () => {
    await renderizar('socio');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(proveedor.revocar).toHaveBeenCalledWith('renovacion-socio');
    expect(TestBed.inject(SesionService).autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith('/acceso/iniciar-sesion');
  });

  it('sin sesión no ofrece cerrar sesión', async () => {
    await renderizar(null);

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });
});
