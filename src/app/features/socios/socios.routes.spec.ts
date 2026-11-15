import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DESEMPENO_OPERATIVO_DTO } from '@testing/desempeno-pruebas';
import { crearProveedorIdentidadFalso, iniciarSesionComo, proveerSesionPrueba } from '@testing/sesion-pruebas';
import { LISTADO_SOCIOS_DTO, SOCIO_ACTIVO_DTO, SOCIO_ID } from '@testing/socios-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { of } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { mapearDesempeno } from '@core/api/socios/desempeno.modelos';
import { SociosApiService } from '@core/api/socios/socios-api.service';
import { mapearDetalleSocio, mapearListadoSocios } from '@core/api/socios/socios.modelos';

import { routes } from '../../app.routes';

describe('rutas de socios (HU-W3.1-01, HU-W3.2-01, HU-W3.2-03)', () => {
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
          provide: OriginacionApiService,
          useValue: {
            consultarResumenSocio: () =>
              of({ socioId: 'socio-001', desde: '2026-08-18', hasta: '2026-09-16', cotizaciones: 0, polizasEmitidas: 0, tasaConversion: 0 }),
          },
        },
        {
          provide: SociosApiService,
          useValue: {
            listar: () => of(mapearListadoSocios(LISTADO_SOCIOS_DTO)),
            obtener: () => of(mapearDetalleSocio(SOCIO_ACTIVO_DTO)),
            consultarDesempeno: () => of(mapearDesempeno(DESEMPENO_OPERATIVO_DTO)),
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

  it('el socio comercial entra a su tablero de integración (B1, HU-W3.2-01)', async () => {
    await iniciarSesionComo('socio');

    await harness.navigateByUrl('/socios/tablero');

    expect(url()).toBe('/socios/tablero');
    expect(harness.routeNativeElement?.querySelector('app-tablero-page')).not.toBeNull();
  });

  it('el socio comercial entra al desempeño técnico de la API (B3, HU-W3.2-03)', async () => {
    await iniciarSesionComo('socio');

    await harness.navigateByUrl('/socios/tablero/desempeno');

    expect(url()).toBe('/socios/tablero/desempeno');
    expect(harness.routeNativeElement?.querySelector('app-desempeno-page')).not.toBeNull();
  });

  it('el tablero y el desempeño del socio no son de los demás roles', async () => {
    for (const rol of ['asegurado', 'asesor', 'operaciones'] as const) {
      await iniciarSesionComo(rol);

      for (const ruta of ['/socios/tablero', '/socios/tablero/desempeno']) {
        await harness.navigateByUrl(ruta);
        expect(url()).toBe('/acceso/no-autorizado');
      }
    }
  });

  it('las pantallas del socio aún sin historia siguen llevando al inicio', async () => {
    await iniciarSesionComo('socio');

    for (const ruta of ['/socios/tablero/por-producto', '/socios/credenciales']) {
      await harness.navigateByUrl(ruta);
      expect(url()).toBe('/inicio');
    }
  });
});
