import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { REGISTRO_DECISION_DTO } from '@testing/decision-pruebas';
import {
  crearProveedorIdentidadFalso,
  iniciarSesionComo,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { of } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { mapearRegistroDecision } from '@core/api/auditoria/decision.modelos';

import { routes } from '../../app.routes';

describe('rutas de auditoría (HU-W4.1-01)', () => {
  let harness: RouterTestingHarness;

  // Precarga los módulos perezosos: en Vitest la primera importación de @lucide/angular tarda varios segundos.
  beforeAll(async () => {
    await import('@layout/portal/portal-shell.component');
    await import('@features/auditoria/auditoria.routes');
  }, 120_000);

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter(routes),
        ...proveerSesionPrueba(crearProveedorIdentidadFalso()),
        {
          provide: AuditoriaApiService,
          useValue: { consultarRegistroDecision: () => of(mapearRegistroDecision(REGISTRO_DECISION_DTO)) },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  const url = () => TestBed.inject(Router).url;

  it('sin sesión lleva al inicio de sesión conservando la URL pedida', async () => {
    await harness.navigateByUrl('/auditoria/registro');

    expect(url()).toBe('/acceso/iniciar-sesion?returnUrl=%2Fauditoria%2Fregistro');
  });

  it('el analista de operaciones entra a la búsqueda dentro del shell del portal', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/auditoria/registro');

    expect(url()).toBe('/auditoria/registro');
    expect(harness.routeNativeElement?.querySelector('nav')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-busqueda-registro-page')).not.toBeNull();
  });

  it('un identificador abre el registro de esa póliza', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/auditoria/registro/off-4f2a9c');

    expect(harness.routeNativeElement?.querySelector('app-registro-auditoria-page')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('off-4f2a9c');
  });

  it('los demás roles reciben «acceso no autorizado» (la URL nunca lleva el rol)', async () => {
    for (const rol of ['asegurado', 'asesor', 'socio'] as const) {
      await iniciarSesionComo(rol);

      await harness.navigateByUrl('/auditoria/registro');

      expect(url()).toBe('/acceso/no-autorizado');
    }
  });
});
