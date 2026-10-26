import { PolizaRadicable, mapearOpcionesRadicacion } from '@core/api/siniestros/radicacion.modelos';
import { OPCIONES_RADICACION_DTO } from '@testing/siniestros-pruebas';

import {
  FORMULARIO_VACIO,
  FormularioRadicacion,
  MAX_BYTES_SOPORTE,
  aIsoDesdeLocal,
  aLocal,
  aSolicitud,
  aceptaArchivos,
  dentroDeVigencia,
  faltantes,
  formatoAparente,
  limitesFechaHecho,
  problemaCampo,
  problemaSoporte,
  requisitosDelTipo,
  soportesNoAplica,
  validarArchivo,
} from './formulario-radicacion';

const [AUTOS, HOGAR] = mapearOpcionesRadicacion(OPCIONES_RADICACION_DTO).polizas as [PolizaRadicable, PolizaRadicable];
const AHORA = new Date('2026-09-20T15:00:00Z');
const MINUTO = 60_000;

/** Valor de `datetime-local` para un instante, en la zona del navegador que corre la prueba. */
const local = (iso: string | number) => aLocal(new Date(iso));

const COMPLETO: FormularioRadicacion = {
  polizaId: AUTOS.id,
  tipoSiniestro: 'collision',
  ocurridoEn: local('2026-09-14T23:40:00Z'),
  lugar: 'Calle 80 con carrera 30, Bogotá',
  descripcion: 'Un vehículo golpeó la parte trasera.',
};
const ADJUNTOS_COMPLETOS = { vehicle_photos: 4, driver_document: 1, traffic_report: 1 };

describe('formulario de radicación (HU-W2.1-01)', () => {
  describe('requisitos por tipo y «No aplica»', () => {
    it('devuelve los soportes del tipo elegido y nada sin póliza o tipo', () => {
      expect(requisitosDelTipo(AUTOS, 'collision').map((r) => r.codigo)).toEqual([
        'vehicle_photos',
        'driver_document',
        'traffic_report',
      ]);
      expect(requisitosDelTipo(null, 'collision')).toEqual([]);
      expect(requisitosDelTipo(AUTOS, 'water_damage')).toEqual([]);
    });

    it('marca como «No aplica» los soportes de los otros tipos de la póliza, una vez cada uno', () => {
      expect(soportesNoAplica(AUTOS, 'collision').map((r) => r.codigo)).toEqual([
        'police_report',
        'glass_photos',
        'supporting_document',
      ]);
      expect(soportesNoAplica(HOGAR, 'water_damage')).toEqual([]);
      expect(soportesNoAplica(AUTOS, '')).toEqual([]);
    });
  });

  describe('fecha del hecho', () => {
    it('convierte el valor local a RFC 3339 y vuelve al mismo valor local', () => {
      const valor = local('2026-09-14T23:40:00Z');
      expect(aIsoDesdeLocal(valor)).toBe('2026-09-14T23:40:00.000Z');
      expect(aIsoDesdeLocal('')).toBeNull();
      expect(aIsoDesdeLocal('14/09/2026 18:40')).toBeNull();
      expect(aIsoDesdeLocal('2026-13-40T99:99')).toBeNull();
    });

    it('aplica la vigencia semiabierta: incluye el inicio y excluye el fin', () => {
      expect(dentroDeVigencia('2025-11-01T05:00:00Z', AUTOS)).toBe(true);
      expect(dentroDeVigencia('2026-11-01T04:59:00Z', AUTOS)).toBe(true);
      expect(dentroDeVigencia('2026-11-01T05:00:00Z', AUTOS)).toBe(false);
      expect(dentroDeVigencia('2025-11-01T04:59:00Z', AUTOS)).toBe(false);
    });

    it('limita el control entre el inicio de la vigencia (o hace 5 años) y ahora', () => {
      expect(limitesFechaHecho(AHORA, AUTOS)).toEqual({ min: local(AUTOS.vigenteDesde), max: local(AHORA.getTime()) });
      expect(limitesFechaHecho(AHORA, null).min).toBe(local('2021-09-20T15:00:00Z'));
    });

    it('rechaza el hecho futuro, el de hace más de 5 años y el que cae fuera de la vigencia', () => {
      const con = (instante: number | string) => ({ ...COMPLETO, ocurridoEn: local(instante) });
      expect(problemaCampo('ocurridoEn', con(AHORA.getTime()), AUTOS, AHORA)).toBeNull();
      expect(problemaCampo('ocurridoEn', con(AHORA.getTime() + MINUTO), AUTOS, AHORA)).toBe('fechaFutura');
      expect(problemaCampo('ocurridoEn', con('2021-09-20T14:59:00Z'), null, AHORA)).toBe('fechaAntigua');
      expect(problemaCampo('ocurridoEn', con('2021-09-20T15:00:00Z'), null, AHORA)).toBeNull();
      expect(problemaCampo('ocurridoEn', con('2025-10-31T12:00:00Z'), AUTOS, AHORA)).toBe('fueraVigencia');
      expect(problemaCampo('ocurridoEn', { ...COMPLETO, ocurridoEn: '' }, AUTOS, AHORA)).toBe('requerido');
      expect(problemaCampo('ocurridoEn', { ...COMPLETO, ocurridoEn: '2026-09' }, AUTOS, AHORA)).toBe('formatoInvalido');
    });
  });

  describe('lugar y descripción (valores límite)', () => {
    it.each([
      [2, 'lugarLongitud'],
      [3, null],
      [160, null],
      [161, 'lugarLongitud'],
    ])('lugar de %i caracteres → %s', (largo, esperado) => {
      expect(problemaCampo('lugar', { ...COMPLETO, lugar: 'x'.repeat(largo) }, AUTOS, AHORA)).toBe(esperado);
    });

    it.each([
      [9, 'descripcionLongitud'],
      [10, null],
      [1000, null],
      [1001, 'descripcionLongitud'],
    ])('descripción de %i caracteres → %s', (largo, esperado) => {
      expect(problemaCampo('descripcion', { ...COMPLETO, descripcion: 'x'.repeat(largo) }, AUTOS, AHORA)).toBe(esperado);
    });

    it('trata el texto con solo espacios como vacío', () => {
      expect(problemaCampo('lugar', { ...COMPLETO, lugar: '   ' }, AUTOS, AHORA)).toBe('requerido');
    });
  });

  describe('soportes (valores límite)', () => {
    const fotos = requisitosDelTipo(AUTOS, 'collision')[0];
    const fotosOpcionales = requisitosDelTipo(AUTOS, 'theft')[2];

    it.each([
      [0, 'falta'],
      [3, 'pocos'],
      [4, null],
      [10, null],
      [11, 'muchos'],
    ])('fotos del vehículo con %i archivos → %s', (cantidad, esperado) => {
      expect(problemaSoporte(fotos, cantidad)).toBe(esperado);
    });

    it('un soporte opcional sin archivos está bien', () => {
      expect(fotosOpcionales.obligatorio).toBe(false);
      expect(problemaSoporte(fotosOpcionales, 0)).toBeNull();
    });
  });

  describe('faltantes', () => {
    it('no devuelve nada con todo completo', () => {
      expect(faltantes(COMPLETO, AUTOS, ADJUNTOS_COMPLETOS, AHORA)).toEqual([]);
    });

    it('lista a la vez todos los campos y el soporte obligatorio que faltan (CA-2)', () => {
      const resultado = faltantes(
        { ...COMPLETO, lugar: '', descripcion: '' },
        AUTOS,
        { vehicle_photos: 6, driver_document: 1 },
        AHORA,
      );

      expect(resultado).toEqual([
        { tipo: 'campo', campo: 'lugar', problema: 'requerido' },
        { tipo: 'campo', campo: 'descripcion', problema: 'requerido' },
        { tipo: 'soporte', requisito: requisitosDelTipo(AUTOS, 'collision')[2], problema: 'falta' },
      ]);
    });

    it('con el formulario vacío pide los cinco campos y aún no pide soportes', () => {
      expect(faltantes(FORMULARIO_VACIO, null, {}, AHORA).map((f) => (f.tipo === 'campo' ? f.campo : f.tipo))).toEqual([
        'polizaId',
        'tipoSiniestro',
        'ocurridoEn',
        'lugar',
        'descripcion',
      ]);
    });

    it('señala más de 20 archivos en total', () => {
      const tipoAmplio = {
        ...AUTOS,
        tiposSiniestro: [
          {
            codigo: 'collision',
            etiqueta: 'x',
            requisitos: requisitosDelTipo(AUTOS, 'collision').map((r) => ({ ...r, maxArchivos: 20 })),
          },
        ],
      };
      const veinte = faltantes(COMPLETO, tipoAmplio, { vehicle_photos: 10, driver_document: 5, traffic_report: 5 }, AHORA);
      const veintiuno = faltantes(COMPLETO, tipoAmplio, { vehicle_photos: 11, driver_document: 5, traffic_report: 5 }, AHORA);

      expect(veinte).toEqual([]);
      expect(veintiuno).toEqual([{ tipo: 'total' }]);
    });
  });

  describe('archivos (CA-5)', () => {
    const fotos = requisitosDelTipo(AUTOS, 'collision')[0];
    const croquis = requisitosDelTipo(AUTOS, 'collision')[2];
    const archivo = (name: string, type: string, size: number) => ({ name, type, size });

    it.each([
      [MAX_BYTES_SOPORTE, null],
      [MAX_BYTES_SOPORTE + 1, 'file_too_large'],
      [1, null],
      [0, 'empty_file'],
    ])('una foto de %i bytes → %s', (tamano, esperado) => {
      expect(validarArchivo(archivo('foto.jpg', 'image/jpeg', tamano), fotos)).toBe(esperado);
    });

    it('rechaza un PDF en un soporte que solo admite imágenes y un formato desconocido', () => {
      expect(validarArchivo(archivo('a.pdf', 'application/pdf', 10), fotos)).toBe('unsupported_file_type');
      expect(validarArchivo(archivo('a.pdf', 'application/pdf', 10), croquis)).toBeNull();
      expect(validarArchivo(archivo('a.exe', 'application/x-msdownload', 10), croquis)).toBe('unsupported_file_type');
    });

    it('decide por el MIME y, sin él, por la extensión', () => {
      expect(formatoAparente({ name: 'foto.PNG', type: '' })).toBe('png');
      expect(formatoAparente({ name: 'foto.jpeg', type: '' })).toBe('jpeg');
      expect(formatoAparente({ name: 'sin-extension', type: '' })).toBeNull();
      expect(formatoAparente({ name: 'foto.png', type: 'image/gif' })).toBeNull();
    });

    it('arma el atributo accept con los formatos del soporte', () => {
      expect(aceptaArchivos(fotos)).toBe('image/jpeg,.jpg,.jpeg,image/png,.png');
      expect(aceptaArchivos(croquis)).toContain('application/pdf,.pdf');
    });
  });

  describe('aSolicitud', () => {
    it('envía solo los soportes del tipo elegido que tienen archivos, con el texto recortado', () => {
      const solicitud = aSolicitud({ ...COMPLETO, lugar: '  Calle 80  ' }, AUTOS, {
        traffic_report: ['sup-c'],
        vehicle_photos: ['sup-a', 'sup-b'],
        driver_document: [],
        police_report: ['sup-x'],
      });

      expect(solicitud).toEqual({
        polizaId: AUTOS.id,
        tipoSiniestro: 'collision',
        ocurridoEn: '2026-09-14T23:40:00.000Z',
        lugar: 'Calle 80',
        descripcion: COMPLETO.descripcion,
        soportes: [
          { codigoRequisito: 'vehicle_photos', soporteIds: ['sup-a', 'sup-b'] },
          { codigoRequisito: 'traffic_report', soporteIds: ['sup-c'] },
        ],
      });
    });
  });
});
