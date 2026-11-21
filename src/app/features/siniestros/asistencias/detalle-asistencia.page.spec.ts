import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  DETALLE_AGOTADA_DTO,
  DETALLE_ATENDIDA_DTO,
  DETALLE_AVISADA_DTO,
  DETALLE_CERRADA_DTO,
  DETALLE_CON_SUGERENCIA_DTO,
  DETALLE_DESPACHADA_DTO,
  DETALLE_NUEVA_DTO,
  DETALLE_SIN_GPS_DTO,
  DETALLE_UBICADA_POR_VOZ_DTO,
  DETALLE_VIAJE_DTO,
  ID_CON_GPS,
  POLITICA_ASISTENCIA_DTO,
  PRESTADORES_ASISTENCIA_DTO,
  detalleCon,
} from '@testing/asistencia-pruebas';
import { simularDialogoNativo } from '@testing/dialogo-pruebas';
import { LeafletFalso, crearLeafletFalso } from '@testing/leaflet-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import { mapearListaPrestadores } from '@core/api/siniestros/asignacion.modelos';
import {
  CodigoErrorAsistencia,
  DetalleAsistencia,
  DetalleAsistenciaDto,
  ErrorAsistencia,
  mapearDetalleAsistencia,
  mapearPoliticaAsistencia,
} from '@core/api/siniestros/asistencia.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { SesionService } from '@core/auth/sesion.service';

import {
  DetalleAsistenciaPage,
  INTERVALO_AVISO_ASISTENCIA_MS,
  MAXIMO_LECTURAS_AVISO_ASISTENCIA,
} from './detalle-asistencia.page';
import { CARGAR_LEAFLET } from './modelos/mapa';

const de = (dto: DetalleAsistenciaDto) => of(mapearDetalleAsistencia(dto));
const falla = (codigo: CodigoErrorAsistencia, campos: { campo: string; codigo: string }[] = []) =>
  throwError(() => new ErrorAsistencia(codigo, campos));
const PROPIO = 'operaciones.local@example.com';

type Simulado = ReturnType<typeof vi.fn<(...args: unknown[]) => Observable<unknown>>>;

describe('DetalleAsistenciaPage (O9b · HU-W2.3-03)', () => {
  let leaflet: LeafletFalso;
  let api: {
    consultarAsistencia: Simulado;
    consultarPoliticaAsistencia: Simulado;
    listarPrestadores: Simulado;
    atenderAsistencia: Simulado;
    registrarNecesidad: Simulado;
    registrarUbicacionPorVoz: Simulado;
    despacharAsistencia: Simulado;
    cerrarAsistencia: Simulado;
  };

  beforeAll(() => simularDialogoNativo());
  afterEach(() => vi.useRealTimers());

  const crearApi = (
    lectura: Observable<unknown>,
    politica: Observable<unknown>,
    prestadores: Observable<unknown>,
  ) => {
    api = {
      consultarAsistencia: vi.fn().mockReturnValue(lectura),
      consultarPoliticaAsistencia: vi.fn().mockReturnValue(politica),
      listarPrestadores: vi.fn().mockReturnValue(prestadores),
      atenderAsistencia: vi.fn().mockReturnValue(de(DETALLE_ATENDIDA_DTO)),
      registrarNecesidad: vi.fn().mockReturnValue(de(DETALLE_CON_SUGERENCIA_DTO)),
      registrarUbicacionPorVoz: vi.fn().mockReturnValue(de(DETALLE_UBICADA_POR_VOZ_DTO)),
      despacharAsistencia: vi.fn().mockReturnValue(de(DETALLE_AVISADA_DTO)),
      cerrarAsistencia: vi.fn().mockReturnValue(de(DETALLE_CERRADA_DTO)),
    };
    return api;
  };

  const proveedores = () => [
    { provide: SiniestrosApiService, useValue: api },
    { provide: SesionService, useValue: { usuario: signal({ correo: PROPIO }) } },
    { provide: CARGAR_LEAFLET, useValue: () => Promise.resolve(leaflet.modulo) },
  ];

  async function renderizar(
    lectura: Observable<unknown> = de(DETALLE_CON_SUGERENCIA_DTO),
    politica: Observable<unknown> = of(mapearPoliticaAsistencia(POLITICA_ASISTENCIA_DTO)),
    prestadores: Observable<unknown> = of(mapearListaPrestadores(PRESTADORES_ASISTENCIA_DTO)),
    id = ID_CON_GPS,
  ) {
    leaflet = crearLeafletFalso();
    crearApi(lectura, politica, prestadores);
    const vista = await render(DetalleAsistenciaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        ...proveedores(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
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
  const avisoDeError = () => screen.getByRole('alert').textContent?.trim();

  describe('lectura y encabezado (S8, S19)', () => {
    it('nueva: número, estado, subtítulo, «Atender» y «Cerrar solicitud»; sin despacho', async () => {
      await renderizar(de(DETALLE_NUEVA_DTO));

      expect(api.consultarAsistencia).toHaveBeenCalledWith(ID_CON_GPS);
      expect(
        screen.getByRole('heading', { level: 1, name: 'Asistencia AST-2026-0001' }),
      ).toBeTruthy();
      expect(screen.getByText('Nueva', { selector: 'app-insignia-estado' })).toBeTruthy();
      expect(
        screen.getByText(
          /^Carolina Pérez · Autos AU-2026-868766 · IZJ-766 · recibida (hoy|el \d\d\/\d\d\/2026) a las \d\d:\d\d:\d\d$/,
        ),
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Asistencias' }).getAttribute('href')).toBe(
        '/siniestros/asistencias',
      );
      expect(boton('Atender')).toBeTruthy();
      expect(boton('Cerrar solicitud').getAttribute('form')).toBe('cierre-asistencia');
      expect(screen.queryByRole('button', { name: 'Despachar prestador sugerido' })).toBeNull();
      expect(screen.getByRole('heading', { name: 'Llamada entrante' })).toBeTruthy();
      expect(screen.getByText('Atiende la solicitud para registrarla.')).toBeTruthy();
      expect(
        screen.getByText('Elige la necesidad para ver los prestadores sugeridos.'),
      ).toBeTruthy();
      expect(screen.getByText('Aún no hay decisiones registradas.')).toBeTruthy();
    });

    it('la tarjeta del asegurado, la ubicación del teléfono, la hora UTC y el pin (CA-2)', async () => {
      await renderizar(de(DETALLE_NUEVA_DTO));
      await new Promise((resolver) => setTimeout(resolver));

      const asegurado = within(
        screen.getByRole('heading', { name: 'Asegurado' }).closest('section') as HTMLElement,
      );
      expect(asegurado.getByText('Carolina Pérez')).toBeTruthy();
      expect(asegurado.getByText('AU-2026-868766 · Autos')).toBeTruthy();
      expect(asegurado.getByText('Vehículo')).toBeTruthy();
      expect(asegurado.getByText('IZJ-766')).toBeTruthy();

      expect(screen.getByText(/4,7712 N · 74,0452 O\s+· precisión 8 m/)).toBeTruthy();
      expect(screen.getByText('Autopista Norte km 12, Bogotá')).toBeTruthy();
      expect(screen.getByText('21/11/2026 16:16:10 Z')).toBeTruthy();
      expect(
        screen.getByRole('region', { name: 'Mapa del asegurado y de los prestadores cercanos' }),
      ).toBeTruthy();
      expect(leaflet.capas.find((c) => c.tipo === 'marker')?.etiqueta).toBe('Asegurado · ±8 m');
      expect(screen.getByRole('heading', { name: 'Al despachar' })).toBeTruthy();
    });

    it('en llamada propia: cronómetro, «Despachar prestador sugerido» y sin «Continuar»', async () => {
      await renderizar();

      expect(screen.getByText(/· llamada en curso$/)).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Llamada en curso' })).toBeTruthy();
      expect(screen.getByRole('timer', { name: 'Duración de la llamada' })).toBeTruthy();
      expect(screen.getByText('Atendida por Andrés Ruiz')).toBeTruthy();
      expect(boton('Despachar prestador sugerido').disabled).toBe(false);
      expect(screen.queryByRole('button', { name: 'Atender' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Continuar la llamada' })).toBeNull();
    });

    it('usa el detalle que trae «Atender» de la bandeja sin volver a leerlo (S5)', async () => {
      leaflet = crearLeafletFalso();
      crearApi(NEVER, of(mapearPoliticaAsistencia(POLITICA_ASISTENCIA_DTO)), NEVER);
      TestBed.configureTestingModule({
        imports: [proveerTranslocoPruebas()],
        providers: [
          provideRouter([{ path: 'siniestros/asistencias/:id', component: DetalleAsistenciaPage }]),
          ...proveedores(),
        ],
      });
      const harness = await RouterTestingHarness.create();
      const detalle = mapearDetalleAsistencia(DETALLE_ATENDIDA_DTO);

      await TestBed.inject(Router).navigate(['/siniestros/asistencias', ID_CON_GPS], {
        state: { detalle },
      });
      harness.detectChanges();

      expect(api.consultarAsistencia).not.toHaveBeenCalled();
      expect(harness.routeNativeElement?.textContent).toContain('Llamada en curso');
    });

    it('un detalle de otra solicitud en la navegación no se usa', async () => {
      leaflet = crearLeafletFalso();
      crearApi(de(DETALLE_NUEVA_DTO), NEVER, NEVER);
      TestBed.configureTestingModule({
        imports: [proveerTranslocoPruebas()],
        providers: [
          provideRouter([{ path: 'siniestros/asistencias/:id', component: DetalleAsistenciaPage }]),
          ...proveedores(),
        ],
      });
      const harness = await RouterTestingHarness.create();
      const otra: DetalleAsistencia = {
        ...mapearDetalleAsistencia(DETALLE_ATENDIDA_DTO),
        solicitudId: 'otra',
      };

      await TestBed.inject(Router).navigate(['/siniestros/asistencias', ID_CON_GPS], {
        state: { detalle: otra },
      });
      harness.detectChanges();

      expect(api.consultarAsistencia).toHaveBeenCalledWith(ID_CON_GPS);
    });

    it('404: «No encontramos esta solicitud» con la vuelta a la bandeja', async () => {
      await renderizar(falla('assistance_request_not_found'));

      expect(screen.getByRole('heading', { name: 'No encontramos esta solicitud' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Volver a asistencias' })).toBeTruthy();
    });

    it('503: el error con «Reintentar», que vuelve a leer', async () => {
      const { usuario } = await renderizar(falla('assistance_unavailable'));

      expect(screen.getByRole('heading', { name: 'No pudimos cargar la solicitud' })).toBeTruthy();
      api.consultarAsistencia.mockReturnValue(de(DETALLE_NUEVA_DTO));
      await usuario.click(boton('Reintentar'));

      expect(screen.getByRole('heading', { name: 'Asistencia AST-2026-0001' })).toBeTruthy();
    });

    it('«Actualizar» relee; si falla, deja la última lectura con un aviso', async () => {
      const { usuario } = await renderizar(de(DETALLE_NUEVA_DTO));
      api.consultarAsistencia.mockReturnValue(falla('assistance_unavailable'));

      await usuario.click(boton('Actualizar'));

      expect(api.consultarAsistencia).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { name: 'Asistencia AST-2026-0001' })).toBeTruthy();
      expect(avisoDeError()).toBe(
        'No pudimos actualizar la solicitud; se muestra la última lectura.',
      );
    });
  });

  describe('atender y tomar la llamada', () => {
    it('«Atender» la pasa a En llamada con la respuesta', async () => {
      const { usuario } = await renderizar(de(DETALLE_NUEVA_DTO));

      await usuario.click(boton('Atender'));

      expect(api.atenderAsistencia).toHaveBeenCalledWith(ID_CON_GPS);
      expect(screen.getByRole('heading', { name: 'Llamada en curso' })).toBeTruthy();
      expect(api.consultarAsistencia).toHaveBeenCalledTimes(1);
    });

    it('mientras atiende, el botón lo dice y todas las acciones esperan', async () => {
      const { usuario } = await renderizar(de(DETALLE_NUEVA_DTO));
      api.atenderAsistencia.mockReturnValue(NEVER);

      await usuario.click(boton('Atender'));

      expect(boton('Atendiendo…').disabled).toBe(true);
      expect(boton('Cerrar solicitud').disabled).toBe(true);
    });

    it('de otro analista: «En llamada con…» y «Continuar la llamada» la toma', async () => {
      const { usuario } = await renderizar(de(DETALLE_UBICADA_POR_VOZ_DTO));

      expect(screen.getByText('En llamada con Diana Torres')).toBeTruthy();
      await usuario.click(boton('Continuar la llamada'));

      expect(api.atenderAsistencia).toHaveBeenCalledWith(ID_CON_GPS);
    });

    it('409 assistance_not_open: avisa y relee', async () => {
      const { usuario } = await renderizar(de(DETALLE_NUEVA_DTO));
      api.atenderAsistencia.mockReturnValue(falla('assistance_not_open'));
      api.consultarAsistencia.mockReturnValue(de(DETALLE_CERRADA_DTO));

      await usuario.click(boton('Atender'));

      expect(avisoDeError()).toBe(
        'Otro analista ya despachó o cerró esta solicitud. La vista se actualizó.',
      );
      expect(screen.getByRole('heading', { name: 'Solicitud cerrada' })).toBeTruthy();
    });
  });

  describe('necesidad y sugerencia (S13, S14)', () => {
    it('registrar la necesidad trae la sugerencia y ubica a los prestadores en el mapa', async () => {
      const { usuario } = await renderizar(de(DETALLE_ATENDIDA_DTO));
      expect(api.listarPrestadores).not.toHaveBeenCalled();

      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Necesidad reportada' }),
        'towing',
      );
      await usuario.click(boton('Registrar'));
      await new Promise((resolver) => setTimeout(resolver));

      expect(api.registrarNecesidad).toHaveBeenCalledWith(ID_CON_GPS, 'towing');
      expect(api.listarPrestadores).toHaveBeenCalledWith({ especialidad: 'towing' });
      expect(
        screen.getByRole('button', { name: 'Despachar a Grúas Autopista Norte' }),
      ).toBeTruthy();
      expect(leaflet.capas.filter((c) => c.tipo === 'marker').map((c) => c.etiqueta)).toEqual([
        'Asegurado · ±8 m',
        'Grúas Autopista Norte · 0,9 km',
        'Auxilio Vial Norte · 2,2 km',
        'Grúas Calle 80 · 9,9 km',
      ]);
      expect(leaflet.capas.find((c) => c.tipo === 'circle')?.opciones['radius']).toBe(5000);
    });

    it('relee los prestadores solo si cambia la especialidad', async () => {
      const { usuario } = await renderizar();

      await usuario.click(boton('Actualizar'));

      expect(api.listarPrestadores).toHaveBeenCalledTimes(1);
    });

    it('422 need_not_for_line: avisa y relee', async () => {
      const { usuario } = await renderizar(de(DETALLE_ATENDIDA_DTO));
      api.registrarNecesidad.mockReturnValue(falla('need_not_for_line'));

      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Necesidad reportada' }),
        'fuel',
      );
      await usuario.click(boton('Registrar'));

      expect(avisoDeError()).toBe(
        'Esa necesidad no corresponde a la línea de la póliza. La vista se actualizó.',
      );
      expect(api.consultarAsistencia).toHaveBeenCalledTimes(2);
    });

    it('política caída: la necesidad ofrece reintentar y el cierre usa los motivos del contrato', async () => {
      const { usuario } = await renderizar(
        de(DETALLE_ATENDIDA_DTO),
        falla('assistance_unavailable'),
      );

      expect(screen.getByText('No pudimos cargar las necesidades.')).toBeTruthy();
      expect(
        screen
          .getByRole('combobox', { name: 'Motivo de la resolución' })
          .querySelectorAll('option'),
      ).toHaveLength(7);

      api.consultarPoliticaAsistencia.mockReturnValue(
        of(mapearPoliticaAsistencia(POLITICA_ASISTENCIA_DTO)),
      );
      await usuario.click(boton('Reintentar'));
      expect(screen.getByRole('combobox', { name: 'Necesidad reportada' })).toBeTruthy();
    });

    it('prestadores caídos: el mapa queda sin ellos y la tabla sigue', async () => {
      await renderizar(
        undefined,
        undefined,
        throwError(() => new Error('caído')),
      );
      await new Promise((resolver) => setTimeout(resolver));

      expect(screen.getByText(/No pudimos ubicar a los prestadores en el mapa/)).toBeTruthy();
      expect(leaflet.capas.filter((c) => c.tipo === 'marker')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Despachar a Grúas Autopista Norte' }),
      ).toBeTruthy();
    });

    it('póliza de Viaje: sin necesidades, se cierra con un motivo', async () => {
      await renderizar(de(DETALLE_VIAJE_DTO));

      expect(
        screen.getByText('Sin asistencia en sitio para esta póliza: ciérrala con un motivo.'),
      ).toBeTruthy();
      expect(screen.getByText('Objeto asegurado')).toBeTruthy();
    });

    it('agotada: sin sugerido, el motivo bajo el botón y «Cerrar como “Sin prestador disponible”»', async () => {
      const { usuario } = await renderizar(de(DETALLE_AGOTADA_DTO));

      const despachar = boton('Despachar prestador sugerido');
      expect(despachar.disabled).toBe(true);
      expect(despachar.getAttribute('aria-describedby')).toBe('motivo-sin-despacho');
      expect(screen.getByText('No hay un prestador disponible para despachar.')).toBeTruthy();

      await usuario.click(boton('Cerrar como «Sin prestador disponible»'));

      const motivo = screen.getByRole('combobox', { name: 'Motivo de la resolución' });
      expect((motivo as HTMLSelectElement).value).toBe('no_provider_available');
      expect(document.activeElement).toBe(motivo);
    });

    it('agotada: «Buscar de nuevo» relee la sugerencia', async () => {
      const { usuario } = await renderizar(de(DETALLE_AGOTADA_DTO));
      api.consultarAsistencia.mockReturnValue(de(DETALLE_CON_SUGERENCIA_DTO));

      await usuario.click(boton('Buscar de nuevo'));

      expect(api.consultarAsistencia).toHaveBeenCalledTimes(2);
      expect(boton('Despachar prestador sugerido').disabled).toBe(false);
    });
  });

  describe('ubicación por voz (S12, D3)', () => {
    const SIN_GPS_EN_LLAMADA = detalleCon(DETALLE_SIN_GPS_DTO, {
      status: 'in_call',
      handled_by: DETALLE_ATENDIDA_DTO.handled_by,
      history: DETALLE_ATENDIDA_DTO.history,
    });

    it('nueva sin GPS: dice el motivo y pide atenderla, sin formulario', async () => {
      await renderizar(de(DETALLE_SIN_GPS_DTO));

      expect(screen.getByText('Sin GPS')).toBeTruthy();
      expect(screen.getByText('Sin señal GPS')).toBeTruthy();
      expect(
        screen.getByText(
          'Atiende la solicitud para registrar la ubicación que te indique por voz.',
        ),
      ).toBeTruthy();
      expect(screen.queryByRole('textbox', { name: 'Dirección' })).toBeNull();
    });

    it('en llamada sin GPS: guarda la dirección y el pin y muestra la sugerencia', async () => {
      const { usuario } = await renderizar(de(SIN_GPS_EN_LLAMADA));

      await usuario.type(
        screen.getByRole('textbox', { name: 'Dirección' }),
        'Vía Cali–Palmira km 4',
      );
      await usuario.type(screen.getByRole('textbox', { name: 'Latitud' }), '3.4921');
      await usuario.type(screen.getByRole('textbox', { name: 'Longitud' }), '-76.4203');
      await usuario.click(boton('Guardar ubicación'));

      expect(api.registrarUbicacionPorVoz).toHaveBeenCalledWith(ID_CON_GPS, {
        direccion: 'Vía Cali–Palmira km 4',
        latitud: 3.4921,
        longitud: -76.4203,
      });
      expect(screen.queryByRole('textbox', { name: 'Dirección' })).toBeNull();
      expect(screen.getByText('Vía Cali–Palmira km 4')).toBeTruthy();
      expect(
        screen.getByText(/Indicada por voz · registrada por Diana Torres \d\d:\d\d/),
      ).toBeTruthy();
    });

    it('422 por campo: lo marca en el formulario', async () => {
      const { usuario } = await renderizar(de(SIN_GPS_EN_LLAMADA));
      api.registrarUbicacionPorVoz.mockReturnValue(
        falla('validation_failed', [{ campo: 'address', codigo: 'invalid_format' }]),
      );

      await usuario.type(screen.getByRole('textbox', { name: 'Dirección' }), 'Calle 1 # 2-3');
      await usuario.type(screen.getByRole('textbox', { name: 'Latitud' }), '4');
      await usuario.type(screen.getByRole('textbox', { name: 'Longitud' }), '-74');
      await usuario.click(boton('Guardar ubicación'));

      expect(screen.getByRole('textbox', { name: 'Dirección' }).getAttribute('aria-invalid')).toBe(
        'true',
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('409 location_from_app: avisa y relee', async () => {
      const { usuario } = await renderizar(de(SIN_GPS_EN_LLAMADA));
      api.registrarUbicacionPorVoz.mockReturnValue(falla('location_from_app'));
      api.consultarAsistencia.mockReturnValue(de(DETALLE_CON_SUGERENCIA_DTO));

      await usuario.type(screen.getByRole('textbox', { name: 'Dirección' }), 'Calle 1 # 2-3');
      await usuario.type(screen.getByRole('textbox', { name: 'Latitud' }), '4');
      await usuario.type(screen.getByRole('textbox', { name: 'Longitud' }), '-74');
      await usuario.click(boton('Guardar ubicación'));

      expect(avisoDeError()).toBe(
        'Esta solicitud ya tiene la ubicación del teléfono. La vista se actualizó.',
      );
      expect(screen.queryByRole('textbox', { name: 'Dirección' })).toBeNull();
    });

    it('«Corregir ubicación» abre el formulario con la dirección registrada', async () => {
      const { usuario } = await renderizar(de(DETALLE_UBICADA_POR_VOZ_DTO));

      await usuario.click(boton('Corregir ubicación'));

      expect((screen.getByRole('textbox', { name: 'Dirección' }) as HTMLInputElement).value).toBe(
        'Vía Cali–Palmira km 4',
      );
      await usuario.click(boton('Cancelar'));
      expect(screen.queryByRole('textbox', { name: 'Dirección' })).toBeNull();
    });
  });

  describe('despacho (S15, S17, CA-3)', () => {
    it('«Despachar prestador sugerido» confirma y despacha al sugerido', async () => {
      const { usuario } = await renderizar();

      await usuario.click(boton('Despachar prestador sugerido'));
      expect(
        screen.getByRole('heading', { name: '¿Despachar a Grúas Autopista Norte?' }),
      ).toBeTruthy();
      await usuario.click(boton('Confirmar despacho'));

      expect(api.despacharAsistencia).toHaveBeenCalledWith(ID_CON_GPS, 'prv-gruas-autopista-norte');
      expect(screen.getByRole('heading', { name: 'Prestador despachado' })).toBeTruthy();
      expect(screen.getByText('Despachada', { selector: 'app-insignia-estado' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cerrar solicitud' })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Prestadores cercanos' })).toBeNull();
    });

    it('otro elegible desde su fila', async () => {
      const { usuario } = await renderizar();

      await usuario.click(boton('Despachar a Auxilio Vial Norte'));
      await usuario.click(boton('Confirmar despacho'));

      expect(api.despacharAsistencia).toHaveBeenCalledWith(ID_CON_GPS, 'prv-auxilio-vial-norte');
    });

    it.each([
      [
        'provider_not_eligible',
        'Ese prestador ya no está disponible: revisa la sugerencia actualizada.',
      ],
      [
        'assistance_not_attended',
        'Atiende la solicitud antes de continuar. La vista se actualizó.',
      ],
      ['need_missing', 'Registra la necesidad antes de despachar. La vista se actualizó.'],
    ] as const)('%s: avisa, cierra el diálogo y relee', async (codigo, texto) => {
      const { usuario } = await renderizar();
      api.despacharAsistencia.mockReturnValue(falla(codigo));

      await usuario.click(boton('Despachar prestador sugerido'));
      await usuario.click(boton('Confirmar despacho'));

      expect(avisoDeError()).toBe(texto);
      expect((document.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
      expect(api.consultarAsistencia).toHaveBeenCalledTimes(2);
    });

    it('un error inesperado avisa sin releer', async () => {
      const { usuario } = await renderizar();
      api.despacharAsistencia.mockReturnValue(falla('assistance_unavailable'));

      await usuario.click(boton('Despachar prestador sugerido'));
      await usuario.click(boton('Confirmar despacho'));

      expect(avisoDeError()).toBe('No pudimos guardar el cambio. Intenta de nuevo.');
      expect(api.consultarAsistencia).toHaveBeenCalledTimes(1);
    });

    it('despachada: la tarjeta del prestador y el historial; sin acciones', async () => {
      await renderizar(de(DETALLE_AVISADA_DTO));
      await new Promise((resolver) => setTimeout(resolver));

      expect(screen.getByText(/^Aviso enviado al prestador · \d\d:\d\d$/)).toBeTruthy();
      expect(screen.getByText(/Andrés Ruiz despachó a Grúas Autopista Norte/)).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: /Atender|Cerrar solicitud|Despachar/ }),
      ).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Al despachar' })).toBeNull();
      expect(api.listarPrestadores).toHaveBeenCalledWith({ especialidad: 'towing' });
      expect(leaflet.capas.filter((c) => c.tipo === 'marker').map((c) => c.etiqueta)).toEqual([
        'Asegurado · ±8 m',
        'Grúas Autopista Norte · 0,9 km',
      ]);
    });

    it('sigue el aviso pendiente cada 5 s hasta que sale', async () => {
      vi.useFakeTimers();
      await renderizar(de(DETALLE_DESPACHADA_DTO));
      await vi.advanceTimersByTimeAsync(100);
      expect(screen.getByText('Enviando el despacho al prestador…')).toBeTruthy();

      api.consultarAsistencia.mockReturnValue(de(DETALLE_AVISADA_DTO));
      await vi.advanceTimersByTimeAsync(INTERVALO_AVISO_ASISTENCIA_MS);
      await vi.advanceTimersByTimeAsync(100);

      expect(screen.getByText(/^Aviso enviado al prestador/)).toBeTruthy();
      await vi.advanceTimersByTimeAsync(INTERVALO_AVISO_ASISTENCIA_MS * 3);
      expect(api.consultarAsistencia).toHaveBeenCalledTimes(2);
    });

    it('deja de seguirlo tras 12 lecturas y ofrece «Actualizar»', async () => {
      vi.useFakeTimers();
      await renderizar(de(DETALLE_DESPACHADA_DTO));

      await vi.advanceTimersByTimeAsync(
        INTERVALO_AVISO_ASISTENCIA_MS * (MAXIMO_LECTURAS_AVISO_ASISTENCIA + 2),
      );
      await vi.advanceTimersByTimeAsync(100);

      expect(api.consultarAsistencia).toHaveBeenCalledTimes(MAXIMO_LECTURAS_AVISO_ASISTENCIA + 1);
      expect(screen.getByText(/El aviso al prestador sigue pendiente/)).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Actualizar' })).toHaveLength(2);
    });

    it('no sigue leyendo después de salir', async () => {
      vi.useFakeTimers();
      const { vista } = await renderizar(de(DETALLE_DESPACHADA_DTO));
      await vi.advanceTimersByTimeAsync(100);

      vista.fixture.destroy();
      await vi.advanceTimersByTimeAsync(INTERVALO_AVISO_ASISTENCIA_MS * 3);

      expect(api.consultarAsistencia).toHaveBeenCalledTimes(1);
    });
  });

  describe('cierre por otro medio (S16, CA-4)', () => {
    it('«Cerrar solicitud» sin motivo no cierra y lleva el foco al motivo', async () => {
      const { usuario } = await renderizar(de(DETALLE_NUEVA_DTO));

      await usuario.click(boton('Cerrar solicitud'));

      expect(api.cerrarAsistencia).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(
        screen.getByRole('combobox', { name: 'Motivo de la resolución' }),
      );
    });

    it('cierra desde una nueva con el motivo y muestra el cierre registrado', async () => {
      const { usuario } = await renderizar(de(DETALLE_NUEVA_DTO));

      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Motivo de la resolución' }),
        'resolved_by_phone',
      );
      await usuario.click(boton('Cerrar solicitud'));

      expect(api.cerrarAsistencia).toHaveBeenCalledWith(ID_CON_GPS, {
        motivo: 'resolved_by_phone',
      });
      const cerrada = within(
        screen
          .getByRole('heading', { name: 'Solicitud cerrada' })
          .closest('section') as HTMLElement,
      );
      expect(cerrada.getByText('Resuelto durante la llamada')).toBeTruthy();
      expect(cerrada.getByText(/^\d\d\/\d\d\/2026, \d\d:\d\d por Andrés Ruiz$/)).toBeTruthy();
      expect(screen.queryByRole('form', { name: 'Cerrar por otro medio' })).toBeNull();
      expect(api.despacharAsistencia).not.toHaveBeenCalled();
    });

    it('con «Otro» envía la nota; el 422 por campo se marca en el formulario', async () => {
      const { usuario } = await renderizar();
      api.cerrarAsistencia.mockReturnValue(
        falla('validation_failed', [{ campo: 'note', codigo: 'invalid_format' }]),
      );

      await usuario.selectOptions(
        screen.getByRole('combobox', { name: 'Motivo de la resolución' }),
        'other',
      );
      await usuario.type(screen.getByRole('textbox', { name: /^Nota/ }), 'Le pasaron corriente');
      await usuario.click(boton('Cerrar solicitud'));

      expect(api.cerrarAsistencia).toHaveBeenCalledWith(ID_CON_GPS, {
        motivo: 'other',
        nota: 'Le pasaron corriente',
      });
      expect(screen.getByText('La nota tiene caracteres no permitidos.')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('cerrada: el motivo, la nota, quién y cuándo; sin acciones ni prestadores', async () => {
      await renderizar(
        de(
          detalleCon(DETALLE_CERRADA_DTO, {
            closure: {
              reason: 'other',
              note: 'Ya llegó la grúa',
              closed_by: { email: PROPIO, name: 'Andrés Ruiz' },
              closed_at: '2026-11-21T16:16:20.620241Z',
            },
          }),
        ),
      );

      expect(screen.getByText('Cerrada', { selector: 'app-insignia-estado' })).toBeTruthy();
      expect(screen.getByText('Otro')).toBeTruthy();
      expect(screen.getByText('Ya llegó la grúa')).toBeTruthy();
      expect(screen.getByText('Inmueble')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Atender|Cerrar solicitud/ })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Prestadores cercanos' })).toBeNull();
      expect(screen.queryByRole('heading', { name: /Llamada/ })).toBeNull();
    });
  });
});
