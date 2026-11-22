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
import { NEVER } from 'rxjs';

import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { routes } from '../../app.routes';

const ID = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90';

describe('ruta del seguimiento de la intervención (HU-W2.3-02, O8)', () => {
  let proveedor: ProveedorIdentidadFalso;
  let harness: RouterTestingHarness;

  // Precarga los módulos perezosos: en Vitest la primera importación de @lucide/angular tarda varios segundos.
  beforeAll(async () => {
    await import('@layout/portal/portal-shell.component');
    await import('@features/siniestros/siniestros.routes');
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
          provide: SiniestrosApiService,
          useValue: {
            consultarIntervencion: () => NEVER,
            consultarSiniestro: () => NEVER,
            consultarHistorial: () => NEVER,
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  const url = () => TestBed.inject(Router).url;

  it('el analista entra al seguimiento (no lo captura :id del asegurado)', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl(`/siniestros/${ID}/seguimiento`);

    expect(url()).toBe(`/siniestros/${ID}/seguimiento`);
    expect(harness.routeNativeElement?.textContent).toContain('Cargando la intervención');
  });

  it.each(['asegurado', 'asesor', 'socio'] as const)('el rol %s no entra', async (rol) => {
    await iniciarSesionComo(rol);

    await harness.navigateByUrl(`/siniestros/${ID}/seguimiento`);

    expect(url()).toBe('/acceso/no-autorizado');
  });
});
