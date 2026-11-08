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

const ID = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90';

describe('rutas de la asignación del prestador (HU-W2.3-01, S14)', () => {
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
            consultarAsignacion: () => NEVER,
            consultarPoliticaAsignacion: () => NEVER,
            listarPrestadores: () => NEVER,
            consultarSiniestro: () => NEVER,
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

  it('el analista entra a «Asignar prestador» y a los prestadores (no los captura :id del asegurado)', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl(`/siniestros/${ID}/asignar-prestador`);
    expect(url()).toBe(`/siniestros/${ID}/asignar-prestador`);
    expect(harness.routeNativeElement?.textContent).toContain(
      'Cargando la asignación del prestador',
    );

    await harness.navigateByUrl('/siniestros/prestadores?especialidad=plumbing');
    expect(url()).toBe('/siniestros/prestadores?especialidad=plumbing');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Prestadores');
  });

  it.each(['asegurado', 'asesor', 'socio'] as const)(
    'el rol %s no entra a ninguna de las dos',
    async (rol) => {
      await iniciarSesionComo(rol);

      await harness.navigateByUrl(`/siniestros/${ID}/asignar-prestador`);
      expect(url()).toBe('/acceso/no-autorizado');

      await harness.navigateByUrl('/siniestros/prestadores');
      expect(url()).toBe('/acceso/no-autorizado');
    },
  );

  it('el detalle del asegurado (/siniestros/:id) sigue siendo suyo', async () => {
    await iniciarSesionComo('asegurado');

    await harness.navigateByUrl(`/siniestros/${ID}`);

    expect(url()).toBe(`/siniestros/${ID}`);
  });

  it('la redirección de asistencias (HU-W2.3-03) no cambia', async () => {
    await iniciarSesionComo('operaciones');

    await harness.navigateByUrl('/siniestros/asistencias');

    expect(url()).toBe('/inicio');
  });
});
