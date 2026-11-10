import { CASO_DEVUELTO_DTO, HISTORIAL_DEVUELTO_DTO } from '@testing/reenvio-radicacion-pruebas';

import { mapearHistorialSiniestro } from '@core/api/siniestros/reenvio.modelos';
import { DetalleSiniestro, mapearDetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';

import {
  aSolicitudReenvio,
  erroresDelServidor,
  filasCorreccion,
  hechosDe,
  problemasHechos,
  requisitoParaSubir,
} from './correccion-radicacion';

describe('Corrección de la radicación devuelta (A9 · HU-W2.1-04)', () => {
  const historial = mapearHistorialSiniestro(HISTORIAL_DEVUELTO_DTO);
  const caso = mapearDetalleSiniestro(CASO_DEVUELTO_DTO);
  const devolucion = historial.ultimaDevolucion!;
  const ahora = new Date('2026-09-16T15:00:00Z');

  const filas = (nuevos: Record<string, number> = {}, detalle: DetalleSiniestro = caso) =>
    filasCorreccion(historial.requisitos, devolucion, detalle, nuevos);
  const fila = (codigo: string, nuevos: Record<string, number> = {}) =>
    filas(nuevos).find((f) => f.requisito.codigo === codigo)!;

  describe('filas de soportes (CA-1 y CA-3)', () => {
    it('pide reemplazar el ilegible, subir el faltante y conserva lo aceptado', () => {
      const resultado = filas();

      expect(resultado.map((f) => [f.requisito.codigo, f.estado, f.accion, f.pendiente])).toEqual([
        ['vehicle_photos', 'adjunto', 'agregar', false],
        ['driver_document', 'adjunto', 'agregar', false],
        ['traffic_report', 'reemplazar', 'reemplazar', true],
        ['plate_photo', 'falta', 'subir', true],
      ]);
      expect(resultado[2].nota).toBe('borroso');
      expect(resultado[0].actuales).toHaveLength(6);
    });

    it('con un archivo nuevo el ilegible queda corregido y el faltante también', () => {
      expect(fila('traffic_report', { traffic_report: 1 })).toMatchObject({
        estado: 'corregido',
        pendiente: false,
      });
      expect(fila('plate_photo', { plate_photo: 1 })).toMatchObject({
        estado: 'corregido',
        pendiente: false,
      });
    });

    it('un soporte lleno se reemplaza y uno con espacio se completa', () => {
      const lleno: DetalleSiniestro = {
        ...caso,
        soportes: {
          ...caso.soportes,
          items: caso.soportes.items.map((i) =>
            i.codigoRequisito === 'driver_document'
              ? { ...i, archivos: [...i.archivos, i.archivos[0]] }
              : i,
          ),
        },
      };
      const documento = filasCorreccion(historial.requisitos, devolucion, lleno, {}).find(
        (f) => f.requisito.codigo === 'driver_document',
      )!;

      expect(documento.accion).toBe('reemplazar');
      expect(requisitoParaSubir(documento).maxArchivos).toBe(2);
      // Las 6 fotos dejan espacio para 4.
      expect(requisitoParaSubir(fila('vehicle_photos')).maxArchivos).toBe(4);
    });

    it('al reemplazar con menos archivos del mínimo quedan pocos', () => {
      const fotosIlegibles = {
        ...devolucion,
        soportes: devolucion.soportes.map((s) =>
          s.codigoRequisito === 'vehicle_photos' ? { ...s, veredicto: 'illegible' as const } : s,
        ),
      };
      const fotos = filasCorreccion(historial.requisitos, fotosIlegibles, caso, {
        vehicle_photos: 2,
      })[0];

      expect(fotos).toMatchObject({ accion: 'reemplazar', estado: 'pocos', pendiente: true });
    });

    it('en un caso del móvil las fotos de la app cuentan y se reemplazan desde el portal', () => {
      const movil: DetalleSiniestro = {
        ...caso,
        canal: 'mobile',
        soportes: { ...caso.soportes, items: [] },
      };
      const fotos = filasCorreccion(historial.requisitos, devolucion, movil, {})[0];

      expect(fotos).toMatchObject({
        fotosDeLaApp: true,
        accion: 'reemplazar',
        estado: 'adjunto',
        pendiente: false,
      });
    });

    it('sin devolución un opcional sin archivos es opcional', () => {
      const placa = filasCorreccion(historial.requisitos, null, caso, {})[3];

      expect(placa).toMatchObject({ veredicto: null, estado: 'opcional', pendiente: false });
    });
  });

  describe('hechos (CA-2 y CA-3)', () => {
    it('parte de lo radicado, en pesos y en la hora del navegador', () => {
      const hechos = hechosDe(caso);

      expect(hechos.lugar).toBe('Calle 80 con carrera 30, Bogotá');
      expect(hechos.montoEstimado).toBe('4800000');
      expect(new Date(hechos.ocurridoEn).toISOString()).toBe('2026-09-14T23:40:00.000Z');
      expect(hechosDe({ ...caso, montoEstimadoMinor: null }).montoEstimado).toBe('');
    });

    it('valida con las reglas de la radicación y no deja una fecha posterior a la radicación', () => {
      const hechos = {
        ...hechosDe(caso),
        lugar: 'ab',
        descripcion: '',
        montoEstimado: '12,5',
        ocurridoEn: '2026-09-15T12:00',
      };

      expect(problemasHechos(hechos, caso, [], ahora)).toEqual({
        lugar: 'lugarLongitud',
        descripcion: 'requerido',
        montoEstimado: 'formatoInvalido',
        ocurridoEn: 'fechaPosteriorRadicacion',
      });
      expect(problemasHechos(hechosDe(caso), caso, [], ahora)).toEqual({});
    });

    it('el monto que pidió el asesor es obligatorio', () => {
      const sinMonto = { ...hechosDe(caso), montoEstimado: '' };

      expect(problemasHechos(sinMonto, caso, ['estimated_amount'], ahora)).toEqual({
        montoEstimado: 'requerido',
      });
      expect(problemasHechos(sinMonto, caso, ['place'], ahora)).toEqual({});
    });
  });

  describe('solicitud (CA-2 y CA-4)', () => {
    it('envía solo lo que cambió y, por soporte, el conjunto completo que queda', () => {
      const original = hechosDe(caso);
      const hechos = {
        ...original,
        lugar: '  Calle 80 con carrera 30, frente al centro comercial  ',
        montoEstimado: '5.200.000',
      };
      const nuevos = { traffic_report: ['sup-nuevo-informe'], vehicle_photos: ['sup-nueva-foto'] };

      const solicitud = aSolicitudReenvio(
        devolucion,
        original,
        hechos,
        filas({ traffic_report: 1, vehicle_photos: 1 }),
        nuevos,
      );

      expect(solicitud.revisionSecuencia).toBe(1);
      expect(solicitud.lugar).toBe('Calle 80 con carrera 30, frente al centro comercial');
      expect(solicitud.montoEstimadoMinor).toBe(520_000_000);
      expect(solicitud.ocurridoEn).toBeUndefined();
      expect(solicitud.descripcion).toBeUndefined();
      expect(solicitud.soportes).toEqual([
        {
          codigoRequisito: 'vehicle_photos',
          soporteIds: [
            ...caso.soportes.items[0].archivos.map((a) => a.soporteId),
            'sup-nueva-foto',
          ],
        },
        { codigoRequisito: 'traffic_report', soporteIds: ['sup-nuevo-informe'] },
      ]);
    });

    it('sin cambios solo dice qué devolución responde', () => {
      const original = hechosDe(caso);

      expect(aSolicitudReenvio(devolucion, original, original, filas(), {})).toEqual({
        revisionSecuencia: 1,
      });
    });

    it('una fecha nueva va en RFC 3339', () => {
      const original = hechosDe(caso);
      const solicitud = aSolicitudReenvio(
        devolucion,
        original,
        { ...original, ocurridoEn: '2026-09-14T17:00' },
        filas(),
        {},
      );

      expect(solicitud.ocurridoEn).toBe(new Date('2026-09-14T17:00').toISOString());
    });
  });

  it('traduce lo que el servidor dijo que falta (422)', () => {
    const errores = erroresDelServidor([
      { campo: 'place', codigo: 'required' },
      { campo: 'occurred_at', codigo: 'out_of_range' },
      { campo: 'description', codigo: 'out_of_range' },
      { campo: 'estimated_amount_minor', codigo: 'invalid_format' },
      { campo: 'supports.traffic_report', codigo: 'not_replaced' },
      { campo: 'supports.plate_photo', codigo: 'missing' },
      { campo: 'supports', codigo: 'too_many' },
    ]);

    expect(errores.hechos).toEqual({
      lugar: 'requerido',
      ocurridoEn: 'fechaFueraRango',
      descripcion: 'descripcionLongitud',
      montoEstimado: 'formatoInvalido',
    });
    expect(errores.soportes).toEqual({ traffic_report: 'reemplazar', plate_photo: 'falta' });
    expect(errores.general).toBe(true);
    expect(erroresDelServidor([{ campo: 'place', codigo: 'out_of_range' }]).hechos).toEqual({
      lugar: 'lugarLongitud',
    });
    expect(
      erroresDelServidor([{ campo: 'estimated_amount_minor', codigo: 'out_of_range' }]).hechos,
    ).toEqual({
      montoEstimado: 'montoRango',
    });
  });
});
