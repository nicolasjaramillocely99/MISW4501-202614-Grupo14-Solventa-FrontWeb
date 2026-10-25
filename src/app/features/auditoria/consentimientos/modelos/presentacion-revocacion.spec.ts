import { EstadoRevocacion, mapearEstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';
import {
  ESTADO_ACTIVO_DTO,
  ESTADO_EN_CURSO_DTO,
  ESTADO_PARCIAL_DTO,
  ESTADO_REVOCADO_DTO,
  ESTADO_REVOCADO_EN_APP_DTO,
  ESTADO_VENCIDO_DTO,
} from '@testing/revocacion-pruebas';

import {
  MARGEN_SONDEO_MS,
  confirmadas,
  errorReferencia,
  etiquetaEstado,
  faltantes,
  limiteSondeo,
  motivoNoRevocable,
  noConfirmadas,
  normalizarReferencia,
  otorgadoEn,
  plazoMaximoPendiente,
  pendientes,
  requiereSondeo,
  solicitadaPor,
  sondeoVencido,
} from './presentacion-revocacion';

const ACTIVO = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);
const EN_CURSO = mapearEstadoRevocacion(ESTADO_EN_CURSO_DTO);
const REVOCADO = mapearEstadoRevocacion(ESTADO_REVOCADO_DTO);
const PARCIAL = mapearEstadoRevocacion(ESTADO_PARCIAL_DTO);
const EN_APP = mapearEstadoRevocacion(ESTADO_REVOCADO_EN_APP_DTO);
const VENCIDO = mapearEstadoRevocacion(ESTADO_VENCIDO_DTO);

/** Reintento en ventana: el aviso sigue en `partial` pero la entidad vuelve a `pending`. */
const EN_REINTENTO: EstadoRevocacion = {
  ...PARCIAL,
  revocacion: {
    ...PARCIAL.revocacion!,
    entidades: [{ ...PARCIAL.revocacion!.entidades[0], estado: 'pending', plazoHasta: '2026-10-25T16:12:00Z' }],
  },
};

describe('presentación de la revocación (HU-W4.2-02)', () => {
  describe('etiquetaEstado (S3)', () => {
    it.each([
      ['active', ACTIVO, 'activo', 'exito'],
      ['revoked + in_progress', EN_CURSO, 'enCurso', 'informacion'],
      ['revoked + completed', REVOCADO, 'revocado', 'neutro'],
      ['revoked desde la app', EN_APP, 'revocado', 'neutro'],
      ['partially_revoked + partial', PARCIAL, 'parcial', 'advertencia'],
      ['partially_revoked en reintento', EN_REINTENTO, 'parcial', 'advertencia'],
      ['expired', VENCIDO, 'vencido', 'neutro'],
    ] as const)('%s → %s', (_nombre, estado, clave, tono) => {
      expect(etiquetaEstado(estado)).toEqual({ clave, tono });
    });

    it('un revoked sin revocación se lee como revocado', () => {
      expect(etiquetaEstado({ ...EN_CURSO, revocacion: null }).clave).toBe('revocado');
    });
  });

  describe('entidades por estado', () => {
    it('separa pendientes, no confirmadas y confirmadas', () => {
      expect(pendientes(EN_CURSO).map((e) => e.codigo)).toEqual(['aliado-banco-1']);
      expect(noConfirmadas(EN_CURSO)).toEqual([]);
      expect(noConfirmadas(PARCIAL).map((e) => e.codigo)).toEqual(['aliado-banco-1']);
      expect(pendientes(PARCIAL)).toEqual([]);
      expect(confirmadas(REVOCADO).map((e) => e.codigo)).toEqual(['aliado-banco-1']);
      expect(pendientes(EN_REINTENTO)).toHaveLength(1);
      expect(noConfirmadas(EN_REINTENTO)).toEqual([]);
    });

    it('sin revocación no hay entidades en ningún estado', () => {
      expect(pendientes(ACTIVO)).toEqual([]);
      expect(noConfirmadas(ACTIVO)).toEqual([]);
      expect(confirmadas(ACTIVO)).toEqual([]);
    });
  });

  describe('requiereSondeo (S4)', () => {
    it.each([
      ['activo', ACTIVO, false],
      ['en curso', EN_CURSO, true],
      ['revocado', REVOCADO, false],
      ['parcial sin ventana abierta', PARCIAL, false],
      ['parcial con la entidad en ventana de reintento', EN_REINTENTO, true],
      ['vencido', VENCIDO, false],
    ] as const)('%s → %s', (_nombre, estado, esperado) => {
      expect(requiereSondeo(estado)).toBe(esperado);
    });
  });

  describe('plazoMaximoPendiente', () => {
    it('es el mayor plazo de las entidades que esperan', () => {
      expect(plazoMaximoPendiente(EN_CURSO)).toBe('2026-10-25T16:05:00.123456Z');
      expect(plazoMaximoPendiente(EN_REINTENTO)).toBe('2026-10-25T16:12:00Z');
      const entidades = [
        { ...EN_CURSO.revocacion!.entidades[0], plazoHasta: '2026-10-25T16:05:00Z' },
        { ...EN_CURSO.revocacion!.entidades[0], codigo: 'otra', plazoHasta: '2026-10-25T16:09:00Z' },
        { ...EN_CURSO.revocacion!.entidades[0], codigo: 'sin-plazo', plazoHasta: null },
      ];
      expect(plazoMaximoPendiente({ ...EN_CURSO, revocacion: { ...EN_CURSO.revocacion!, entidades } })).toBe('2026-10-25T16:09:00Z');
    });

    it('es null si ninguna entidad espera', () => {
      expect(plazoMaximoPendiente(ACTIVO)).toBeNull();
      expect(plazoMaximoPendiente(REVOCADO)).toBeNull();
      expect(plazoMaximoPendiente(PARCIAL)).toBeNull();
    });
  });

  describe('límite del sondeo (S4)', () => {
    const plazo = Date.parse('2026-10-25T16:05:00.123456Z');

    it('es el mayor plazo más 30 s', () => {
      expect(limiteSondeo(EN_CURSO)).toBe(plazo + MARGEN_SONDEO_MS);
      expect(limiteSondeo(EN_REINTENTO)).toBe(Date.parse('2026-10-25T16:12:00Z') + MARGEN_SONDEO_MS);
    });

    it('con varias entidades toma el plazo mayor', () => {
      const entidades = [
        { ...EN_CURSO.revocacion!.entidades[0], plazoHasta: '2026-10-25T16:05:00Z' },
        { ...EN_CURSO.revocacion!.entidades[0], codigo: 'otra', plazoHasta: '2026-10-25T16:09:00Z' },
        { ...EN_CURSO.revocacion!.entidades[0], codigo: 'sin-plazo', plazoHasta: null },
      ];

      expect(limiteSondeo({ ...EN_CURSO, revocacion: { ...EN_CURSO.revocacion!, entidades } })).toBe(
        Date.parse('2026-10-25T16:09:00Z') + MARGEN_SONDEO_MS,
      );
    });

    it('sin plazos o sin revocación no hay límite', () => {
      expect(limiteSondeo(ACTIVO)).toBeNull();
      const sinPlazo = { ...EN_CURSO.revocacion!, entidades: [{ ...EN_CURSO.revocacion!.entidades[0], plazoHasta: null }] };
      expect(limiteSondeo({ ...EN_CURSO, revocacion: sinPlazo })).toBeNull();
      expect(sondeoVencido(ACTIVO, Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('vence solo después del límite exacto', () => {
      const limite = limiteSondeo(EN_CURSO)!;

      expect(sondeoVencido(EN_CURSO, limite - 1)).toBe(false);
      expect(sondeoVencido(EN_CURSO, limite)).toBe(false);
      expect(sondeoVencido(EN_CURSO, limite + 1)).toBe(true);
    });
  });

  describe('motivoNoRevocable (CA-4)', () => {
    it.each([
      ['activo', ACTIVO, null],
      ['en curso', EN_CURSO, 'revocado'],
      ['revocado', REVOCADO, 'revocado'],
      ['parcial', PARCIAL, 'parcial'],
      ['vencido', VENCIDO, 'vencido'],
    ] as const)('%s → %s', (_nombre, estado, esperado) => {
      expect(motivoNoRevocable(estado)).toBe(esperado);
    });

    it('un activo que el backend marca no revocable no inventa un motivo', () => {
      expect(motivoNoRevocable({ ...ACTIVO, revocable: false })).toBeNull();
    });
  });

  describe('normalizarReferencia y errorReferencia (S2)', () => {
    it('colapsa los espacios repetidos y recorta', () => {
      expect(normalizarReferencia('  TCK   2026 \n 04 ')).toBe('TCK 2026 04');
      expect('TCK  2026').toHaveLength(9);
      expect(normalizarReferencia('TCK  2026')).toHaveLength(8);
    });

    it.each([
      ['', 'required'],
      ['   ', 'required'],
      ['AB', 'out_of_range'],
      ['A B', null],
      ['ABC', null],
      ['A'.repeat(64), null],
      ['A'.repeat(65), 'out_of_range'],
      ['TCK  2026', null],
      ['  AB  ', 'out_of_range'],
      ['A' + ' '.repeat(80) + 'B', null],
      ['Órden 12', 'invalid_format'],
      ['Año 2026', 'invalid_format'],
      ['TCK-2026/04 #3_a.b', null],
      ['TCK@2026', 'invalid_format'],
      ['TCK<2026>', 'invalid_format'],
    ] as const)('«%s» → %s', (texto, esperado) => {
      expect(errorReferencia(texto)).toBe(esperado);
    });

    it('cuenta el largo después de colapsar los espacios', () => {
      expect(errorReferencia('A' + ' '.repeat(63) + 'B')).toBeNull();
      expect(errorReferencia('a'.repeat(32) + '   ' + 'b'.repeat(32))).toBe('out_of_range');
    });
  });

  describe('faltantes', () => {
    it('lista, en el orden del modal, lo que falta', () => {
      expect(faltantes({ motivo: '', referencia: '', rolConfirmado: false })).toEqual(['motivo', 'referencia', 'rolConfirmado']);
      expect(faltantes({ motivo: 'customer_request', referencia: '', rolConfirmado: false })).toEqual(['referencia', 'rolConfirmado']);
      expect(faltantes({ motivo: '', referencia: 'TCK-1', rolConfirmado: true })).toEqual(['motivo']);
      expect(faltantes({ motivo: 'regulatory_order', referencia: 'Órden', rolConfirmado: true })).toEqual(['referencia']);
      expect(faltantes({ motivo: 'regulatory_order', referencia: 'AB', rolConfirmado: true })).toEqual(['referencia']);
    });

    it('queda vacía cuando se puede enviar', () => {
      expect(faltantes({ motivo: 'customer_request', referencia: 'TCK-2026-0412', rolConfirmado: true })).toEqual([]);
    });
  });

  describe('solicitadaPor (F4)', () => {
    it('distingue la sesión actual, otro analista y el titular', () => {
      expect(solicitadaPor(EN_CURSO.revocacion!, 'sub-operaciones')).toBe('tu');
      expect(solicitadaPor(EN_CURSO.revocacion!, 'sub-otro')).toBe('operaciones');
      expect(solicitadaPor(EN_CURSO.revocacion!, null)).toBe('operaciones');
      expect(solicitadaPor(EN_APP.revocacion!, 'sub-titular')).toBe('titular');
    });
  });

  describe('otorgadoEn', () => {
    it('sale de la entrada granted del historial', () => {
      expect(otorgadoEn(ACTIVO)).toBe('2026-10-20T15:00:00Z');
    });

    it('es null si el historial no la trae', () => {
      expect(otorgadoEn({ ...ACTIVO, historial: [] })).toBeNull();
    });
  });
});
