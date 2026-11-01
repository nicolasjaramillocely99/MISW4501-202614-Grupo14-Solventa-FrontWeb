import {
  LOTE_TRIAGE_DTO,
  POLITICA_TRIAGE_DTO,
  TRIAGE_ASEGURADO_DTO,
  TRIAGE_ASEGURADO_PENDIENTE_DTO,
  TRIAGE_OPERACIONES_DTO,
  TRIAGE_OPERACIONES_PENDIENTE_DTO,
} from '@testing/triage-pruebas';

import {
  TriageSiniestroDto,
  mapearPaginaTriage,
  mapearPoliticaTriage,
  mapearTriageSiniestro,
} from './triage.modelos';

describe('modelos del triage (HU-W2.2-01)', () => {
  describe('mapearTriageSiniestro', () => {
    it('la vista operations trae el cálculo vigente y el historial del más reciente al más antiguo', () => {
      const triage = mapearTriageSiniestro(TRIAGE_OPERACIONES_DTO);

      expect(triage.vista).toBe('operations');
      if (triage.vista !== 'operations') {
        return;
      }
      expect(triage.estado).toBe('assessed');
      expect(triage.actual).toEqual({
        nivel: 1,
        severidad: 'medium',
        banda: 'high',
        montoEstimadoMinor: 4000000000,
        moneda: 'COP',
        tipoSiniestro: 'water_damage',
        cobertura: 'water_damage',
        versionPolitica: 'triage-policy-v1',
        objetivo: { tipo: 'immediate', diasHabiles: null, diasResolucion: 2 },
        evaluadoEn: '2026-10-31T04:20:38.278329Z',
      });
      expect(triage.historial.map((fila) => [fila.nivelAnterior, fila.nivel])).toEqual([
        [2, 1],
        [null, 2],
      ]);
      expect(triage.historial[0]).toMatchObject({
        causas: ['estimated_amount_changed'],
        actor: 'system',
        montoEstimadoMinor: 4000000000,
      });
    });

    it('la vista operations pendiente trae actual en null y el historial vacío', () => {
      const triage = mapearTriageSiniestro(TRIAGE_OPERACIONES_PENDIENTE_DTO);

      expect(triage).toEqual({
        vista: 'operations',
        siniestroId: 'c6dd0d52-73b3-495e-8fb2-291f8bf6214e',
        estado: 'pending',
        actual: null,
        historial: [],
      });
    });

    it('la vista insured trae solo el nivel y los días de resolución', () => {
      expect(mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO)).toEqual({
        vista: 'insured',
        siniestroId: '8cde7aff-a3ed-4e19-8b9a-ba25f33d6b6a',
        estado: 'assessed',
        nivel: 3,
        diasResolucion: 10,
        evaluadoEn: '2026-10-31T04:20:36.276289Z',
      });
    });

    it('la vista insured pendiente llega con nulos', () => {
      expect(mapearTriageSiniestro(TRIAGE_ASEGURADO_PENDIENTE_DTO)).toMatchObject({
        vista: 'insured',
        estado: 'pending',
        nivel: null,
        diasResolucion: null,
        evaluadoEn: null,
      });
    });

    it('conserva una causa que el front no conoce (la política puede crecer)', () => {
      const dto = structuredClone(TRIAGE_OPERACIONES_DTO);
      if (dto.view === 'operations') {
        dto.history[0].causes = ['provider_report_received', 'causa_futura'];
      }

      const triage = mapearTriageSiniestro(dto);

      expect(triage.vista === 'operations' && triage.historial[0].causas).toEqual([
        'provider_report_received',
        'causa_futura',
      ]);
    });

    it('un monto ausente se trata como null', () => {
      const dto = structuredClone(TRIAGE_OPERACIONES_DTO) as Extract<TriageSiniestroDto, { view: 'operations' }>;
      delete (dto.current as { estimated_amount_minor?: number | null } | null)?.estimated_amount_minor;

      const triage = mapearTriageSiniestro(dto);

      expect(triage.vista === 'operations' && triage.actual?.montoEstimadoMinor).toBeNull();
    });
  });

  describe('mapearPaginaTriage', () => {
    it('conserva el orden pedido e incluye el id inexistente con nulos', () => {
      const filas = mapearPaginaTriage(LOTE_TRIAGE_DTO);

      expect(filas.map((fila) => fila.estado)).toEqual(['assessed', 'assessed', 'not_found']);
      expect(filas[1]).toMatchObject({ nivel: 1, severidad: 'high', banda: 'unknown' });
      expect(filas[0].objetivo).toEqual({ tipo: 'immediate', diasHabiles: null, diasResolucion: 2 });
      expect(filas[2]).toEqual({
        siniestroId: '00000000-0000-4000-8000-000000000000',
        estado: 'not_found',
        nivel: null,
        severidad: null,
        banda: null,
        objetivo: null,
        evaluadoEn: null,
      });
    });

    it('una fila pending llega con todo nulo salvo el id y el estado', () => {
      const filas = mapearPaginaTriage({
        items: [
          {
            claim_id: 'x',
            state: 'pending',
            level: null,
            severity: null,
            amount_band: null,
            target: null,
            assessed_at: null,
          },
        ],
      });

      expect(filas[0]).toMatchObject({ estado: 'pending', nivel: null, objetivo: null });
    });
  });

  describe('mapearPoliticaTriage', () => {
    it('traduce versión, umbrales, severidades y objetivos por nivel', () => {
      const politica = mapearPoliticaTriage(POLITICA_TRIAGE_DTO);

      expect(politica.version).toBe('triage-policy-v1');
      expect(politica.moneda).toBe('COP');
      expect(politica.umbrales).toEqual({ bajoMenorQueMinor: 500000000, altoMayorQueMinor: 3000000000 });
      expect(politica.severidades).toContainEqual({ ramo: 'auto', tipoSiniestro: 'glass', severidad: 'low' });
      expect(politica.objetivos.map((fila) => fila.nivel)).toEqual([1, 2, 3]);
      expect(politica.objetivos[0].objetivo).toEqual({ tipo: 'immediate', diasHabiles: null, diasResolucion: 2 });
      expect(politica.objetivos[1].objetivo).toEqual({ tipo: 'business_days', diasHabiles: 5, diasResolucion: 5 });
    });
  });
});
