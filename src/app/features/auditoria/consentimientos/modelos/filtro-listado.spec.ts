import {
  SIN_CRITERIOS,
  TAMANO_PAGINA,
  describirFiltro,
  diaCorto,
  esDiaValido,
  filtroDesdeParametros,
  hayCriterios,
  parametrosDesdeFiltro,
  rangoRegistros,
  rangoValido,
} from './filtro-listado';

describe('filtro del listado de consentimientos (HU-W4.2-01)', () => {
  describe('filtroDesdeParametros', () => {
    it('sin parámetros no filtra y pide la primera página de 6', () => {
      expect(filtroDesdeParametros({})).toEqual({ ...SIN_CRITERIOS, pagina: 1, tamano: TAMANO_PAGINA });
    });

    it('lee cada criterio de la URL', () => {
      expect(
        filtroDesdeParametros({
          estado: 'partially_revoked',
          desde: '2026-09-01',
          hasta: '2026-09-16',
          entidad: 'cooperativa-andina',
          cliente: ' Rojas Mejía ',
          pagina: '3',
        }),
      ).toEqual({
        estado: 'partially_revoked',
        desde: '2026-09-01',
        hasta: '2026-09-16',
        entidad: 'cooperativa-andina',
        cliente: 'Rojas Mejía',
        pagina: 3,
        tamano: 6,
      });
    });

    it('descarta lo que no es válido en vez de romper la página', () => {
      expect(
        filtroDesdeParametros({
          estado: 'revocation_pending',
          desde: '2026-02-30',
          hasta: '16/09/2026',
          entidad: 'aliado banco',
          cliente: '   ',
          pagina: '-2',
        }),
      ).toEqual({ ...SIN_CRITERIOS, pagina: 1, tamano: 6 });
      expect(filtroDesdeParametros({ pagina: '2.5' }).pagina).toBe(1);
      expect(filtroDesdeParametros({ pagina: 'dos' }).pagina).toBe(1);
    });

    it('toma el primer valor de un parámetro repetido y recorta la búsqueda a 100 caracteres', () => {
      expect(filtroDesdeParametros({ estado: ['active', 'expired'] }).estado).toBe('active');
      expect(filtroDesdeParametros({ cliente: 'x'.repeat(150) }).cliente).toHaveLength(100);
    });
  });

  describe('parametrosDesdeFiltro', () => {
    it('solo lleva los criterios con valor y la página después de la primera', () => {
      expect(parametrosDesdeFiltro({ ...SIN_CRITERIOS, pagina: 1 })).toEqual({});
      expect(
        parametrosDesdeFiltro({ estado: 'revoked', desde: '2026-09-01', hasta: '2026-09-16', entidad: 'aliado-banco-1', cliente: ' ana ', pagina: 2 }),
      ).toEqual({ estado: 'revoked', desde: '2026-09-01', hasta: '2026-09-16', entidad: 'aliado-banco-1', cliente: 'ana', pagina: '2' });
    });

    it('es la inversa de filtroDesdeParametros', () => {
      const filtro = { estado: 'expired' as const, desde: '2025-01-01', hasta: null, entidad: null, cliente: 'perez', pagina: 4, tamano: 6 };

      expect(filtroDesdeParametros(parametrosDesdeFiltro(filtro))).toEqual(filtro);
    });
  });

  it('rangoValido: «Hasta» no puede ser anterior a «Otorgado desde»; el mismo día sí vale', () => {
    expect(rangoValido({ desde: '2026-09-16', hasta: '2026-09-01' })).toBe(false);
    expect(rangoValido({ desde: '2026-09-16', hasta: '2026-09-16' })).toBe(true);
    expect(rangoValido({ desde: '2026-09-01', hasta: null })).toBe(true);
    expect(rangoValido({ desde: null, hasta: '2026-09-01' })).toBe(true);
  });

  it('hayCriterios', () => {
    expect(hayCriterios(SIN_CRITERIOS)).toBe(false);
    expect(hayCriterios({ ...SIN_CRITERIOS, cliente: '  ' })).toBe(false);
    expect(hayCriterios({ ...SIN_CRITERIOS, entidad: 'aliado-banco-1' })).toBe(true);
  });

  it('rangoRegistros: «1 a 6», la última página corta y 0 sin registros', () => {
    const items = (n: number) => Array.from({ length: n });
    expect(rangoRegistros({ pagina: 1, tamano: 6, totalRegistros: 1433, items: items(6) })).toEqual({ primero: 1, ultimo: 6 });
    expect(rangoRegistros({ pagina: 3, tamano: 6, totalRegistros: 14, items: items(2) })).toEqual({ primero: 13, ultimo: 14 });
    expect(rangoRegistros({ pagina: 1, tamano: 6, totalRegistros: 0, items: [] })).toEqual({ primero: 0, ultimo: 0 });
    expect(rangoRegistros({ pagina: 9, tamano: 6, totalRegistros: 14, items: [] })).toEqual({ primero: 0, ultimo: 0 });
  });

  it('esDiaValido y diaCorto', () => {
    expect(esDiaValido('2024-02-29')).toBe(true);
    expect(esDiaValido('2025-02-29')).toBe(false);
    expect(esDiaValido('2026-13-01')).toBe(false);
    expect(diaCorto('2026-09-01')).toBe('01/09/2026');
    expect(diaCorto('otra cosa')).toBe('otra cosa');
  });

  it('describirFiltro: el nombre de la entidad del catálogo, las fechas cortas y si hay cliente', () => {
    const entidades = [{ codigo: 'cooperativa-andina', nombre: 'Cooperativa Andina' }];

    expect(
      describirFiltro(
        { estado: 'revoked', desde: '2026-09-01', hasta: '2026-09-16', entidad: 'cooperativa-andina', cliente: 'Rojas Mejía' },
        entidades,
      ),
    ).toEqual({ entidad: 'Cooperativa Andina', estado: 'revoked', desde: '01/09/2026', hasta: '16/09/2026', cliente: true });
    expect(describirFiltro({ ...SIN_CRITERIOS, entidad: 'sin-nombre' }, entidades).entidad).toBe('sin-nombre');
    expect(describirFiltro(SIN_CRITERIOS, entidades)).toEqual({ entidad: null, estado: null, desde: null, hasta: null, cliente: false });
  });
});
