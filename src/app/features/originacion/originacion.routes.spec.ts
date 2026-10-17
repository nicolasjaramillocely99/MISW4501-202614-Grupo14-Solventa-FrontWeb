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
import { of } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { mapearSolicitudRevision } from '@core/api/originacion/revision.modelos';
import { SOLICITUD_PENDIENTE_DTO } from '@testing/revision-pruebas';

import { routes } from '../../app.routes';

describe('rutas de originación (HU-W1.1-01)', () => {
  let proveedor: ProveedorIdentidadFalso;
  let harness: RouterTestingHarness;

  // Precarga los módulos perezosos: en Vitest la primera importación de @lucide/angular tarda varios segundos.
  beforeAll(async () => {
    await import('@layout/portal/portal-shell.component');
    await import('@features/originacion/originacion.routes');
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

  it('sin sesión lleva al inicio de sesión conservando la URL pedida', async () => {
    await harness.navigateByUrl('/originacion/cotizaciones/nueva');

    expect(url()).toBe('/acceso/iniciar-sesion?returnUrl=%2Foriginacion%2Fcotizaciones%2Fnueva');
  });

  it('el asesor entra a la pantalla de datos del cliente dentro del shell del portal', async () => {
    await iniciarSesionComo('asesor');

    await harness.navigateByUrl('/originacion/cotizaciones/nueva');

    expect(url()).toBe('/originacion/cotizaciones/nueva');
    expect(harness.routeNativeElement?.querySelector('nav')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Nueva cotización asistida');
  });

  it('un identificador distinto de «nueva» abre el resultado de esa cotización', async () => {
    await iniciarSesionComo('asesor');

    await harness.navigateByUrl('/originacion/cotizaciones/abc-123');

    expect(url()).toBe('/originacion/cotizaciones/abc-123');
    expect(harness.routeNativeElement?.querySelector('app-resultado-cotizacion-page')).not.toBeNull();
  });

  it('los demás roles reciben «acceso no autorizado» (la URL nunca lleva el rol)', async () => {
    for (const rol of ['asegurado', 'operaciones', 'socio'] as const) {
      await iniciarSesionComo(rol);

      await harness.navigateByUrl('/originacion/cotizaciones/nueva');

      expect(url()).toBe('/acceso/no-autorizado');
    }
  });
});

describe('rutas de la bandeja de decisión humana (HU-W1.1-02)', () => {
  let proveedor: ProveedorIdentidadFalso;
  let harness: RouterTestingHarness;

  beforeAll(async () => {
    await import('@layout/portal/portal-shell.component');
    await import('@features/originacion/originacion.routes');
  }, 120_000);

  beforeEach(async () => {
    sessionStorage.clear();
    proveedor = crearProveedorIdentidadFalso();
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter(routes),
        ...proveerSesionPrueba(proveedor),
        {
          provide: OriginacionApiService,
          useValue: {
            listarSolicitudesRevision: () => of({ solicitudes: [], conteos: { pendientes: 0, decididas: 0 } }),
            consultarSolicitudRevision: () => of(mapearSolicitudRevision(SOLICITUD_PENDIENTE_DTO)),
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  const url = () => TestBed.inject(Router).url;

  it('sin sesión lleva al inicio de sesión conservando la URL pedida', async () => {
    await harness.navigateByUrl('/originacion/bandeja-decision');

    expect(url()).toBe('/acceso/iniciar-sesion?returnUrl=%2Foriginacion%2Fbandeja-decision');
  });

  it('el asesor entra a la bandeja dentro del shell del portal', async () => {
    await iniciarSesionComo('asesor');

    await harness.navigateByUrl('/originacion/bandeja-decision');

    expect(url()).toBe('/originacion/bandeja-decision');
    expect(harness.routeNativeElement?.querySelector('nav')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Bandeja de decisión humana');
  });

  it('el asesor abre el detalle de una solicitud dentro del shell del portal', async () => {
    await iniciarSesionComo('asesor');

    await harness.navigateByUrl('/originacion/bandeja-decision/acc-1');

    expect(url()).toBe('/originacion/bandeja-decision/acc-1');
    expect(harness.routeNativeElement?.querySelector('app-detalle-solicitud-page')).not.toBeNull();
  });

  it('asegurado, operaciones y socio reciben «acceso no autorizado» en la bandeja y en el detalle', async () => {
    for (const rol of ['asegurado', 'operaciones', 'socio'] as const) {
      for (const destino of ['/originacion/bandeja-decision', '/originacion/bandeja-decision/acc-1']) {
        await iniciarSesionComo(rol);

        await harness.navigateByUrl(destino);

        expect(url()).toBe('/acceso/no-autorizado');
      }
    }
  });
});
