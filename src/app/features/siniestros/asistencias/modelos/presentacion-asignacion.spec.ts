import {
  AsignacionSiniestro,
  Candidato,
  mapearAsignacionSiniestro,
  mapearPoliticaAsignacion,
} from '@core/api/siniestros/asignacion.modelos';
import {
  ASIGNACION_ASIGNADA_DTO,
  ASIGNACION_LISTA_DTO,
  ASIGNACION_PENDIENTE_DTO,
  ASIGNACION_PROPUESTA_DTO,
  ASIGNACION_SIN_UBICACION_DTO,
  ASIGNACION_SIN_VISITA_DTO,
  ASIGNACION_UBICADA_POR_ANALISTA_DTO,
  POLITICA_ASIGNACION_DTO,
} from '@testing/asignacion-pruebas';

import {
  aFechaLocal,
  accionesDisponibles,
  coordenadaATexto,
  etiquetaDisponibilidad,
  fechaLocal,
  formatearCoordenadas,
  leerCoordenada,
  nombreEspecialidad,
  nombreMotivo,
  nombresEspecialidades,
  radioSiguiente,
  validarUbicacion,
} from './presentacion-asignacion';

const POLITICA = mapearPoliticaAsignacion(POLITICA_ASIGNACION_DTO);
const t = (clave: string) => `<${clave}>`;
const asignacion = (dto: Parameters<typeof mapearAsignacionSiniestro>[0]): AsignacionSiniestro =>
  mapearAsignacionSiniestro(dto);

describe('presentacion-asignacion (HU-W2.3-01)', () => {
  describe('traducción por código con respaldo (F6)', () => {
    it('traduce las especialidades conocidas y deja crudas las nuevas', () => {
      expect(nombreEspecialidad(t, 'plumbing')).toBe('<especialidades.plumbing>');
      expect(nombreEspecialidad(t, 'towing')).toBe('towing');
      expect(nombresEspecialidades(t, ['plumbing', 'towing'])).toBe(
        '<especialidades.plumbing> · towing',
      );
      expect(nombresEspecialidades(t, [])).toBe('');
    });

    it('traduce el motivo y tolera uno nuevo o ninguno', () => {
      expect(nombreMotivo(t, 'no_eligible_provider_within_max_radius')).toBe(
        '<asignacion.motivos.no_eligible_provider_within_max_radius>',
      );
      expect(nombreMotivo(t, 'otro_motivo')).toBe('otro_motivo');
      expect(nombreMotivo(t, null)).toBe('');
    });
  });

  describe('etiquetaDisponibilidad (S7, P8 y P9)', () => {
    const base: Candidato = {
      prestadorId: 'prv-x',
      nombre: 'X',
      especialidades: ['plumbing'],
      distanciaKm: 1,
      disponibilidad: 'unavailable',
      noDisponibleHasta: null,
      elegibilidad: 'unavailable',
      sugerido: false,
    };
    const HOY = '2026-09-06';

    it.each([
      [{ elegibilidad: 'eligible', disponibilidad: 'available' }, 'disponibleHoy', 'exito'],
      [{ elegibilidad: 'out_of_radius', disponibilidad: 'available' }, 'fueraDelRadio', 'neutro'],
      [{ disponibilidad: 'busy' }, 'enOtroCaso', 'error'],
      [{ noDisponibleHasta: '2026-09-07' }, 'disponibleManana', 'advertencia'],
      [{ noDisponibleHasta: '2026-09-08' }, 'noDisponibleHasta', 'error'],
      [{ noDisponibleHasta: '2026-09-06' }, 'noDisponibleHasta', 'error'],
      [{}, 'noDisponible', 'error'],
    ] as const)('%o → %s', (cambios, clave, tono) => {
      const etiqueta = etiquetaDisponibilidad({ ...base, ...cambios }, HOY);
      expect(etiqueta.clave).toBe(clave);
      expect(etiqueta.tono).toBe(tono);
    });

    it('calcula «mañana» al cruzar el mes y el año', () => {
      expect(
        etiquetaDisponibilidad({ ...base, noDisponibleHasta: '2026-10-01' }, '2026-09-30').clave,
      ).toBe('disponibleManana');
      expect(
        etiquetaDisponibilidad({ ...base, noDisponibleHasta: '2027-01-01' }, '2026-12-31').clave,
      ).toBe('disponibleManana');
    });

    it('lleva la fecha para «No disponible · hasta …»', () => {
      expect(etiquetaDisponibilidad({ ...base, noDisponibleHasta: '2026-09-22' }, HOY).hasta).toBe(
        '2026-09-22',
      );
    });
  });

  it('fechaLocal arma YYYY-MM-DD con ceros', () => {
    expect(fechaLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('aFechaLocal lee la fecha del contrato sin correrla por la zona horaria', () => {
    const fecha = aFechaLocal('2026-09-22');
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours()]).toEqual([
      2026, 8, 22, 0,
    ]);
  });

  describe('radioSiguiente (S6)', () => {
    it.each([
      [5, 10],
      [10, 20],
      [20, null],
      [7, 10],
      [25, null],
      [0, 5],
    ])('desde %i km → %s', (actual, siguiente) => {
      expect(radioSiguiente(POLITICA, actual)).toBe(siguiente);
    });
  });

  describe('accionesDisponibles (S5, S6)', () => {
    it('ready: solo «Buscar prestador»', () => {
      const acciones = accionesDisponibles(asignacion(ASIGNACION_LISTA_DTO), POLITICA);
      expect(acciones.buscar).toBe(true);
      expect(acciones.reintentar).toBe(false);
      expect(acciones.ampliar.visible).toBe(false);
      expect(acciones.sugerido).toBeNull();
      expect(acciones.corregirUbicacion).toBe(false);
    });

    it('proposed: ampliar a 10 km y el sugerido elegible', () => {
      const acciones = accionesDisponibles(asignacion(ASIGNACION_PROPUESTA_DTO), POLITICA);
      expect(acciones.ampliar).toEqual({ visible: true, radio: 10, motivo: null });
      expect(acciones.sugerido?.nombre).toBe('Servicios Hogar Norte');
      expect(acciones.buscar).toBe(false);
    });

    it('proposed en 20 km: ampliar deshabilitado por el radio máximo', () => {
      const dto = { ...ASIGNACION_PROPUESTA_DTO };
      dto.last_search = { ...ASIGNACION_PROPUESTA_DTO.last_search!, radius_km: 20 };
      expect(accionesDisponibles(asignacion(dto), POLITICA).ampliar).toEqual({
        visible: true,
        radio: null,
        motivo: 'radioMaximo',
      });
    });

    it('pending_assignment: reintentar, sin sugerido y ampliar deshabilitado', () => {
      const acciones = accionesDisponibles(asignacion(ASIGNACION_PENDIENTE_DTO), POLITICA);
      expect(acciones.reintentar).toBe(true);
      expect(acciones.sugerido).toBeNull();
      expect(acciones.ampliar.motivo).toBe('radioMaximo');
    });

    it('sin política, ampliar queda deshabilitado con su motivo', () => {
      expect(accionesDisponibles(asignacion(ASIGNACION_PROPUESTA_DTO), null).ampliar).toEqual({
        visible: true,
        radio: null,
        motivo: 'sinPolitica',
      });
    });

    it('un sugerido no elegible no se ofrece', () => {
      const dto = { ...ASIGNACION_PROPUESTA_DTO };
      dto.last_search = {
        ...ASIGNACION_PROPUESTA_DTO.last_search!,
        candidates: ASIGNACION_PROPUESTA_DTO.last_search!.candidates.map((c) => ({
          ...c,
          eligibility: 'unavailable' as const,
        })),
      };
      expect(accionesDisponibles(asignacion(dto), POLITICA).sugerido).toBeNull();
    });

    it('corregir la ubicación solo si la registró el analista y no hay asignación', () => {
      expect(
        accionesDisponibles(asignacion(ASIGNACION_UBICADA_POR_ANALISTA_DTO), POLITICA)
          .corregirUbicacion,
      ).toBe(true);
      expect(
        accionesDisponibles(asignacion(ASIGNACION_PROPUESTA_DTO), POLITICA).corregirUbicacion,
      ).toBe(false);
      expect(
        accionesDisponibles(
          asignacion({
            ...ASIGNACION_ASIGNADA_DTO,
            location: ASIGNACION_UBICADA_POR_ANALISTA_DTO.location,
          }),
          POLITICA,
        ).corregirUbicacion,
      ).toBe(false);
    });

    it.each([ASIGNACION_SIN_UBICACION_DTO, ASIGNACION_SIN_VISITA_DTO, ASIGNACION_ASIGNADA_DTO])(
      'sin acciones de búsqueda en %#',
      (dto) => {
        const acciones = accionesDisponibles(asignacion(dto), POLITICA);
        expect([
          acciones.buscar,
          acciones.reintentar,
          acciones.ampliar.visible,
          acciones.sugerido,
        ]).toEqual([false, false, false, null]);
      },
    );
  });

  describe('formatearCoordenadas (S12)', () => {
    it('usa el separador decimal y los hemisferios del idioma', () => {
      expect(formatearCoordenadas(t, 4.6771, -74.0483, 'es-CO')).toBe(
        '4,6771 <mapa.hemisferios.norte> · 74,0483 <mapa.hemisferios.oeste>',
      );
      expect(formatearCoordenadas(t, -33.45, 151.2, 'en-US')).toBe(
        '33.4500 <mapa.hemisferios.sur> · 151.2000 <mapa.hemisferios.este>',
      );
      expect(formatearCoordenadas(t, 0, 0, 'en-US')).toBe(
        '0.0000 <mapa.hemisferios.norte> · 0.0000 <mapa.hemisferios.este>',
      );
    });
  });

  describe('coordenadas escritas', () => {
    it.each([
      ['4.6771', 4.6771],
      ['-74,0483', -74.0483],
      [' 90 ', 90],
      ['4', 4],
      ['4.', null],
      ['1e3', null],
      ['4.6.7', null],
      ['1.000,5', null],
      ['abc', null],
      ['', null],
    ])('%j → %s', (texto, valor) => {
      expect(leerCoordenada(texto)).toBe(valor);
    });

    it('lleva el pin a 6 decimales con punto', () => {
      expect(coordenadaATexto(4.67712345)).toBe('4.677123');
      expect(coordenadaATexto(-74)).toBe('-74.000000');
    });
  });

  describe('validarUbicacion (S3, valores límite)', () => {
    const valida = { direccion: 'Carrera 15 # 93-40', latitud: '4.6771', longitud: '-74.0483' };

    it('arma la solicitud sin espacios alrededor de la dirección', () => {
      expect(validarUbicacion({ ...valida, direccion: '  Carrera 15 # 93-40  ' })).toEqual({
        problemas: {},
        solicitud: { direccion: 'Carrera 15 # 93-40', latitud: 4.6771, longitud: -74.0483 },
      });
    });

    it.each([
      ['', 'requerido'],
      ['   ', 'requerido'],
      ['abcd', 'longitud'],
      ['abcde', undefined],
      [' abcd ', 'longitud'],
      ['a'.repeat(200), undefined],
      ['a'.repeat(201), 'longitud'],
    ])('dirección %j → %s', (direccion, problema) => {
      expect(validarUbicacion({ ...valida, direccion }).problemas.direccion).toBe(problema);
    });

    it.each([
      ['-90', undefined],
      ['90', undefined],
      ['-90.0001', 'rango'],
      ['90.0001', 'rango'],
      ['', 'requerido'],
      ['norte', 'formato'],
    ])('latitud %j → %s', (latitud, problema) => {
      expect(validarUbicacion({ ...valida, latitud }).problemas.latitud).toBe(problema);
    });

    it.each([
      ['-180', undefined],
      ['180', undefined],
      ['-180.0001', 'rango'],
      ['180,5', 'rango'],
      ['', 'requerido'],
    ])('longitud %j → %s', (longitud, problema) => {
      expect(validarUbicacion({ ...valida, longitud }).problemas.longitud).toBe(problema);
    });

    it('informa todos los problemas a la vez y no arma la solicitud', () => {
      expect(validarUbicacion({ direccion: '', latitud: '91', longitud: 'x' })).toEqual({
        problemas: { direccion: 'requerido', latitud: 'rango', longitud: 'formato' },
        solicitud: null,
      });
    });
  });
});
