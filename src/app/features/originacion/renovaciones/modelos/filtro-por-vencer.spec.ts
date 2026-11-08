import {
  SIN_CRITERIOS,
  TAMANO_PAGINA,
  esDiaValido,
  filtroDesdeParametros,
  parametrosDesdeFiltro,
  rangoValido,
  totalPaginas,
} from './filtro-por-vencer';

describe('filtro de las pólizas próximas a vencer (HU-W1.5-01)', () => {
  describe('filtroDesdeParametros', () => {
    it('sin parámetros no filtra (el backend aplica la ventana) y pide la primera página de 20', () => {
      expect(filtroDesdeParametros({})).toEqual({ ...SIN_CRITERIOS, pagina: 1, tamano: TAMANO_PAGINA });
      expect(TAMANO_PAGINA).toBe(20);
    });

    it('lee el rango, el estado y la página de la URL', () => {
      expect(filtroDesdeParametros({ desde: ' 2026-10-01 ', hasta: '2026-10-31', estado: 'renewal_in_progress', pagina: '3' })).toEqual({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        estado: 'renewal_in_progress',
        pagina: 3,
        tamano: 20,
      });
    });

    it('descarta lo que no es válido sin romper la página', () => {
      expect(
        filtroDesdeParametros({ desde: '01/10/2026', hasta: '2026-02-30', estado: 'cancelled_non_payment', pagina: '-2' }),
      ).toEqual({ ...SIN_CRITERIOS, pagina: 1, tamano: 20 });
      expect(filtroDesdeParametros({ pagina: '1.5' }).pagina).toBe(1);
    });

    it('con un parámetro repetido toma el primero', () => {
      expect(filtroDesdeParametros({ estado: ['expiring', 'renewal_in_progress'], desde: [7] }).estado).toBe('expiring');
      expect(filtroDesdeParametros({ desde: [7] }).desde).toBeNull();
    });
  });

  describe('parametrosDesdeFiltro', () => {
    it('lleva a la URL solo lo que tiene valor y la página después de la primera', () => {
      expect(parametrosDesdeFiltro({ ...SIN_CRITERIOS, pagina: 1 })).toEqual({});
      expect(parametrosDesdeFiltro({ desde: '2026-10-01', hasta: '2026-10-31', estado: 'expiring', pagina: 2 })).toEqual({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        estado: 'expiring',
        pagina: '2',
      });
      expect(parametrosDesdeFiltro({ ...SIN_CRITERIOS })).toEqual({});
    });

    it('ida y vuelta: la URL reproduce el mismo filtro', () => {
      const filtro = { desde: '2026-12-01', hasta: '2026-12-15', estado: 'expiring' as const, pagina: 4, tamano: 20 };

      expect(filtroDesdeParametros(parametrosDesdeFiltro(filtro))).toEqual(filtro);
    });
  });

  it('el rango es válido si «Hasta» no es anterior a «Vencen desde» (o falta uno)', () => {
    expect(rangoValido({ desde: '2026-10-01', hasta: '2026-10-01' })).toBe(true);
    expect(rangoValido({ desde: '2026-10-01', hasta: '2026-10-31' })).toBe(true);
    expect(rangoValido({ desde: '2026-10-31', hasta: '2026-10-01' })).toBe(false);
    expect(rangoValido({ desde: null, hasta: '2026-10-01' })).toBe(true);
    expect(rangoValido({ desde: '2026-10-01', hasta: null })).toBe(true);
  });

  it('reconoce solo días reales AAAA-MM-DD', () => {
    expect(esDiaValido('2028-02-29')).toBe(true);
    expect(esDiaValido('2026-02-29')).toBe(false);
    expect(esDiaValido('2026-13-01')).toBe(false);
    expect(esDiaValido('2026-1-1')).toBe(false);
  });

  it('cuenta las páginas, al menos una', () => {
    expect(totalPaginas(0, 20)).toBe(1);
    expect(totalPaginas(20, 20)).toBe(1);
    expect(totalPaginas(21, 20)).toBe(2);
    expect(totalPaginas(5, 0)).toBe(5);
  });
});
