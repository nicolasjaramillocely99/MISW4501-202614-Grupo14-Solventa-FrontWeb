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

describe('rutas de la prioridad del siniestro (HU-W2.2-01, S12)', () => {
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
            consultarPoliticaTriage: () => NEVER,
            consultarTriageLote: () => NEVER,
            consultarTriage: () => NEVER,
            consultarSiniestro: () => NEVER,
            listarSiniestros: () => NEVER,
            consultarOpcionesRadicacion: () => NEVER,
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  const url = () => TestBed.inject(Router).url;
  const titulo = () => harness.routeNativeElement?.querySelector('h1')?.textContent;

  it('el analista entra a la cola, no a «Mis siniestros» ni al detalle del asegurado (la cola no cae en :id)', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/siniestros/cola');
    expect(url()).toBe('/siniestros/cola');
    expect(titulo()).toContain('Cola de siniestros');
    expect(harness.routeNativeElement?.querySelector('nav')).not.toBeNull();

    await harness.navigateByUrl(`/siniestros/${ID}`);
    expect(url()).toBe('/acceso/no-autorizado');

    await harness.navigateByUrl('/siniestros/mis-siniestros');
    expect(url()).toBe('/acceso/no-autorizado');
  });

  it('el analista entra a la prioridad de un caso en /siniestros/cola/:id', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl(`/siniestros/cola/${ID}?casos=${ID}`);

    expect(url()).toBe(`/siniestros/cola/${ID}?casos=${ID}`);
    expect(harness.routeNativeElement?.textContent).toContain('Cola de siniestros');
  });

  it('el asegurado entra al detalle de su siniestro en /siniestros/:id y no a la cola', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl(`/siniestros/${ID}`);
    expect(url()).toBe(`/siniestros/${ID}`);
    expect(harness.routeNativeElement?.textContent).toContain('Mis siniestros');

    await harness.navigateByUrl('/siniestros/cola');
    expect(url()).toBe('/acceso/no-autorizado');

    await harness.navigateByUrl(`/siniestros/cola/${ID}`);
    expect(url()).toBe('/acceso/no-autorizado');
  });

  it('«radicar» y «mis-siniestros» siguen siendo del asegurado y no los captura :id', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl('/siniestros/mis-siniestros');
    expect(titulo()).toContain('Mis siniestros');

    await harness.navigateByUrl('/siniestros/radicar');
    expect(url()).toBe('/siniestros/radicar');
  });

  it.each(['asesor', 'socio'] as const)('el rol %s no entra a ninguna: va a «acceso no autorizado»', async (rol) => {
    await iniciarSesionComo(rol);

    await harness.navigateByUrl('/siniestros/cola');
    expect(url()).toBe('/acceso/no-autorizado');

    await harness.navigateByUrl(`/siniestros/cola/${ID}`);
    expect(url()).toBe('/acceso/no-autorizado');

    await harness.navigateByUrl(`/siniestros/${ID}`);
    expect(url()).toBe('/acceso/no-autorizado');
  });

  it('sin sesión lleva al inicio de sesión conservando la URL pedida', async () => {
    await harness.navigateByUrl('/siniestros/cola');

    expect(url()).toBe('/acceso/iniciar-sesion?returnUrl=%2Fsiniestros%2Fcola');
  });
});
