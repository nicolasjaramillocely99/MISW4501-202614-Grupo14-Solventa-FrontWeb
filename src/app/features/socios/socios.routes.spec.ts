import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { crearProveedorIdentidadFalso, iniciarSesionComo, proveerSesionPrueba } from '@testing/sesion-pruebas';
import { LISTADO_SOCIOS_DTO, SOCIO_ACTIVO_DTO, SOCIO_ID } from '@testing/socios-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { of } from 'rxjs';

import { SociosApiService } from '@core/api/socios/socios-api.service';
import { mapearDetalleSocio, mapearListadoSocios } from '@core/api/socios/socios.modelos';

import { routes } from '../../app.routes';

describe('rutas de socios (HU-W3.1-01)', () => {
  let harness: RouterTestingHarness;

  beforeAll(async () => {
    await import('@layout/portal/portal-shell.component');
    await import('@features/socios/socios.routes');
  }, 120_000);

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter(routes),
        ...proveerSesionPrueba(crearProveedorIdentidadFalso()),
        {
          provide: SociosApiService,
          useValue: {
            listar: () => of(mapearListadoSocios(LISTADO_SOCIOS_DTO)),
            obtener: () => of(mapearDetalleSocio(SOCIO_ACTIVO_DTO)),
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  const url = () => TestBed.inject(Router).url;

  it('el analista de operaciones entra al listado y al detalle dentro del shell del portal', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/socios');
    expect(harness.routeNativeElement?.querySelector('app-listado-socios-page')).not.toBeNull();

    await harness.navigateByUrl(`/socios/${SOCIO_ID}`);
    expect(harness.routeNativeElement?.querySelector('app-detalle-socio-page')).not.toBeNull();
  });

  it('los demás roles reciben «acceso no autorizado» (la URL nunca lleva el rol)', async () => {
    for (const rol of ['asegurado', 'asesor', 'socio'] as const) {
      await iniciarSesionComo(rol);

      await harness.navigateByUrl('/socios');

      expect(url()).toBe('/acceso/no-autorizado');
    }
  });

  it('las pantallas del socio aún sin historia siguen llevando al inicio', async () => {
    await iniciarSesionComo('socio');

    for (const ruta of ['/socios/tablero', '/socios/tablero/desempeno', '/socios/credenciales']) {
      await harness.navigateByUrl(ruta);
      expect(url()).toBe('/inicio');
    }
  });
});
