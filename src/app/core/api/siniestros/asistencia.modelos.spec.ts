import { HttpErrorResponse } from '@angular/common/http';
import {
  BANDEJA_DTO,
  BANDEJA_SIN_DESPACHOS_DTO,
  DETALLE_AVISADA_DTO,
  DETALLE_CERRADA_DTO,
  DETALLE_CON_SUGERENCIA_DTO,
  DETALLE_DESPACHADA_DTO,
  DETALLE_SIN_GPS_DTO,
  DETALLE_UBICADA_POR_VOZ_DTO,
  POLITICA_ASISTENCIA_DTO,
  detalleCon,
} from '@testing/asistencia-pruebas';

import {
  CodigoErrorAsistencia,
  ErrorAsistencia,
  aCierreDto,
  mapearBandeja,
  mapearDetalleAsistencia,
  mapearPoliticaAsistencia,
  traducirErrorAsistencia,
} from './asistencia.modelos';

describe('asistencia.modelos (HU-W2.3-03)', () => {
  describe('bandeja', () => {
    it('mapea los indicadores y las filas en el orden del contrato', () => {
      const bandeja = mapearBandeja(BANDEJA_DTO);

      expect(bandeja.resumen).toEqual({
        nuevas: 2,
        enLlamada: 1,
        despachadasHoy: 6,
        tiempoMedioDespachoSegundos: 220,
        objetivoDespachoSegundos: 300,
      });
      expect(bandeja.solicitudes.map((s) => [s.numero, s.estado])).toEqual([
        ['AST-2026-0003', 'closed'],
        ['AST-2026-0002', 'in_call'],
        ['AST-2026-0001', 'new'],
        ['AST-2026-0005', 'new'],
        ['AST-2026-0004', 'dispatched'],
      ]);
    });

    it('conserva el tiempo medio nulo cuando hoy no hubo despachos', () => {
      expect(
        mapearBandeja(BANDEJA_SIN_DESPACHOS_DTO).resumen.tiempoMedioDespachoSegundos,
      ).toBeNull();
    });

    it('mapea la ubicación del teléfono con sus coordenadas, su precisión y el lugar', () => {
      const [, conGps] = mapearBandeja(BANDEJA_SIN_DESPACHOS_DTO).solicitudes;

      expect(conGps.ubicacion).toEqual({
        estado: 'sent',
        latitud: 4.7712,
        longitud: -74.0452,
        precisionM: 8,
        capturadaEn: '2026-11-21T16:16:04Z',
        motivoSinUbicacion: null,
        lugar: 'Autopista Norte km 12, Bogotá',
        voz: null,
      });
      expect(conGps.poliza).toEqual({
        polizaId: 'AU-2026-868766',
        linea: 'auto',
        producto: 'Autos',
        objetoAsegurado: 'IZJ-766',
      });
      expect(conGps.atendidaPor).toBeNull();
    });

    it('mapea una solicitud sin GPS con su motivo y, si ya la hay, la ubicación por voz', () => {
      const [, enLlamada] = mapearBandeja(BANDEJA_DTO).solicitudes;

      expect(enLlamada.ubicacion.estado).toBe('unavailable');
      expect(enLlamada.ubicacion.latitud).toBeNull();
      expect(enLlamada.ubicacion.motivoSinUbicacion).toBe('no_fix');
      expect(enLlamada.ubicacion.voz).toEqual({
        direccion: 'Vía Cali–Palmira km 4',
        latitud: 3.4921,
        longitud: -76.4203,
        registradaPor: { correo: 'operaciones.turno2.local@example.com', nombre: 'Diana Torres' },
        registradaEn: '2026-11-21T16:16:11.513872Z',
      });
      expect(enLlamada.atendidaPor?.nombre).toBe('Diana Torres');
    });

    it('acepta un solicitante sin nombre', () => {
      const dto = {
        ...BANDEJA_SIN_DESPACHOS_DTO,
        items: [{ ...BANDEJA_SIN_DESPACHOS_DTO.items[0], requester_name: null }],
      };

      expect(mapearBandeja(dto).solicitudes[0].solicitante).toBeNull();
    });
  });

  describe('detalle', () => {
    it('mapea la necesidad, la sugerencia con todos los candidatos y el historial', () => {
      const detalle = mapearDetalleAsistencia(DETALLE_CON_SUGERENCIA_DTO);

      expect(detalle.estado).toBe('in_call');
      expect(detalle.necesidad).toEqual({
        codigo: 'towing',
        especialidad: 'towing',
        registradaPor: { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' },
        registradaEn: '2026-11-21T16:16:11.309446Z',
      });
      expect(detalle.sugerencia.estado).toBe('found');
      expect(detalle.sugerencia.fuenteUbicacion).toBe('app');
      expect(detalle.sugerencia.radioKm).toBe(5);
      expect(detalle.sugerencia.intentos).toEqual([
        { radioKm: 5, elegibles: 2, intentadoEn: '2026-11-21T16:16:11.311729385Z' },
      ]);
      expect(
        detalle.sugerencia.candidatos.map((c) => [
          c.prestadorId,
          c.elegibilidad,
          c.sugerido,
          c.llegadaMinutos,
        ]),
      ).toEqual([
        ['prv-gruas-autopista-norte', 'eligible', true, 12],
        ['prv-auxilio-vial-norte', 'eligible', false, 15],
        ['prv-gruas-calle-80', 'out_of_radius', false, 30],
        ['prv-gruas-del-valle', 'out_of_radius', false, 606],
      ]);
      expect(detalle.sugerencia.candidatos[0].despachadosHoy).toBe(0);
      expect(detalle.historial).toEqual([
        {
          accion: 'attended',
          por: { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' },
          en: '2026-11-21T16:16:11.220159Z',
          detalle: null,
        },
        {
          accion: 'need_recorded',
          por: { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' },
          en: '2026-11-21T16:16:11.309446Z',
          detalle: { need: 'towing' },
        },
      ]);
      expect(detalle.despacho).toBeNull();
      expect(detalle.cierre).toBeNull();
    });

    it('mapea una sugerencia sin búsqueda (falta la ubicación)', () => {
      const detalle = mapearDetalleAsistencia(DETALLE_SIN_GPS_DTO);

      expect(detalle.sugerencia).toEqual({
        estado: 'location_missing',
        especialidad: null,
        fuenteUbicacion: null,
        desdeRadioKm: null,
        radioKm: null,
        motivo: null,
        versionPolitica: 'assignment-policy-v1',
        intentos: [],
        candidatos: [],
      });
      expect(detalle.necesidad).toBeNull();
      expect(detalle.historial).toEqual([]);
    });

    it('mapea la toma de otro analista y la sugerencia desde la ubicación por voz', () => {
      const detalle = mapearDetalleAsistencia(DETALLE_UBICADA_POR_VOZ_DTO);

      expect(detalle.sugerencia.fuenteUbicacion).toBe('voice');
      expect(detalle.historial.map((a) => [a.accion, a.por.nombre, a.detalle])).toEqual([
        ['attended', 'Andrés Ruiz', null],
        ['taken_over', 'Diana Torres', { from: 'operaciones.local@example.com' }],
        ['need_recorded', 'Diana Torres', { need: 'towing' }],
        ['voice_location_recorded', 'Diana Torres', null],
      ]);
    });

    it('mapea el despacho con el prestador, la ubicación compartida y el aviso', () => {
      const detalle = mapearDetalleAsistencia(DETALLE_DESPACHADA_DTO);

      expect(detalle.estado).toBe('dispatched');
      expect(detalle.despachadaEn).toBe('2026-11-21T16:16:11.606015Z');
      expect(detalle.sugerencia.estado).toBe('not_applicable');
      expect(detalle.despacho).toEqual({
        prestador: {
          id: 'prv-gruas-autopista-norte',
          nombre: 'Grúas Autopista Norte',
          correo: 'despachos@gruasautopistanorte.example.com',
          telefono: '+576015550301',
        },
        necesidad: 'towing',
        especialidad: 'towing',
        distanciaKm: 0.9,
        llegadaMinutos: 12,
        ubicacionCompartida: {
          fuente: 'app',
          latitud: 4.7712,
          longitud: -74.0452,
          precisionM: 8,
          direccion: null,
          lugar: 'Autopista Norte km 12, Bogotá',
        },
        prestadorSugeridoId: 'prv-gruas-autopista-norte',
        despachadaPor: { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' },
        despachadaEn: '2026-11-21T16:16:11.606015Z',
        versionesPolitica: {
          asistencia: 'assistance-policy-v1',
          asignacion: 'assignment-policy-v1',
        },
        aviso: { estado: 'pending', intentos: 0, enviadoEn: null },
      });
      expect(mapearDetalleAsistencia(DETALLE_AVISADA_DTO).despacho?.aviso).toEqual({
        estado: 'sent',
        intentos: 1,
        enviadoEn: '2026-11-21T16:16:12.4Z',
      });
    });

    it('mapea el cierre desde `new`, sin analista que la atendiera', () => {
      const detalle = mapearDetalleAsistencia(DETALLE_CERRADA_DTO);

      expect(detalle.estado).toBe('closed');
      expect(detalle.atendidaPor).toBeNull();
      expect(detalle.cierre).toEqual({
        motivo: 'resolved_by_phone',
        nota: null,
        cerradaPor: { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' },
        cerradaEn: '2026-11-21T16:16:20.620241Z',
      });
    });

    it('conserva los códigos que todavía no conoce', () => {
      const detalle = mapearDetalleAsistencia(
        detalleCon(DETALLE_CON_SUGERENCIA_DTO, {
          need: { ...DETALLE_CON_SUGERENCIA_DTO.need!, code: 'winch', specialty: 'heavy_towing' },
          history: [
            {
              action: 'escalated',
              by: { email: 'x@example.com', name: null },
              at: 'a',
              detail: { to: 'y' },
            },
          ],
        }),
      );

      expect(detalle.necesidad?.codigo).toBe('winch');
      expect(detalle.necesidad?.especialidad).toBe('heavy_towing');
      expect(detalle.historial[0]).toEqual({
        accion: 'escalated',
        por: { correo: 'x@example.com', nombre: null },
        en: 'a',
        detalle: { to: 'y' },
      });
    });
  });

  it('mapea la política con las necesidades por línea y los motivos de cierre', () => {
    expect(mapearPoliticaAsistencia(POLITICA_ASISTENCIA_DTO)).toEqual({
      version: 'assistance-policy-v1',
      necesidades: [
        { linea: 'auto', codigo: 'towing', especialidad: 'towing' },
        { linea: 'auto', codigo: 'battery', especialidad: 'roadside_assistance' },
        { linea: 'auto', codigo: 'flat_tire', especialidad: 'roadside_assistance' },
        { linea: 'auto', codigo: 'fuel', especialidad: 'roadside_assistance' },
        { linea: 'auto', codigo: 'vehicle_lockout', especialidad: 'roadside_assistance' },
        { linea: 'home', codigo: 'plumbing_emergency', especialidad: 'plumbing' },
      ],
      radiosKm: [5, 10, 20],
      versionPoliticaAsignacion: 'assignment-policy-v1',
      llegada: { alistamientoMinutos: 10, velocidadMediaKmh: 30 },
      motivosCierre: [
        'resolved_by_phone',
        'duplicate',
        'cancelled_by_insured',
        'not_covered',
        'no_provider_available',
        'other',
      ],
      objetivoDespachoSegundos: 300,
    });
  });

  describe('aCierreDto', () => {
    it('envía solo el motivo si no hay nota', () => {
      expect(aCierreDto({ motivo: 'resolved_by_phone' })).toEqual({ reason: 'resolved_by_phone' });
      expect(aCierreDto({ motivo: 'duplicate', nota: '   ' })).toEqual({ reason: 'duplicate' });
    });

    it('envía la nota sin espacios alrededor', () => {
      expect(aCierreDto({ motivo: 'other', nota: '  Le pasaron corriente  ' })).toEqual({
        reason: 'other',
        note: 'Le pasaron corriente',
      });
    });
  });

  describe('traducirErrorAsistencia', () => {
    const conCuerpo = (status: number, cuerpo: unknown) =>
      traducirErrorAsistencia(new HttpErrorResponse({ status, error: cuerpo }));

    it.each<[number, CodigoErrorAsistencia]>([
      [400, 'invalid_request'],
      [404, 'assistance_request_not_found'],
      [409, 'assistance_not_open'],
      [409, 'assistance_not_attended'],
      [409, 'location_from_app'],
      [422, 'need_not_for_line'],
      [422, 'need_missing'],
      [422, 'location_missing'],
      [422, 'provider_not_eligible'],
      [422, 'validation_failed'],
      [503, 'assistance_unavailable'],
    ])('reconoce el código %s %s del contrato', (status, codigo) => {
      const error = conCuerpo(status, { error: codigo, message: 'x' });

      expect(error).toBeInstanceOf(ErrorAsistencia);
      expect(error.codigo).toBe(codigo);
      expect(error.campos).toEqual([]);
    });

    it('lee los campos de validation_failed y descarta los que no tienen forma', () => {
      const error = conCuerpo(422, {
        error: 'validation_failed',
        message: 'x',
        fields: [
          { field: 'note', code: 'required' },
          { field: 1 },
          null,
          { field: 'reason', code: 'invalid_format' },
        ],
      });

      expect(error.campos).toEqual([
        { campo: 'note', codigo: 'required' },
        { campo: 'reason', codigo: 'invalid_format' },
      ]);
    });

    it.each<[number, CodigoErrorAsistencia]>([
      [400, 'invalid_request'],
      [404, 'assistance_request_not_found'],
      [500, 'assistance_unavailable'],
      [503, 'assistance_unavailable'],
      [0, 'assistance_unavailable'],
    ])('sin un código del contrato decide por el estado %s', (status, codigo) => {
      expect(conCuerpo(status, null).codigo).toBe(codigo);
      expect(conCuerpo(status, { error: 'otro_codigo' }).codigo).toBe(codigo);
    });

    it('un error que no es HTTP es «no disponible»', () => {
      expect(traducirErrorAsistencia(new Error('x')).codigo).toBe('assistance_unavailable');
    });
  });
});
