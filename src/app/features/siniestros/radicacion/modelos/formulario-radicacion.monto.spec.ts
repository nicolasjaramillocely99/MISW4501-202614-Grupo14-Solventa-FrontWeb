import { PolizaRadicable, mapearOpcionesRadicacion } from '@core/api/siniestros/radicacion.modelos';
import { OPCIONES_RADICACION_DTO } from '@testing/siniestros-pruebas';

import {
  FORMULARIO_VACIO,
  FormularioRadicacion,
  aLocal,
  aSolicitud,
  faltantes,
  leerMonto,
  normalizarMonto,
  problemaCampo,
} from './formulario-radicacion';

const [AUTOS] = mapearOpcionesRadicacion(OPCIONES_RADICACION_DTO).polizas as [PolizaRadicable];
const AHORA = new Date('2026-09-20T15:00:00Z');
const COMPLETO: FormularioRadicacion = {
  polizaId: AUTOS.id,
  tipoSiniestro: 'collision',
  ocurridoEn: aLocal(new Date('2026-09-14T23:40:00Z')),
  lugar: 'Calle 80 con carrera 30, Bogotá',
  descripcion: 'Un vehículo golpeó la parte trasera.',
  montoEstimado: '',
};
const ADJUNTOS = { vehicle_photos: 4, driver_document: 1, traffic_report: 1 };

describe('monto estimado del formulario de radicación (HU-W2.2-01, S2)', () => {
  describe('normalizarMonto: pesos → centavos', () => {
    it.each([
      ['4.800.000', 480000000],
      ['4,800,000', 480000000],
      ['4 800 000', 480000000],
      ['4800000', 480000000],
      ['  4.800.000  ', 480000000],
      ['1', 100],
      ['100.000.000.000', 10_000_000_000_000],
    ])('«%s» son %s centavos', (texto, centavos) => {
      expect(normalizarMonto(texto)).toBe(centavos);
    });

    it.each([
      ['vacío', ''],
      ['solo espacios', '   '],
      ['0', '0'],
      ['100.000.000.001', '100.000.000.001'],
      ['decimal con coma', '4.800.000,50'],
      ['decimal con punto', '48000.00'],
      ['negativo', '-5'],
      ['letras', 'abc'],
      ['grupos de dos', '4.80.000'],
      ['con símbolo', '$ 4.800.000'],
    ])('%s no produce centavos', (_nombre, texto) => {
      expect(normalizarMonto(texto)).toBeNull();
    });

    it('el máximo en centavos es el del contrato (10¹³) y cabe en un entero seguro', () => {
      const centavos = normalizarMonto('100.000.000.000');

      expect(centavos).toBe(1e13);
      expect(Number.isSafeInteger(centavos)).toBe(true);
    });
  });

  describe('leerMonto', () => {
    it('vacío no es un error: el campo es opcional', () => {
      expect(leerMonto('')).toEqual({ tipo: 'vacio' });
    });

    it('válido trae los pesos y los centavos', () => {
      expect(leerMonto('4.800.000')).toEqual({ tipo: 'valido', pesos: 4800000, centavos: 480000000 });
    });

    it.each([
      ['0', 'montoRango'],
      ['100.000.000.001', 'montoRango'],
      ['4.800.000,50', 'formatoInvalido'],
      ['48000.00', 'formatoInvalido'],
      ['-5', 'formatoInvalido'],
      ['abc', 'formatoInvalido'],
      ['4.80.000', 'formatoInvalido'],
    ] as const)('«%s» es %s', (texto, problema) => {
      expect(leerMonto(texto)).toEqual({ tipo: 'invalido', problema });
    });
  });

  describe('faltantes y problemaCampo', () => {
    it('el monto vacío no falta: radicar sigue permitido', () => {
      expect(problemaCampo('montoEstimado', COMPLETO, AUTOS, AHORA)).toBeNull();
      expect(faltantes(COMPLETO, AUTOS, ADJUNTOS, AHORA)).toEqual([]);
    });

    it('el formulario vacío no lista el monto entre lo que falta', () => {
      const campos = faltantes(FORMULARIO_VACIO, null, {}, AHORA).flatMap((f) => (f.tipo === 'campo' ? [f.campo] : []));

      expect(campos).not.toContain('montoEstimado');
    });

    it('un monto válido no falta', () => {
      expect(faltantes({ ...COMPLETO, montoEstimado: '4.800.000' }, AUTOS, ADJUNTOS, AHORA)).toEqual([]);
    });

    it.each([
      ['4.800.000,50', 'formatoInvalido'],
      ['100.000.000.001', 'montoRango'],
    ] as const)('un monto «%s» entra a lo que falta como %s', (montoEstimado, problema) => {
      expect(faltantes({ ...COMPLETO, montoEstimado }, AUTOS, ADJUNTOS, AHORA)).toEqual([
        { tipo: 'campo', campo: 'montoEstimado', problema },
      ]);
    });
  });

  describe('aSolicitud', () => {
    const soportes = { vehicle_photos: ['a'] };

    it('sin monto no lleva montoEstimadoMinor (el cuerpo es el de HU-W2.1-01)', () => {
      expect(aSolicitud(COMPLETO, AUTOS, soportes)).not.toHaveProperty('montoEstimadoMinor');
    });

    it('con monto lleva los centavos', () => {
      expect(aSolicitud({ ...COMPLETO, montoEstimado: '4.800.000' }, AUTOS, soportes).montoEstimadoMinor).toBe(480000000);
    });

    it('un monto inválido tampoco se envía', () => {
      expect(aSolicitud({ ...COMPLETO, montoEstimado: '4,8 millones' }, AUTOS, soportes)).not.toHaveProperty(
        'montoEstimadoMinor',
      );
    });
  });
});
