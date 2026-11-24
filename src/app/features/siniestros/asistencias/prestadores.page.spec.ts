import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PRESTADORES_DTO, PRESTADOR_DTO } from '@testing/asignacion-pruebas';
import { simularDialogoNativo } from '@testing/dialogo-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import {
  ErrorAsignacion,
  Prestador,
  mapearListaPrestadores,
  mapearPrestador,
} from '@core/api/siniestros/asignacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { PrestadoresPage } from './prestadores.page';

const PRESTADORES = mapearListaPrestadores({ items: PRESTADORES_DTO });

describe('PrestadoresPage (HU-W2.3-01, F2)', () => {
  let api: {
    listarPrestadores: ReturnType<typeof vi.fn>;
    cambiarDisponibilidadPrestador: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => simularDialogoNativo());

  async function renderizar(
    lista: Observable<Prestador[]> = of(PRESTADORES),
    consulta: Record<string, string> = {},
  ) {
    api = {
      listarPrestadores: vi.fn().mockReturnValue(lista),
      cambiarDisponibilidadPrestador: vi
        .fn()
        .mockReturnValue(
          of(
            mapearPrestador({
              ...PRESTADOR_DTO,
              availability: 'unavailable',
              updated_by: 'andres.ruiz@solventa.example',
            }),
          ),
        ),
    };
    const vista = await render(PrestadoresPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } },
        },
      ],
    });
    const router = vista.fixture.debugElement.injector.get(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return { usuario: userEvent.setup(), navegar };
  }

  const fila = (nombre: string) =>
    screen.getByRole('rowheader', { name: new RegExp(nombre) }).closest('tr') as HTMLElement;

  it('lista el registro con especialidades, contacto, disponibilidad y quién lo actualizó', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Prestadores' })).toBeTruthy();
    expect(api.listarPrestadores).toHaveBeenCalledWith({
      especialidad: undefined,
      disponibilidad: undefined,
    });
    const norte = within(fila('Servicios Hogar Norte'));
    expect(norte.getByText('Plomería · Humedades')).toBeTruthy();
    expect(norte.getByRole('link', { name: 'despachos@hogarnorte.example.com' })).toBeTruthy();
    expect(norte.getByText('Disponible')).toBeTruthy();
    expect(norte.getByText('Carga inicial')).toBeTruthy();
    expect(
      within(fila('Reparaciones Chapinero')).getByText('hasta 7 de septiembre de 2026'),
    ).toBeTruthy();
    const ocupado = within(fila('Técnicos Unidos'));
    expect(ocupado.getByText('Ocupado en un caso')).toBeTruthy();
    expect(ocupado.getByRole('link', { name: 'Ver la asignación' }).getAttribute('href')).toBe(
      '/siniestros/0b5c2d9e-3a41-4f6e-9c1d-7e2f8a9b0c11/asignar-prestador',
    );
    expect(ocupado.getByText('andres.ruiz@solventa.example')).toBeTruthy();
    expect(ocupado.getByRole('button', { name: 'Liberar a Técnicos Unidos' })).toBeTruthy();
  });

  it('lee los filtros de la URL y los escribe al cambiarlos', async () => {
    const { usuario, navegar } = await renderizar(of(PRESTADORES), {
      especialidad: 'plumbing',
      disponibilidad: 'otra',
    });

    expect(api.listarPrestadores).toHaveBeenCalledWith({
      especialidad: 'plumbing',
      disponibilidad: undefined,
    });
    expect((screen.getByLabelText('Especialidad') as HTMLSelectElement).value).toBe('plumbing');

    await usuario.selectOptions(screen.getByLabelText('Disponibilidad'), 'busy');
    expect(api.listarPrestadores).toHaveBeenLastCalledWith({
      especialidad: 'plumbing',
      disponibilidad: 'busy',
    });
    expect(navegar).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { especialidad: 'plumbing', disponibilidad: 'busy' },
        replaceUrl: true,
      }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(api.listarPrestadores).toHaveBeenLastCalledWith({});
  });

  it('cambia la disponibilidad y actualiza la fila', async () => {
    const { usuario } = await renderizar();

    await usuario.click(
      screen.getByRole('button', { name: 'Cambiar disponibilidad de Servicios Hogar Norte' }),
    );
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }),
    );

    expect(api.cambiarDisponibilidadPrestador).toHaveBeenCalledWith('prv-servicios-hogar-norte', {
      disponibilidad: 'unavailable',
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Se actualizó la disponibilidad de Servicios Hogar Norte.',
    );
    expect(within(fila('Servicios Hogar Norte')).getByText('No disponible')).toBeTruthy();
  });

  it('libera a un prestador ocupado', async () => {
    const { usuario } = await renderizar();
    api.cambiarDisponibilidadPrestador.mockReturnValue(
      of(
        mapearPrestador({ ...PRESTADORES_DTO[2], availability: 'available', busy_claim_id: null }),
      ),
    );

    await usuario.click(screen.getByRole('button', { name: 'Liberar a Técnicos Unidos' }));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }),
    );

    expect(api.cambiarDisponibilidadPrestador).toHaveBeenCalledWith('prv-tecnicos-unidos', {
      disponibilidad: 'available',
    });
    expect(
      within(fila('Técnicos Unidos')).queryByRole('link', { name: 'Ver la asignación' }),
    ).toBeNull();
  });

  it('si el guardado falla, el diálogo lo dice y queda abierto', async () => {
    const { usuario } = await renderizar();
    api.cambiarDisponibilidadPrestador.mockReturnValue(
      throwError(() => new ErrorAsignacion('claims_unavailable')),
    );

    await usuario.click(
      screen.getByRole('button', { name: 'Cambiar disponibilidad de Servicios Hogar Norte' }),
    );
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }),
    );

    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeTruthy();
    expect((document.querySelector('dialog') as HTMLDialogElement).open).toBe(true);
  });

  it('sin prestadores registrados lo dice', async () => {
    await renderizar(of([]));
    expect(screen.getByText('No hay prestadores registrados.')).toBeTruthy();
  });

  it('sin resultados con filtros', async () => {
    await renderizar(of([]), { especialidad: 'bodywork' });
    expect(screen.getByText('Ningún prestador coincide con los filtros.')).toBeTruthy();
  });

  it('mientras carga lo dice', async () => {
    await renderizar(NEVER);
    expect(screen.getByRole('status').textContent).toContain('Cargando prestadores…');
  });

  it('un error al cargar deja reintentar', async () => {
    const { usuario } = await renderizar(
      throwError(() => new ErrorAsignacion('claims_unavailable')),
    );

    expect(screen.getByRole('heading', { name: 'No pudimos cargar los prestadores' })).toBeTruthy();
    api.listarPrestadores.mockReturnValue(of(PRESTADORES));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
  });
});
