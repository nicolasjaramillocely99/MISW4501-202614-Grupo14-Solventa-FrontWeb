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

describe('rutas de siniestros (HU-W2.1-01)', () => {
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
            consultarOpcionesRadicacion: () => NEVER,
            listarSiniestros: () => NEVER,
            listarCola: () => NEVER,
            listarColaPrioridad: () => NEVER,
            consultarPoliticaTriage: () => NEVER,
            consultarEvaluacion: () => NEVER,
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

  it('sin sesión lleva al inicio de sesión conservando la URL pedida', async () => {
    await harness.navigateByUrl('/siniestros/radicar');

    expect(url()).toBe('/acceso/iniciar-sesion?returnUrl=%2Fsiniestros%2Fradicar');
  });

  it('el asegurado entra a «Radicar un siniestro» y a «Mis siniestros» dentro del shell del portal', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl('/siniestros/radicar');
    expect(url()).toBe('/siniestros/radicar');
    expect(harness.routeNativeElement?.querySelector('nav')).not.toBeNull();

    await harness.navigateByUrl('/siniestros/mis-siniestros');
    expect(url()).toBe('/siniestros/mis-siniestros');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Mis siniestros');
  });

  it('el asegurado corrige su radicación devuelta en «:id/corregir», no en el detalle (HU-W2.1-04)', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl('/siniestros/8f14e45f-ceea-467a-9f3a-5a2d0b1c7e93/corregir');

    expect(url()).toBe('/siniestros/8f14e45f-ceea-467a-9f3a-5a2d0b1c7e93/corregir');
    expect(harness.routeNativeElement?.querySelector('app-correccion-radicacion-page')).not.toBeNull();
  });

  it.each(['asesor', 'operaciones'] as const)('el rol %s no corrige una radicación', async (rol) => {
    await iniciarSesionComo(rol);

    await harness.navigateByUrl('/siniestros/8f14e45f-ceea-467a-9f3a-5a2d0b1c7e93/corregir');

    expect(url()).toBe('/acceso/no-autorizado');
  });

  it.each(['asesor', 'operaciones', 'socio'] as const)('el rol %s no entra: va a «acceso no autorizado»', async (rol) => {
    await iniciarSesionComo(rol);

    await harness.navigateByUrl('/siniestros/radicar');

    expect(url()).toBe('/acceso/no-autorizado');
  });

  it('operaciones entra a los casos en evaluación y a la evaluación de un caso (HU-W2.2-03)', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/siniestros/evaluacion');
    expect(url()).toBe('/siniestros/evaluacion');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Cola de siniestros');

    await harness.navigateByUrl('/siniestros/caso-1/evaluar');
    expect(url()).toBe('/siniestros/caso-1/evaluar');
  });

  it.each(['asegurado', 'asesor', 'socio'] as const)('el rol %s no entra a la evaluación: va a «acceso no autorizado»', async (rol) => {
    await iniciarSesionComo(rol);

    await harness.navigateByUrl('/siniestros/evaluacion');
    expect(url()).toBe('/acceso/no-autorizado');

    await harness.navigateByUrl('/siniestros/caso-1/evaluar');
    expect(url()).toBe('/acceso/no-autorizado');
  });
});
