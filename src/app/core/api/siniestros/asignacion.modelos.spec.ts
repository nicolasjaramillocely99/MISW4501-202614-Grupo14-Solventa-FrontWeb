import { HttpErrorResponse } from '@angular/common/http';
import {
  ASIGNACION_ASIGNADA_DTO,
  ASIGNACION_AVISADA_DTO,
  ASIGNACION_PENDIENTE_DTO,
  ASIGNACION_PROPUESTA_DTO,
  ASIGNACION_SIN_UBICACION_DTO,
  ASIGNACION_UBICADA_POR_ANALISTA_DTO,
  LOTE_ASIGNACIONES_DTO,
  POLITICA_ASIGNACION_DTO,
  PRESTADORES_DTO,
} from '@testing/asignacion-pruebas';

import {
  ErrorAsignacion,
  aDisponibilidadDto,
  aUbicacionDto,
  mapearAsignacionSiniestro,
  mapearListaPrestadores,
  mapearPaginaAsignaciones,
  mapearPoliticaAsignacion,
  traducirErrorAsignacion,
} from './asignacion.modelos';

describe('asignacion.modelos (HU-W2.3-01)', () => {
  it('mapea la búsqueda propuesta con el sugerido, los no elegibles y los intentos', () => {
    const a = mapearAsignacionSiniestro(ASIGNACION_PROPUESTA_DTO);

    expect(a.estado).toBe('proposed');
    expect(a.numeroRadicado).toBe('SIN-2026-01655');
    expect(a.ubicacion).toEqual({
      fuente: 'app',
      latitud: 4.6771,
      longitud: -74.0483,
      precisionM: 8,
      direccion: null,
      registradaPor: null,
      registradaEn: '2026-09-06T14:52:10Z',
    });
    expect(a.ultimaBusqueda?.secuencia).toBe(1);
    expect(a.ultimaBusqueda?.buscadaPor).toEqual({
      correo: 'andres.ruiz@solventa.example',
      nombre: 'Andrés Ruiz',
    });
    expect(a.ultimaBusqueda?.intentos).toEqual([
      { radioKm: 5, elegibles: 1, intentadoEn: '2026-09-06T15:14:02Z' },
    ]);
    expect(a.ultimaBusqueda?.candidatos.map((c) => [c.nombre, c.elegibilidad, c.sugerido])).toEqual(
      [
        ['Servicios Hogar Norte', 'eligible', true],
        ['Reparaciones Chapinero', 'unavailable', false],
        ['Técnicos Unidos', 'out_of_radius', false],
      ],
    );
    expect(a.ultimaBusqueda?.candidatos[1].noDisponibleHasta).toBe('2026-09-07');
    expect(a.asignacion).toBeNull();
  });

  it('mapea el pendiente de asignación con el motivo y los tres intentos', () => {
    const busqueda = mapearAsignacionSiniestro(ASIGNACION_PENDIENTE_DTO).ultimaBusqueda;

    expect(busqueda?.resultado).toBe('exhausted');
    expect(busqueda?.motivo).toBe('no_eligible_provider_within_max_radius');
    expect(busqueda?.intentos.map((i) => i.radioKm)).toEqual([5, 10, 20]);
    expect(busqueda?.candidatos[0].disponibilidad).toBe('busy');
  });

  it('mapea la asignación con el aviso pendiente y enviado', () => {
    const asignada = mapearAsignacionSiniestro(ASIGNACION_ASIGNADA_DTO).asignacion;
    expect(asignada?.prestador).toEqual({
      id: 'prv-servicios-hogar-norte',
      nombre: 'Servicios Hogar Norte',
      correo: 'despachos@hogarnorte.example.com',
      telefono: '+576015550102',
    });
    expect(asignada?.ubicacionCompartida.precisionM).toBe(8);
    expect(asignada?.aviso).toEqual({ estado: 'pending', intentos: 0, enviadoEn: null });

    expect(mapearAsignacionSiniestro(ASIGNACION_AVISADA_DTO).asignacion?.aviso.estado).toBe('sent');
  });

  it('mapea el caso sin ubicación y la ubicación que registró el analista', () => {
    expect(mapearAsignacionSiniestro(ASIGNACION_SIN_UBICACION_DTO).ubicacion).toBeNull();

    const ubicacion = mapearAsignacionSiniestro(ASIGNACION_UBICADA_POR_ANALISTA_DTO).ubicacion;
    expect(ubicacion?.fuente).toBe('analyst');
    expect(ubicacion?.precisionM).toBeNull();
    expect(ubicacion?.direccion).toBe('Carrera 15 # 93-40, apto 402, Bogotá');
    expect(ubicacion?.registradaPor?.nombre).toBe('Andrés Ruiz');
  });

  it('conserva una especialidad que el front no conoce', () => {
    const a = mapearAsignacionSiniestro({ ...ASIGNACION_PROPUESTA_DTO, specialty: 'towing' });
    expect(a.especialidad).toBe('towing');
  });

  it('mapea el lote en el orden pedido, con el id inexistente', () => {
    expect(
      mapearPaginaAsignaciones(LOTE_ASIGNACIONES_DTO).map((r) => [r.estado, r.nombrePrestador]),
    ).toEqual([
      ['assigned', 'Servicios Hogar Norte'],
      ['pending_assignment', null],
      ['not_found', null],
    ]);
  });

  it('mapea la política y los prestadores', () => {
    const politica = mapearPoliticaAsignacion(POLITICA_ASIGNACION_DTO);
    expect(politica.radiosKm).toEqual([5, 10, 20]);
    expect(politica.radioMaximoKm).toBe(20);
    expect(politica.intervaloReintentoSegundos).toBe(300);
    expect(
      politica.especialidades.find((e) => e.tipoSiniestro === 'theft')?.especialidad,
    ).toBeNull();

    const prestadores = mapearListaPrestadores({ items: PRESTADORES_DTO });
    expect(prestadores[0].actualizadoPor).toBe('reference-data');
    expect(prestadores[2].ocupadoEnSiniestroId).toBe('0b5c2d9e-3a41-4f6e-9c1d-7e2f8a9b0c11');
    expect(prestadores[1].telefono).toBeNull();
  });

  it('arma los cuerpos de la ubicación y de la disponibilidad', () => {
    expect(
      aUbicacionDto({ direccion: '  Carrera 15 # 93-40  ', latitud: 4.6771, longitud: -74.0483 }),
    ).toEqual({
      address: 'Carrera 15 # 93-40',
      latitude: 4.6771,
      longitude: -74.0483,
    });
    expect(aDisponibilidadDto({ disponibilidad: 'available' })).toEqual({
      availability: 'available',
    });
    expect(aDisponibilidadDto({ disponibilidad: 'unavailable' })).toEqual({
      availability: 'unavailable',
    });
    expect(aDisponibilidadDto({ disponibilidad: 'unavailable', hasta: '2026-09-22' })).toEqual({
      availability: 'unavailable',
      unavailable_until: '2026-09-22',
    });
    // La fecha solo acompaña a «no disponible».
    expect(aDisponibilidadDto({ disponibilidad: 'available', hasta: '2026-09-22' })).toEqual({
      availability: 'available',
    });
  });

  describe('traducirErrorAsignacion', () => {
    const conCuerpo = (status: number, cuerpo: unknown) =>
      new HttpErrorResponse({ status, error: cuerpo });

    it.each([
      [409, 'location_from_app'],
      [409, 'assignment_exists'],
      [409, 'claim_not_assignable'],
      [409, 'provider_unavailable'],
      [409, 'search_outdated'],
      [422, 'location_missing'],
      [422, 'provider_not_eligible'],
      [404, 'provider_not_found'],
      [404, 'claim_not_found'],
      [400, 'invalid_request'],
      [503, 'claims_unavailable'],
    ])('reconoce el %i %s', (status, codigo) => {
      expect(
        traducirErrorAsignacion(conCuerpo(status, { error: codigo, message: 'x' })).codigo,
      ).toBe(codigo);
    });

    it('lee todos los campos de validation_failed y descarta los mal formados', () => {
      const error = traducirErrorAsignacion(
        conCuerpo(422, {
          error: 'validation_failed',
          message: 'x',
          fields: [
            { field: 'latitude', code: 'out_of_range' },
            { field: 'address', code: 'required' },
            { field: 3, code: 'required' },
            null,
          ],
        }),
      );
      expect(error.codigo).toBe('validation_failed');
      expect(error.campos).toEqual([
        { campo: 'latitude', codigo: 'out_of_range' },
        { campo: 'address', codigo: 'required' },
      ]);
    });

    it('decide por el estado sin cuerpo reconocible', () => {
      expect(traducirErrorAsignacion(conCuerpo(400, null)).codigo).toBe('invalid_request');
      expect(traducirErrorAsignacion(conCuerpo(404, 'html')).codigo).toBe('claim_not_found');
      expect(traducirErrorAsignacion(conCuerpo(502, { error: 'bad_gateway' })).codigo).toBe(
        'claims_unavailable',
      );
      expect(traducirErrorAsignacion(conCuerpo(0, null)).codigo).toBe('claims_unavailable');
      expect(traducirErrorAsignacion(new Error('red'))).toBeInstanceOf(ErrorAsignacion);
      expect(traducirErrorAsignacion(new Error('red')).campos).toEqual([]);
    });
  });
});
