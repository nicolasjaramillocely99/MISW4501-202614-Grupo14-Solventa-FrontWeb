import { EntradaHistorialTriage, PoliticaTriage } from '@core/api/siniestros/triage.modelos';

import {
  MAX_IDS_LOTE,
  descripcionHistorial,
  etiquetaBanda,
  etiquetaActor,
  etiquetaCausa,
  etiquetaDiasHabiles,
  etiquetaEstado,
  etiquetaObjetivo,
  etiquetaResolucion,
  etiquetaSeveridad,
  insigniaNivel,
  montoEnPesos,
  parsearIdsBusqueda,
  umbralesEnPesos,
} from './presentacion-triage';

/** Un traductor que devuelve la clave con sus parámetros, para ver qué clave pide cada función. */
const t = (clave: string, parametros?: Record<string, unknown>) =>
  parametros ? `${clave}|${JSON.stringify(parametros)}` : clave;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('presentación del triage (HU-W2.2-01)', () => {
  describe('insigniaNivel', () => {
    it.each([
      [1, 'error'],
      [2, 'advertencia'],
      [3, 'informacion'],
    ] as const)('Triage %s usa el tono %s y la clave con el nivel en texto', (nivel, tono) => {
      expect(insigniaNivel(nivel)).toEqual({ clave: `triage.niveles.${nivel}`, tono });
    });
  });

  describe('etiquetas por código con respaldo (F6)', () => {
    it('traduce los códigos conocidos', () => {
      expect(etiquetaSeveridad(t, 'medium')).toBe('triage.severidades.medium');
      expect(etiquetaBanda(t, 'unknown')).toBe('triage.bandas.unknown');
      expect(etiquetaCausa(t, 'estimated_amount_changed')).toBe('triage.causas.estimated_amount_changed');
      expect(etiquetaCausa(t, 'provider_report_received')).toBe('triage.causas.provider_report_received');
      expect(etiquetaEstado(t, 'pending')).toBe('triage.estados.pending');
    });

    it('el actor system es «automático» y uno nuevo se muestra crudo', () => {
      expect(etiquetaActor(t, 'system')).toBe('triage.historial.actores.system');
      expect(etiquetaActor(t, 'robot-v2')).toBe('robot-v2');
    });

    it('un código desconocido se muestra crudo', () => {
      expect(etiquetaSeveridad(t, 'critical')).toBe('critical');
      expect(etiquetaBanda(t, 'huge')).toBe('huge');
      expect(etiquetaCausa(t, 'causa_futura')).toBe('causa_futura');
      expect(etiquetaEstado(t, 'archived')).toBe('archived');
    });

    it('no confunde un código con una propiedad heredada', () => {
      expect(etiquetaCausa(t, 'constructor')).toBe('constructor');
      expect(etiquetaSeveridad(t, '__proto__')).toBe('__proto__');
    });
  });

  describe('objetivos y días hábiles', () => {
    it('1 día usa la forma singular y los demás la plural', () => {
      expect(etiquetaDiasHabiles(t, 1)).toBe('triage.diasHabilesUno');
      expect(etiquetaDiasHabiles(t, 5)).toBe('triage.diasHabiles|{"dias":5}');
    });

    it('immediate es «atención inmediata»', () => {
      expect(etiquetaObjetivo(t, { tipo: 'immediate', diasHabiles: null, diasResolucion: 2 })).toBe(
        'triage.objetivos.inmediato',
      );
    });

    it('business_days lleva los días hábiles', () => {
      expect(etiquetaObjetivo(t, { tipo: 'business_days', diasHabiles: 5, diasResolucion: 5 })).toBe(
        'triage.objetivos.diasHabiles|{"dias":"triage.diasHabiles|{\\"dias\\":5}"}',
      );
    });

    it('un tipo de objetivo que no conoce se muestra crudo', () => {
      const raro = { tipo: 'weekly', diasHabiles: null, diasResolucion: 3 } as never;

      expect(etiquetaObjetivo(t, raro)).toBe('weekly');
    });

    it('business_days sin días no rompe', () => {
      expect(etiquetaObjetivo(t, { tipo: 'business_days', diasHabiles: null, diasResolucion: 3 })).toBe('business_days');
    });

    it('la resolución del asegurado dice los días hábiles', () => {
      expect(etiquetaResolucion(t, 10)).toBe('triage.resolucion|{"dias":"triage.diasHabiles|{\\"dias\\":10}"}');
    });
  });

  describe('descripcionHistorial', () => {
    const base: EntradaHistorialTriage = {
      nivel: 2,
      nivelAnterior: null,
      severidad: 'medium',
      banda: 'low',
      montoEstimadoMinor: null,
      tipoSiniestro: 'water_damage',
      causas: ['entered_evaluation'],
      actor: 'system',
      versionPolitica: 'triage-policy-v1',
      evaluadoEn: '2026-10-31T04:20:28Z',
    };

    it('previous_level null es «asignado»', () => {
      expect(descripcionHistorial(base)).toEqual({
        tipo: 'asignado',
        nivelAnterior: null,
        nivel: 2,
        causas: ['entered_evaluation'],
      });
    });

    it('previous_level distinto es «recalculado» con los dos niveles', () => {
      expect(descripcionHistorial({ ...base, nivel: 1, nivelAnterior: 2, causas: ['estimated_amount_changed'] })).toEqual({
        tipo: 'recalculado',
        nivelAnterior: 2,
        nivel: 1,
        causas: ['estimated_amount_changed'],
      });
    });

    it('previous_level igual es «revisado»: cambió la información, no el nivel', () => {
      expect(descripcionHistorial({ ...base, nivel: 3, nivelAnterior: 3 }).tipo).toBe('revisado');
    });
  });

  describe('parsearIdsBusqueda', () => {
    it('vacío o solo separadores no trae ids', () => {
      expect(parsearIdsBusqueda('')).toEqual({ ids: [], invalidos: [], repetidos: [], excedeMaximo: false });
      expect(parsearIdsBusqueda(' ,\n ; ').ids).toEqual([]);
    });

    it('un id válido', () => {
      expect(parsearIdsBusqueda(uuid(1))).toEqual({ ids: [uuid(1)], invalidos: [], repetidos: [], excedeMaximo: false });
    });

    it('acepta comas, espacios, saltos de línea y punto y coma mezclados, en el orden escrito', () => {
      const resultado = parsearIdsBusqueda(`${uuid(3)}, ${uuid(1)}\n${uuid(2)} ;${uuid(4)}`);

      expect(resultado.ids).toEqual([uuid(3), uuid(1), uuid(2), uuid(4)]);
    });

    it('pasa a minúsculas y recorta', () => {
      const mayusculas = 'C6DD0D52-73B3-495E-8FB2-291F8BF6214E';

      expect(parsearIdsBusqueda(`  ${mayusculas}  `).ids).toEqual([mayusculas.toLowerCase()]);
    });

    it('quita los repetidos y los informa una vez', () => {
      const resultado = parsearIdsBusqueda(`${uuid(1)} ${uuid(1).toUpperCase()} ${uuid(1)} ${uuid(2)}`);

      expect(resultado.ids).toEqual([uuid(1), uuid(2)]);
      expect(resultado.repetidos).toEqual([uuid(1)]);
    });

    it('50 ids es el máximo permitido', () => {
      const ids = Array.from({ length: MAX_IDS_LOTE }, (_, i) => uuid(i + 1));

      const resultado = parsearIdsBusqueda(ids.join(','));

      expect(resultado.ids).toHaveLength(50);
      expect(resultado.excedeMaximo).toBe(false);
    });

    it('51 ids excede el máximo', () => {
      const ids = Array.from({ length: MAX_IDS_LOTE + 1 }, (_, i) => uuid(i + 1));

      expect(parsearIdsBusqueda(ids.join(' ')).excedeMaximo).toBe(true);
    });

    it('un UUID versión 1 (falla el 4) y una variante inválida son inválidos', () => {
      const v1 = '00000000-0000-1000-8000-000000000001';
      const variante = '00000000-0000-4000-c000-000000000001';

      const resultado = parsearIdsBusqueda(`${v1} ${variante}`);

      expect(resultado.ids).toEqual([]);
      expect(resultado.invalidos).toEqual([v1, variante]);
    });

    it('texto arbitrario y rutas se listan como inválidos sin repetirse', () => {
      const resultado = parsearIdsBusqueda(`../x abc ../x ${uuid(1)}`);

      expect(resultado.invalidos).toEqual(['../x', 'abc']);
      expect(resultado.ids).toEqual([uuid(1)]);
    });
  });

  describe('montos', () => {
    it('convierte centavos a pesos', () => {
      expect(montoEnPesos(480000000)).toBe(4800000);
      expect(montoEnPesos(0)).toBe(0);
    });

    it('los umbrales salen de la política', () => {
      const politica = { umbrales: { bajoMenorQueMinor: 500000000, altoMayorQueMinor: 3000000000 } } as PoliticaTriage;

      expect(umbralesEnPesos(politica)).toEqual({ bajo: 5000000, alto: 30000000 });
    });
  });
});
