import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  ASIGNACION_ASIGNADA_DTO,
  ASIGNACION_AVISADA_DTO,
  ASIGNACION_LISTA_DTO,
  ASIGNACION_PENDIENTE_DTO,
  ASIGNACION_PROPUESTA_DTO,
  ASIGNACION_SIN_UBICACION_DTO,
  ASIGNACION_SIN_VISITA_DTO,
  ASIGNACION_UBICADA_POR_ANALISTA_DTO,
  POLITICA_ASIGNACION_DTO,
  PRESTADORES_DTO,
} from '@testing/asignacion-pruebas';
import { simularDialogoNativo } from '@testing/dialogo-pruebas';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';
import { LeafletFalso, crearLeafletFalso } from '@testing/leaflet-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import {
  AsignacionSiniestro,
  AsignacionSiniestroDto,
  CodigoErrorAsignacion,
  ErrorAsignacion,
  mapearAsignacionSiniestro,
  mapearListaPrestadores,
  mapearPoliticaAsignacion,
} from '@core/api/siniestros/asignacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import {
  AsignacionPrestadorPage,
  INTERVALO_AVISO_MS,
  MAXIMO_LECTURAS_AVISO,
} from './asignacion-prestador.page';
import { CARGAR_LEAFLET } from './modelos/mapa';

const de = (dto: AsignacionSiniestroDto) => of(mapearAsignacionSiniestro(dto));
const falla = (codigo: CodigoErrorAsignacion, campos: { campo: string; codigo: string }[] = []) =>
  throwError(() => new ErrorAsignacion(codigo, campos));

describe('AsignacionPrestadorPage (O7 y O7b · HU-W2.3-01)', () => {
  let leaflet: LeafletFalso;
  let api: {
    consultarAsignacion: ReturnType<typeof vi.fn<(id: string) => Observable<AsignacionSiniestro>>>;
    consultarPoliticaAsignacion: ReturnType<typeof vi.fn>;
    listarPrestadores: ReturnType<typeof vi.fn>;
    buscarPrestador: ReturnType<typeof vi.fn>;
    asignarPrestador: ReturnType<typeof vi.fn>;
    registrarUbicacionIncidente: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => simularDialogoNativo());
  afterEach(() => vi.useRealTimers());

  async function renderizar(
    lectura: Observable<AsignacionSiniestro> = de(ASIGNACION_PROPUESTA_DTO),
    politica: Observable<unknown> = of(mapearPoliticaAsignacion(POLITICA_ASIGNACION_DTO)),
    prestadores: Observable<unknown> = of(mapearListaPrestadores({ items: PRESTADORES_DTO })),
  ) {
    leaflet = crearLeafletFalso();
    api = {
      consultarAsignacion: vi.fn().mockReturnValue(lectura),
      consultarPoliticaAsignacion: vi.fn().mockReturnValue(politica),
      listarPrestadores: vi.fn().mockReturnValue(prestadores),
      buscarPrestador: vi.fn().mockReturnValue(de(ASIGNACION_PROPUESTA_DTO)),
      asignarPrestador: vi.fn().mockReturnValue(de(ASIGNACION_ASIGNADA_DTO)),
      registrarUbicacionIncidente: vi.fn().mockReturnValue(de(ASIGNACION_UBICADA_POR_ANALISTA_DTO)),
    };
    const vista = await render(AsignacionPrestadorPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID_EVALUADO }) } },
        },
        { provide: CARGAR_LEAFLET, useValue: () => Promise.resolve(leaflet.modulo) },
      ],
    });
    // Con temporizadores falsos `whenStable` no termina: esas pruebas avanzan el reloj ellas mismas.
    if (!vi.isFakeTimers()) {
      await vista.fixture.whenStable();
    }
    return { usuario: userEvent.setup(), vista };
  }

  const boton = (nombre: string | RegExp) =>
    screen.getByRole('button', { name: nombre }) as HTMLButtonElement;

  it('O7: encabezado, ubicación de la app, criterio, sugerido y candidatos (CA-1 a CA-3)', async () => {
    await renderizar();

    expect(api.consultarAsignacion).toHaveBeenCalledWith(ID_EVALUADO);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Asignar prestador · SIN-2026-01655' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Siniestro SIN-2026-01655' }).getAttribute('href'),
    ).toBe(`/siniestros/${ID_EVALUADO}/evaluar`);
    expect(
      screen.getByText(
        'Evaluación en sitio requerida · Hogar · daño por agua · coordenadas capturadas desde la app al radicar',
      ),
    ).toBeTruthy();
    expect(screen.getByText('4,6771 N · 74,0483 O')).toBeTruthy();
    expect(screen.getByText('Capturadas desde la app · precisión 8 m')).toBeTruthy();
    expect(screen.getByText('5 km')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Criterio de asignación' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Al asignar' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Registro de intentos' })).toBeTruthy();
    expect(boton('Asignar prestador sugerido')).toBeTruthy();
    expect(boton('Ampliar radio de búsqueda').disabled).toBe(false);
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
    expect(api.listarPrestadores).toHaveBeenCalledWith({ especialidad: 'plumbing' });
  });

  it('ubica a los candidatos en el mapa con su distancia', async () => {
    await renderizar();

    await waitFor(() => expect(leaflet.capas.filter((c) => c.tipo === 'marker')).toHaveLength(4));
    expect(leaflet.capas.map((c) => c.etiqueta).filter(Boolean)).toEqual([
      'Incidente',
      'Servicios Hogar Norte · 2,3 km',
      'Reparaciones Chapinero · 3,8 km',
      'Técnicos Unidos · 6,1 km',
    ]);
    expect(leaflet.capas.find((c) => c.tipo === 'circle')?.opciones['radius']).toBe(5000);
  });

  it('ready: «Buscar prestador» sin cuerpo pasa a proposed (CA-2)', async () => {
    const { usuario } = await renderizar(de(ASIGNACION_LISTA_DTO));

    expect(screen.queryByRole('table')).toBeNull();
    await usuario.click(boton('Buscar prestador'));

    expect(api.buscarPrestador).toHaveBeenCalledWith(ID_EVALUADO);
    expect(boton('Asignar prestador sugerido')).toBeTruthy();
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
  });

  it('«Ampliar radio de búsqueda» empieza en el radio siguiente (CA-4)', async () => {
    const { usuario } = await renderizar();

    await usuario.click(boton('Ampliar radio de búsqueda'));

    expect(api.buscarPrestador).toHaveBeenCalledWith(ID_EVALUADO, 10);
  });

  it('asigna el sugerido con la búsqueda en pantalla, tras confirmar (CA-5)', async () => {
    const { usuario } = await renderizar();

    await usuario.click(boton('Asignar prestador sugerido'));
    const dialogo = screen.getByRole('dialog');
    expect(
      within(dialogo).getByRole('heading', { name: '¿Asignar a Servicios Hogar Norte?' }),
    ).toBeTruthy();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar asignación' }));

    expect(api.asignarPrestador).toHaveBeenCalledWith(ID_EVALUADO, 'prv-servicios-hogar-norte', 1);
    expect(screen.getByRole('heading', { name: 'Prestador asignado' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Al asignar' })).toBeNull();
  });

  it('asigna otro elegible desde su fila', async () => {
    const { usuario } = await renderizar();

    await usuario.click(boton('Asignar a Servicios Hogar Norte'));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar asignación' }),
    );

    expect(api.asignarPrestador).toHaveBeenCalledWith(ID_EVALUADO, 'prv-servicios-hogar-norte', 1);
  });

  it.each([
    ['provider_unavailable', 'El prestador ya no está disponible. Busca de nuevo.'],
    ['search_outdated', 'La búsqueda cambió mientras tanto. Revisa los prestadores actualizados.'],
    ['assignment_exists', 'Otro analista ya asignó un prestador a este caso.'],
  ] as const)('un 409 %s avisa y vuelve a leer el caso', async (codigo, texto) => {
    const { usuario } = await renderizar();
    api.asignarPrestador.mockReturnValue(falla(codigo));

    await usuario.click(boton('Asignar prestador sugerido'));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar asignación' }),
    );

    expect(screen.getByRole('alert').textContent).toContain(texto);
    expect(api.consultarAsignacion).toHaveBeenCalledTimes(2);
  });

  it('un error sin texto propio usa el genérico y no relee', async () => {
    const { usuario } = await renderizar();
    api.buscarPrestador.mockReturnValue(falla('invalid_request'));

    await usuario.click(boton('Ampliar radio de búsqueda'));

    expect(screen.getByRole('alert').textContent).toContain(
      'No pudimos completar la acción. Intenta de nuevo.',
    );
    expect(api.consultarAsignacion).toHaveBeenCalledTimes(1);
  });

  it('O7b: pendiente de asignación con el motivo, los intentos y nada asignable (CA-6)', async () => {
    const { usuario } = await renderizar(de(ASIGNACION_PENDIENTE_DTO));

    expect(screen.getByText('Pendiente de asignación')).toBeTruthy();
    const aviso = screen
      .getByText('No se encontró un prestador disponible')
      .closest('.aviso') as HTMLElement;
    expect(aviso.textContent).toContain('Se buscó en 5, 10 y 20 km');
    expect(aviso.textContent).toContain('ningún prestador elegible dentro del radio máximo');
    expect(aviso.textContent).toContain('cada 5 minutos');
    expect(screen.getByText('20 km (máximo)')).toBeTruthy();
    expect(screen.getByText('Radio máximo alcanzado · 3 intentos registrados')).toBeTruthy();
    expect(boton('Ampliar radio de búsqueda').disabled).toBe(true);
    expect(screen.getByText('Ya se buscó en el radio máximo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Asignar prestador sugerido' })).toBeNull();
    expect(
      screen
        .getAllByRole('button', { name: /^Asignar a/ })
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);

    await usuario.click(boton('Reintentar búsqueda'));
    expect(api.buscarPrestador).toHaveBeenCalledWith(ID_EVALUADO);
  });

  it('O7b: «Actualizar estado» vuelve a leer el caso (el reintento automático lo dejó propuesto)', async () => {
    const { usuario } = await renderizar(de(ASIGNACION_PENDIENTE_DTO));
    api.consultarAsignacion.mockReturnValue(de(ASIGNACION_PROPUESTA_DTO));

    await usuario.click(boton('Actualizar estado'));

    expect(boton('Asignar prestador sugerido')).toBeTruthy();
  });

  it('sin coordenadas registra la dirección y el pin, y pasa a ready (CA-1)', async () => {
    const { usuario, vista } = await renderizar(de(ASIGNACION_SIN_UBICACION_DTO));

    expect(screen.getByText(/sin coordenadas del incidente/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Buscar prestador' })).toBeNull();
    await waitFor(() => expect(leaflet.vistas.length).toBeGreaterThan(0));
    leaflet.clic(4.6771, -74.0483);
    vista.fixture.detectChanges();
    expect((screen.getByLabelText('Latitud') as HTMLInputElement).value).toBe('4.677100');

    await usuario.type(screen.getByLabelText('Dirección'), 'Carrera 15 # 93-40, apto 402, Bogotá');
    await usuario.click(boton('Guardar ubicación'));

    expect(api.registrarUbicacionIncidente).toHaveBeenCalledWith(ID_EVALUADO, {
      direccion: 'Carrera 15 # 93-40, apto 402, Bogotá',
      latitud: 4.6771,
      longitud: -74.0483,
    });
    expect(boton('Buscar prestador')).toBeTruthy();
    expect(screen.getByText(/Registradas por Andrés Ruiz/)).toBeTruthy();
  });

  it('el 422 de la ubicación se marca en el campo', async () => {
    const { usuario, vista } = await renderizar(de(ASIGNACION_SIN_UBICACION_DTO));
    api.registrarUbicacionIncidente.mockReturnValue(
      falla('validation_failed', [{ campo: 'longitude', codigo: 'out_of_range' }]),
    );

    await waitFor(() => expect(leaflet.vistas.length).toBeGreaterThan(0));
    leaflet.clic(4.6771, -74.0483);
    vista.fixture.detectChanges();
    await usuario.type(screen.getByLabelText('Dirección'), 'Carrera 15 # 93-40');
    await usuario.click(boton('Guardar ubicación'));

    expect(screen.getByText('La longitud va de −180 a 180.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('corrige la ubicación que registró el analista y puede cancelar', async () => {
    const { usuario } = await renderizar(de(ASIGNACION_UBICADA_POR_ANALISTA_DTO));

    await usuario.click(boton('Corregir ubicación'));
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).value).toBe(
      'Carrera 15 # 93-40, apto 402, Bogotá',
    );
    expect((screen.getByLabelText('Latitud') as HTMLInputElement).value).toBe('4.677100');

    await usuario.click(boton('Cancelar'));
    expect(screen.queryByLabelText('Dirección')).toBeNull();
  });

  it('sigue el aviso al prestador hasta que sale (S9)', async () => {
    vi.useFakeTimers();
    await renderizar(de(ASIGNACION_ASIGNADA_DTO));
    expect(screen.getByText('Enviando la asignación al prestador…')).toBeTruthy();

    api.consultarAsignacion.mockReturnValue(de(ASIGNACION_AVISADA_DTO));
    await vi.advanceTimersByTimeAsync(INTERVALO_AVISO_MS);
    await vi.advanceTimersByTimeAsync(100);

    expect(screen.getByText(/Aviso enviado al prestador/)).toBeTruthy();
    expect(api.consultarAsignacion).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INTERVALO_AVISO_MS * 3);
    expect(api.consultarAsignacion).toHaveBeenCalledTimes(2);
  });

  it('deja de seguir el aviso tras el máximo de lecturas y ofrece «Actualizar»', async () => {
    vi.useFakeTimers();
    await renderizar(de(ASIGNACION_ASIGNADA_DTO));

    await vi.advanceTimersByTimeAsync(INTERVALO_AVISO_MS * (MAXIMO_LECTURAS_AVISO + 2));

    expect(api.consultarAsignacion).toHaveBeenCalledTimes(MAXIMO_LECTURAS_AVISO + 1);
    expect(screen.getByText(/el sistema lo sigue intentando/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeTruthy();
  });

  it('sin política, «Ampliar radio» queda deshabilitado con su motivo y lo demás funciona', async () => {
    await renderizar(de(ASIGNACION_PROPUESTA_DTO), falla('claims_unavailable'));

    expect(boton('Ampliar radio de búsqueda').disabled).toBe(true);
    expect(screen.getByText('No pudimos leer los radios de búsqueda')).toBeTruthy();
    expect(boton('Asignar prestador sugerido').disabled).toBe(false);
  });

  it('si los prestadores no cargan, el mapa queda solo con el incidente y la tabla sigue', async () => {
    await renderizar(de(ASIGNACION_PROPUESTA_DTO), undefined, falla('claims_unavailable'));

    await waitFor(() => expect(leaflet.capas.some((c) => c.tipo === 'circle')).toBe(true));
    expect(leaflet.capas.filter((c) => c.tipo === 'marker').map((c) => c.etiqueta)).toEqual([
      'Incidente',
    ]);
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hurto: no requiere visita y no ofrece acciones', async () => {
    await renderizar(de(ASIGNACION_SIN_VISITA_DTO));

    expect(screen.getByText('Este siniestro no requiere visita en sitio')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Buscar|Asignar|Ampliar/ })).toBeNull();
    expect(screen.queryByRole('region', { name: /Mapa/ })).toBeNull();
    expect(api.listarPrestadores).not.toHaveBeenCalled();
  });

  it('caso fuera de evaluación', async () => {
    await renderizar(
      de({ ...ASIGNACION_LISTA_DTO, state: 'not_applicable', claim_status: 'active' }),
    );

    expect(screen.getByText('El caso no está en evaluación')).toBeTruthy();
  });

  it('404 → «No encontramos este siniestro» con el regreso a la lista', async () => {
    await renderizar(falla('claim_not_found'));

    expect(screen.getByRole('heading', { name: 'No encontramos este siniestro' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Volver a casos en evaluación' }).getAttribute('href'),
    ).toBe('/siniestros/evaluacion');
  });

  it('503 → error con «Reintentar»', async () => {
    const { usuario } = await renderizar(falla('claims_unavailable'));

    expect(screen.getByRole('heading', { name: 'No pudimos cargar la asignación' })).toBeTruthy();
    api.consultarAsignacion.mockReturnValue(de(ASIGNACION_PROPUESTA_DTO));
    await usuario.click(boton('Reintentar'));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Asignar prestador · SIN-2026-01655' }),
    ).toBeTruthy();
  });

  it('mientras carga lo dice', async () => {
    await renderizar(NEVER);

    expect(screen.getByRole('status').textContent).toContain(
      'Cargando la asignación del prestador…',
    );
  });
});
