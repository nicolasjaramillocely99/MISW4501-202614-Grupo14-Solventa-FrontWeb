import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  ProveedorIdentidadFalso,
  crearProveedorIdentidadFalso,
  iniciarSesionComo,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { routes } from './app.routes';

describe('rutas raíz', () => {
  let proveedor: ProveedorIdentidadFalso;
  let harness: RouterTestingHarness;

  // Precarga los módulos perezosos: en Vitest la primera importación de @lucide/angular tarda varios segundos.
  beforeAll(async () => {
    await import('@features/acceso/acceso.routes');
    await import('@layout/portal/portal-shell.component');
    await import('@features/inicio/inicio.routes');
  }, 120_000);

  beforeEach(async () => {
    sessionStorage.clear();
    proveedor = crearProveedorIdentidadFalso();
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter(routes), ...proveerSesionPrueba(proveedor)],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  const url = () => TestBed.inject(Router).url;

  it('sin sesión, el portal lleva al inicio de sesión con la URL pedida', async () => {
    await harness.navigateByUrl('/inicio');

    expect(url()).toBe('/acceso/iniciar-sesion?returnUrl=%2Finicio');
    expect(harness.routeNativeElement?.textContent).toContain('Iniciar sesión');
  });

  it('con sesión, la raíz entra al inicio dentro del shell', async () => {
    await iniciarSesionComo('asesor');

    await harness.navigateByUrl('/');

    expect(url()).toBe('/inicio');
    expect(harness.routeNativeElement?.querySelector('nav')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Hola, Laura');
  });

  it('una pantalla que aún no existe redirige al inicio del rol', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl('/originacion/polizas');

    expect(url()).toBe('/inicio');
  });

  it('las pantallas de acceso son públicas', async () => {
    await harness.navigateByUrl('/acceso/no-autorizado');

    expect(url()).toBe('/acceso/no-autorizado');
    expect(proveedor.refrescar).not.toHaveBeenCalled();
  });
});
