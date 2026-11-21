import {
  AccionHistorial,
  SolicitudAsistencia,
  mapearBandeja,
  mapearDetalleAsistencia,
  mapearPoliticaAsistencia,
} from '@core/api/siniestros/asistencia.modelos';
import {
  ANALISTA_TURNO2_DTO,
  BANDEJA_DTO,
  DETALLE_AGOTADA_DTO,
  DETALLE_ATENDIDA_DTO,
  DETALLE_CERRADA_DTO,
  DETALLE_CON_SUGERENCIA_DTO,
  DETALLE_DESPACHADA_DTO,
  DETALLE_NUEVA_DTO,
  DETALLE_SIN_GPS_DTO,
  DETALLE_UBICADA_POR_VOZ_DTO,
  POLITICA_ASISTENCIA_DTO,
  SUGERENCIA_ENCONTRADA_DTO,
  detalleCon,
} from '@testing/asistencia-pruebas';

import {
  accionFila,
  accionesDetalle,
  candidatosSeparados,
  coordenadasDe,
  duracionDespacho,
  estaAbierta,
  etiquetaObjetoAsegurado,
  formatearDuracion,
  formatoCronometro,
  horaSolicitud,
  horaUtc,
  inicioLlamada,
  marcadoresBandeja,
  necesidadesDeLinea,
  nombreEstadoAsistencia,
  nombreMotivoCierre,
  nombreMotivoSinUbicacion,
  nombreNecesidad,
  polizaResumida,
  sinUbicacionPendientes,
  superaObjetivo,
  textoAccionHistorial,
  tonoEstadoAsistencia,
  tonoLlegada,
  validarCierre,
} from './presentacion-asistencia';

const t = (clave: string, parametros?: Record<string, unknown>) =>
  parametros ? `<${clave} ${JSON.stringify(parametros)}>` : `<${clave}>`;
const SOLICITUDES = mapearBandeja(BANDEJA_DTO).solicitudes;
const [CERRADA, EN_LLAMADA, CON_GPS, SIN_GPS, DESPACHADA] = SOLICITUDES;

describe('presentacion-asistencia (HU-W2.3-03)', () => {
  describe('traducción por código con respaldo (F7)', () => {
    it('traduce los códigos conocidos', () => {
      expect(nombreEstadoAsistencia(t, 'in_call')).toBe('<asistencias.estados.in_call>');
      expect(nombreNecesidad(t, 'towing')).toBe('<asistencias.necesidades.towing>');
      expect(nombreMotivoCierre(t, 'resolved_by_phone')).toBe(
        '<asistencias.motivosCierre.resolved_by_phone>',
      );
      expect(nombreMotivoSinUbicacion(t, 'no_fix')).toBe(
        '<asistencias.motivosSinUbicacion.no_fix>',
      );
    });

    it('deja crudos los códigos nuevos y tolera la falta de motivo', () => {
      expect(nombreEstadoAsistencia(t, 'archived')).toBe('archived');
      expect(nombreNecesidad(t, 'winch')).toBe('winch');
      expect(nombreMotivoCierre(t, 'fraud')).toBe('fraud');
      expect(nombreMotivoSinUbicacion(t, 'airplane_mode')).toBe('airplane_mode');
      expect(nombreMotivoSinUbicacion(t, null)).toBe('');
    });
  });

  it.each([
    ['new', 'error', true, 'atender'],
    ['in_call', 'informacion', true, 'continuar'],
    ['dispatched', 'exito', false, 'ver'],
    ['closed', 'neutro', false, 'ver'],
    ['archived', 'neutro', false, 'ver'],
  ])('el estado %s: tono %s, abierta %s, acción %s', (estado, tono, abierta, accion) => {
    expect(tonoEstadoAsistencia(estado)).toBe(tono);
    expect(estaAbierta(estado)).toBe(abierta);
    expect(accionFila(estado)).toBe(accion);
  });

  describe('coordenadasDe', () => {
    it('usa las del teléfono', () => {
      expect(coordenadasDe(CON_GPS.ubicacion)).toEqual({ latitud: 4.7712, longitud: -74.0452 });
    });

    it('sin GPS usa la ubicación por voz', () => {
      expect(coordenadasDe(EN_LLAMADA.ubicacion)).toEqual({ latitud: 3.4921, longitud: -76.4203 });
    });

    it('sin GPS ni voz no hay coordenadas', () => {
      expect(coordenadasDe(SIN_GPS.ubicacion)).toBeNull();
    });

    it('0, 0 es una ubicación válida, no «ausente»', () => {
      expect(coordenadasDe({ ...CON_GPS.ubicacion, latitud: 0, longitud: 0 })).toEqual({
        latitud: 0,
        longitud: 0,
      });
    });
  });

  describe('sinUbicacionPendientes (S3)', () => {
    it('cuenta solo las abiertas sin GPS y sin voz', () => {
      // La cerrada de Hogar no tiene GPS, pero ya no está abierta; la en llamada ya tiene la ubicación por voz.
      expect(sinUbicacionPendientes(SOLICITUDES)).toBe(1);
      expect(sinUbicacionPendientes([SIN_GPS, { ...SIN_GPS, solicitudId: 'otra' }])).toBe(2);
      expect(sinUbicacionPendientes([])).toBe(0);
    });
  });

  describe('marcadoresBandeja (S7)', () => {
    it('marca las abiertas con coordenadas, con su número y su estado', () => {
      expect(marcadoresBandeja(SOLICITUDES, t)).toEqual([
        {
          id: EN_LLAMADA.solicitudId,
          latitud: 3.4921,
          longitud: -76.4203,
          etiqueta: 'AST-2026-0002 · <asistencias.estados.in_call>',
          tipo: 'asignado',
        },
        {
          id: CON_GPS.solicitudId,
          latitud: 4.7712,
          longitud: -74.0452,
          etiqueta: 'AST-2026-0001 · <asistencias.estados.new>',
          tipo: 'candidato',
        },
      ]);
    });

    it('no marca las despachadas ni las cerradas aunque tengan coordenadas', () => {
      const conVoz: SolicitudAsistencia = { ...CERRADA, ubicacion: EN_LLAMADA.ubicacion };
      expect(marcadoresBandeja([DESPACHADA, conVoz], t)).toEqual([]);
    });
  });

  describe('duración del despacho (S2)', () => {
    it.each([
      [0, 0, 0],
      [59, 0, 59],
      [60, 1, 0],
      [220, 3, 40],
      [299, 4, 59],
      [300, 5, 0],
      [301, 5, 1],
      [219.6, 3, 40],
      [-5, 0, 0],
    ])('%s s son %s min %s s', (total, minutos, segundos) => {
      expect(duracionDespacho(total)).toEqual({ minutos, segundos });
    });

    it('elige el texto según haya minutos, segundos o los dos', () => {
      expect(formatearDuracion(t, 40)).toBe('<asistencias.duracion.segundos {"segundos":40}>');
      expect(formatearDuracion(t, 300)).toBe('<asistencias.duracion.minutos {"minutos":5}>');
      expect(formatearDuracion(t, 220)).toBe(
        '<asistencias.duracion.minutosSegundos {"minutos":3,"segundos":40}>',
      );
    });

    it.each([
      [null, false],
      [0, false],
      [299, false],
      [300, true],
      [301, true],
    ])('una media de %s s frente a 300 s supera el objetivo: %s', (media, supera) => {
      expect(superaObjetivo(media, 300)).toBe(supera);
    });
  });

  describe('póliza (S4, S10)', () => {
    it('en Autos muestra el producto y la placa; en las demás líneas, solo el producto', () => {
      expect(polizaResumida(CON_GPS.poliza)).toBe('Autos · IZJ-766');
      expect(polizaResumida(CERRADA.poliza)).toBe('Hogar');
      expect(polizaResumida({ ...CON_GPS.poliza, linea: 'travel', producto: 'Viajes' })).toBe(
        'Viajes',
      );
    });

    it.each([
      ['auto', 'vehiculo'],
      ['home', 'inmueble'],
      ['travel', 'objeto'],
      ['pets', 'objeto'],
    ])('la línea %s rotula el objeto asegurado como %s', (linea, etiqueta) => {
      expect(etiquetaObjetoAsegurado(linea)).toBe(etiqueta);
    });
  });

  describe('horaSolicitud (S4, zona del navegador)', () => {
    const ahora = new Date(2026, 10, 21, 12, 0);

    it('de hoy, solo la hora', () => {
      expect(horaSolicitud(new Date(2026, 10, 21, 0, 0).toISOString(), ahora, 'es-CO')).toBe(
        '00:00',
      );
      expect(horaSolicitud(new Date(2026, 10, 21, 16, 31).toISOString(), ahora, 'es-CO')).toBe(
        '16:31',
      );
    });

    it('de otro día, también la fecha', () => {
      expect(horaSolicitud(new Date(2026, 10, 20, 23, 59).toISOString(), ahora, 'es-CO')).toBe(
        '20/11, 23:59',
      );
      expect(horaSolicitud(new Date(2025, 10, 21, 16, 31).toISOString(), ahora, 'es-CO')).toBe(
        '21/11, 16:31',
      );
    });

    it('usa el idioma activo', () => {
      expect(horaSolicitud(new Date(2026, 10, 20, 9, 5).toISOString(), ahora, 'en-US')).toBe(
        '11/20, 09:05',
      );
    });
  });
});

describe('presentacion-asistencia · detalle O9b (HU-W2.3-03)', () => {
  const PROPIO = 'operaciones.local@example.com';
  const detalle = mapearDetalleAsistencia;

  describe('accionesDetalle (S8)', () => {
    it('una nueva se atiende o se cierra; no se decide ni se despacha', () => {
      expect(accionesDetalle(detalle(DETALLE_NUEVA_DTO), PROPIO)).toEqual({
        atender: true,
        continuar: false,
        enLlamadaCon: null,
        cerrar: true,
        decidir: false,
        sugerido: null,
        motivoSinDespacho: null,
      });
    });

    it('en llamada propia con sugerido: despacha al sugerido elegible', () => {
      const acciones = accionesDetalle(detalle(DETALLE_CON_SUGERENCIA_DTO), PROPIO.toUpperCase());
      expect(acciones.continuar).toBe(false);
      expect(acciones.decidir).toBe(true);
      expect(acciones.cerrar).toBe(true);
      expect(acciones.sugerido?.prestadorId).toBe('prv-gruas-autopista-norte');
      expect(acciones.motivoSinDespacho).toBeNull();
    });

    it('en llamada de otro analista: «Continuar la llamada» y con quién está', () => {
      const acciones = accionesDetalle(detalle(DETALLE_UBICADA_POR_VOZ_DTO), PROPIO);
      expect(acciones.continuar).toBe(true);
      expect(acciones.enLlamadaCon).toEqual({
        correo: ANALISTA_TURNO2_DTO.email,
        nombre: 'Diana Torres',
      });
      // Cualquier analista de operaciones puede decidir (S3 del backend).
      expect(acciones.decidir).toBe(true);
      expect(acciones.sugerido?.prestadorId).toBe('prv-gruas-del-valle');
    });

    it('en llamada sin handled_by se trata como propia', () => {
      const acciones = accionesDetalle(
        detalle(detalleCon(DETALLE_ATENDIDA_DTO, { handled_by: null })),
        PROPIO,
      );
      expect(acciones.continuar).toBe(false);
      expect(acciones.enLlamadaCon).toBeNull();
    });

    it.each([
      [DETALLE_ATENDIDA_DTO, 'sinNecesidad'],
      [detalleCon(DETALLE_SIN_GPS_DTO, { status: 'in_call' }), 'sinUbicacion'],
      [DETALLE_AGOTADA_DTO, 'agotada'],
    ])('en llamada sin sugerido explica por qué (%#)', (dto, motivo) => {
      const acciones = accionesDetalle(detalle(dto), PROPIO);
      expect(acciones.sugerido).toBeNull();
      expect(acciones.motivoSinDespacho).toBe(motivo);
    });

    it.each([DETALLE_DESPACHADA_DTO, DETALLE_CERRADA_DTO])(
      'despachada o cerrada no ofrece nada (%#)',
      (dto) => {
        const acciones = accionesDetalle(detalle(dto), PROPIO);
        expect(acciones).toMatchObject({
          atender: false,
          continuar: false,
          cerrar: false,
          decidir: false,
          sugerido: null,
          motivoSinDespacho: null,
        });
      },
    );
  });

  describe('llamada en curso (S9)', () => {
    it('empieza en la última atención o toma', () => {
      expect(inicioLlamada(detalle(DETALLE_UBICADA_POR_VOZ_DTO).historial)).toBe(
        '2026-11-21T16:16:11.416756Z',
      );
      expect(inicioLlamada(detalle(DETALLE_CON_SUGERENCIA_DTO).historial)).toBe(
        '2026-11-21T16:16:11.220159Z',
      );
      expect(inicioLlamada([])).toBeNull();
    });

    it.each([
      [0, '00:00'],
      [59, '00:59'],
      [134, '02:14'],
      [3599, '59:59'],
      [3600, '1:00:00'],
      [3661.9, '1:01:01'],
      [-4, '00:00'],
    ])('%s s se muestran como %s', (segundos, texto) => {
      expect(formatoCronometro(segundos)).toBe(texto);
    });
  });

  describe('necesidadesDeLinea (S13)', () => {
    const politica = mapearPoliticaAsistencia(POLITICA_ASISTENCIA_DTO);

    it('filtra por la línea de la póliza, en el orden de la política', () => {
      expect(necesidadesDeLinea(politica, 'auto').map((n) => n.codigo)).toEqual([
        'towing',
        'battery',
        'flat_tire',
        'fuel',
        'vehicle_lockout',
      ]);
      expect(necesidadesDeLinea(politica, 'home').map((n) => n.codigo)).toEqual([
        'plumbing_emergency',
      ]);
    });

    it('Viaje no tiene necesidades', () => {
      expect(necesidadesDeLinea(politica, 'travel')).toEqual([]);
    });
  });

  describe('candidatosSeparados (S12, S14)', () => {
    const sugerencia = detalle(DETALLE_CON_SUGERENCIA_DTO).sugerencia;
    const ids = (lista: { prestadorId: string }[]) => lista.map((c) => c.prestadorId);

    it('separa los despachables de los demás y deja fuera del mapa a los lejanos', () => {
      const separados = candidatosSeparados(sugerencia, 20);
      expect(ids(separados.despachables)).toEqual([
        'prv-gruas-autopista-norte',
        'prv-auxilio-vial-norte',
      ]);
      expect(ids(separados.otros)).toEqual(['prv-gruas-calle-80', 'prv-gruas-del-valle']);
      expect(ids(separados.enMapa)).toEqual([
        'prv-gruas-autopista-norte',
        'prv-auxilio-vial-norte',
        'prv-gruas-calle-80',
      ]);
    });

    it('a 20,0 km entra en el mapa y a 20,1 km no', () => {
      const conDistancia = (distance_km: number) =>
        detalle(
          detalleCon(DETALLE_CON_SUGERENCIA_DTO, {
            suggestion: {
              ...SUGERENCIA_ENCONTRADA_DTO,
              candidates: [{ ...SUGERENCIA_ENCONTRADA_DTO.candidates[2], distance_km }],
            },
          }),
        ).sugerencia;
      expect(candidatosSeparados(conDistancia(20), 20).enMapa).toHaveLength(1);
      expect(candidatosSeparados(conDistancia(20.1), 20).enMapa).toHaveLength(0);
    });

    it('sin radio máximo (política caída) el mapa lleva solo a los despachables', () => {
      expect(ids(candidatosSeparados(sugerencia, null).enMapa)).toEqual([
        'prv-gruas-autopista-norte',
        'prv-auxilio-vial-norte',
      ]);
    });
  });

  it.each([
    [0, 'exito'],
    [15, 'exito'],
    [16, 'advertencia'],
    [30, 'advertencia'],
    [31, 'neutro'],
    [606, 'neutro'],
  ])('una llegada de %s min lleva el tono %s (S14)', (minutos, tono) => {
    expect(tonoLlegada(minutos)).toBe(tono);
  });

  it('horaUtc: la hora de la solicitud en UTC con segundos, en el idioma activo (S12)', () => {
    expect(horaUtc('2026-11-21T16:16:10.985834Z', 'es-CO')).toBe('21/11/2026 16:16:10 Z');
    expect(horaUtc('2026-11-21T23:59:59Z', 'es-CO')).toBe('21/11/2026 23:59:59 Z');
    expect(horaUtc('2026-11-22T00:00:00Z', 'en-US')).toBe('11/22/2026 00:00:00 Z');
  });

  describe('validarCierre (S16)', () => {
    const con = (motivo: string, nota = '') => validarCierre({ motivo, nota });

    it('sin motivo no se cierra', () => {
      expect(con('')).toEqual({ problemas: { motivo: 'requerido' }, solicitud: null });
    });

    it('con «Otro» la nota es obligatoria; con otro motivo, opcional', () => {
      expect(con('other').problemas).toEqual({ nota: 'requerido' });
      expect(con('other', '   ').problemas).toEqual({ nota: 'requerido' });
      expect(con('resolved_by_phone')).toEqual({
        problemas: {},
        solicitud: { motivo: 'resolved_by_phone' },
      });
    });

    it.each([
      ['ab', 'longitud'],
      ['  ab  ', 'longitud'],
      ['abc', null],
      ['  abc  ', null],
      ['a'.repeat(500), null],
      ['a'.repeat(501), 'longitud'],
      // 500 emojis son 500 caracteres para el backend, aunque en UTF-16 sean 1000 unidades.
      ['😀'.repeat(500), null],
      ['con\u0007campana', 'formato'],
      ['con\u007Fborrado', 'formato'],
      ['con\u0085siguiente línea (C1)', 'formato'],
      ['línea uno\nlínea dos\tcon tabulador\r', null],
    ])('la nota «%s» → %s', (nota, problema) => {
      const resultado = con('other', nota);
      expect(resultado.problemas.nota ?? null).toBe(problema);
      if (problema === null) {
        expect(resultado.solicitud).toEqual({ motivo: 'other', nota: nota.trim() });
      }
    });

    it('una nota mal escrita frena también un motivo que no la exige', () => {
      expect(con('duplicate', 'ab')).toEqual({ problemas: { nota: 'longitud' }, solicitud: null });
    });
  });

  describe('textoAccionHistorial (S18)', () => {
    const t = (clave: string, parametros?: Record<string, unknown>) =>
      parametros ? `<${clave} ${JSON.stringify(parametros)}>` : `<${clave}>`;
    const nombre = (id: string) => (id === 'prv-1' ? 'Grúas Uno' : id);
    const accion = (cambios: Partial<AccionHistorial>): AccionHistorial => ({
      accion: 'attended',
      por: { correo: 'a@example.com', nombre: 'Andrés Ruiz' },
      en: '2026-11-21T16:16:11Z',
      detalle: null,
      ...cambios,
    });

    it('traduce cada acción con su detalle', () => {
      expect(textoAccionHistorial(t, accion({}), nombre)).toContain(
        'asistencias.detalle.historial.acciones.attended',
      );
      expect(
        textoAccionHistorial(
          t,
          accion({ accion: 'need_recorded', detalle: { need: 'towing' } }),
          nombre,
        ),
      ).toContain('"necesidad":"<asistencias.necesidades.towing>"');
      expect(
        textoAccionHistorial(
          t,
          accion({ accion: 'dispatched', detalle: { provider_id: 'prv-1' } }),
          nombre,
        ),
      ).toContain('"prestador":"Grúas Uno"');
      expect(
        textoAccionHistorial(
          t,
          accion({ accion: 'closed', detalle: { reason: 'duplicate' } }),
          nombre,
        ),
      ).toContain('"motivo":"<asistencias.motivosCierre.duplicate>"');
      expect(
        textoAccionHistorial(
          t,
          accion({ accion: 'taken_over', detalle: { from: 'b@example.com' } }),
          nombre,
        ),
      ).toContain('"desde":"b@example.com"');
    });

    it('sin nombre usa el correo; una acción nueva se muestra con su código', () => {
      expect(
        textoAccionHistorial(t, accion({ por: { correo: 'a@example.com', nombre: null } }), nombre),
      ).toContain('"quien":"a@example.com"');
      expect(textoAccionHistorial(t, accion({ accion: 'reopened' }), nombre)).toBe(
        '<asistencias.detalle.historial.acciones.otra {"quien":"Andrés Ruiz","accion":"reopened"}>',
      );
    });
  });
});
