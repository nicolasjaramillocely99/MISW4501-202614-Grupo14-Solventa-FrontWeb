import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { crearLeafletFalso } from '@testing/leaflet-pruebas';
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
import { CARGAR_LEAFLET } from './asistencias/modelos/mapa';

const ID = '184a52ab-8b1a-4715-ac8e-d124e121fe33';

describe('rutas de las asistencias en sitio (HU-W2.3-03, S21)', () => {
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
        { provide: CARGAR_LEAFLET, useValue: () => Promise.resolve(crearLeafletFalso().modulo) },
        {
          provide: SiniestrosApiService,
          useValue: {
            listarBandejaAsistencias: () => NEVER,
            consultarAsistencia: () => NEVER,
            consultarPoliticaAsistencia: () => NEVER,
            listarPrestadores: () => NEVER,
            consultarSiniestro: () => NEVER,
            consultarHistorial: () => NEVER,
            consultarTriage: () => NEVER,
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
  const itemActivo = () =>
    harness.routeNativeElement?.ownerDocument.querySelector('nav a[aria-current="page"]')
      ?.textContent;

  it('el analista entra a la bandeja y al detalle (no los captura :id del asegurado)', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/siniestros/asistencias');
    expect(url()).toBe('/siniestros/asistencias');
    expect(titulo()).toContain('Asistencias en sitio');
    expect(itemActivo()).toContain('Asistencias');

    await harness.navigateByUrl(`/siniestros/asistencias/${ID}`);
    expect(url()).toBe(`/siniestros/asistencias/${ID}`);
    expect(itemActivo()).toContain('Asistencias');
  });

  it.each(['asegurado', 'asesor', 'socio'] as const)(
    'el rol %s no entra a ninguna de las dos',
    async (rol) => {
      await iniciarSesionComo(rol);

      await harness.navigateByUrl('/siniestros/asistencias');
      expect(url()).toBe('/acceso/no-autorizado');

      await harness.navigateByUrl(`/siniestros/asistencias/${ID}`);
      expect(url()).toBe('/acceso/no-autorizado');
    },
  );

  it('el detalle del asegurado (/siniestros/:id) sigue siendo suyo', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl(`/siniestros/${ID}`);

    expect(url()).toBe(`/siniestros/${ID}`);
  });
});
