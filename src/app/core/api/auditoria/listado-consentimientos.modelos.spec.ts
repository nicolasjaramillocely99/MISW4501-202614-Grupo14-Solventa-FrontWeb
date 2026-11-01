import { HttpErrorResponse } from '@angular/common/http';
import { PAGINA_DTO, PAGINA_VACIA_DTO } from '@testing/listado-consentimientos-pruebas';

import {
  ErrorListado,
  FiltroConsentimientos,
  aParametrosListado,
  mapearPaginaConsentimientos,
  traducirErrorListado,
} from './listado-consentimientos.modelos';

const SIN_FILTRO: FiltroConsentimientos = { estado: null, desde: null, hasta: null, entidad: null, cliente: null, pagina: 1, tamano: 6 };

describe('modelos del listado de consentimientos (HU-W4.2-01)', () => {
  describe('aParametrosListado', () => {
    it('sin filtro envía solo la página y el tamaño', () => {
      expect(aParametrosListado(SIN_FILTRO).toString()).toBe('page=1&page_size=6');
    });

    it('envía cada filtro con el nombre del contrato y recorta la búsqueda', () => {
      const parametros = aParametrosListado({
        estado: 'revoked',
        desde: '2026-09-01',
        hasta: '2026-09-16',
        entidad: 'cooperativa-andina',
        cliente: '  Rojas Mejía ',
        pagina: 2,
        tamano: 6,
      });

      expect(parametros.get('status')).toBe('revoked');
      expect(parametros.get('granted_from')).toBe('2026-09-01');
      expect(parametros.get('granted_to')).toBe('2026-09-16');
      expect(parametros.get('entity')).toBe('cooperativa-andina');
      expect(parametros.get('q')).toBe('Rojas Mejía');
      expect(parametros.get('page')).toBe('2');
      expect(parametros.get('page_size')).toBe('6');
    });

    it('una búsqueda de solo espacios no se envía', () => {
      expect(aParametrosListado({ ...SIN_FILTRO, cliente: '   ' }).has('q')).toBe(false);
    });
  });

  describe('mapearPaginaConsentimientos', () => {
    it('mapea las filas, los totales, los indicadores y las entidades', () => {
      const pagina = mapearPaginaConsentimientos(PAGINA_DTO);

      expect(pagina.pagina).toBe(1);
      expect(pagina.tamano).toBe(6);
      expect(pagina.totalRegistros).toBe(1433);
      expect(pagina.totalPaginas).toBe(239);
      expect(pagina.items).toHaveLength(6);
      expect(pagina.items[0]).toEqual({
        consentimientoId: 'cns-55aa31',
        titular: { nombreCompleto: 'Carolina Pérez Ruiz', documentoEnmascarado: '******5678' },
        otorgadoEn: '2026-09-16T20:52:00Z',
        venceEn: '2027-09-16T20:52:00Z',
        finalizadoEn: null,
        estado: 'active',
        revocacion: null,
        canalOtorgamiento: 'embedded',
        alcance: [
          { codigo: 'open_finance', categoriasDatos: ['credit_products', 'balances', 'payment_behavior'], vigencia: '12_months' },
          { codigo: 'open_data', categoriasDatos: ['public_records'], vigencia: '12_months' },
          { codigo: 'kyc', categoriasDatos: ['identity_verification'], vigencia: 'single_use' },
        ],
        entidades: [{ codigo: 'aliado-banco-1', nombre: 'Banco Aliado' }],
      });
      expect(pagina.items[3].revocacion).toEqual({ efectivaEn: '2026-09-10T15:00:00Z', canal: 'mobile_app', estadoAviso: 'completed' });
      expect(pagina.items[3].finalizadoEn).toBe('2026-09-10T15:00:00Z');
      expect(pagina.indicadores).toEqual({
        activos: 1284,
        vencidos: 112,
        revocados30Dias: { total: 37, desdeApp: 12, desdePortal: 25 },
        fueraDePlazo: 0,
        calculadoEn: '2026-09-16T21:00:00Z',
      });
      expect(pagina.entidades).toEqual([
        { codigo: 'aliado-banco-1', nombre: 'Banco Aliado' },
        { codigo: 'cooperativa-andina', nombre: 'Cooperativa Andina' },
      ]);
    });

    it('una lista vacía es página 1 de 1, aunque el total de páginas llegue en 0', () => {
      const pagina = mapearPaginaConsentimientos({ ...PAGINA_VACIA_DTO, total_pages: 0 });

      expect(pagina.items).toEqual([]);
      expect(pagina.totalRegistros).toBe(0);
      expect(pagina.totalPaginas).toBe(1);
    });
  });

  describe('traducirErrorListado', () => {
    const respuesta = (status: number, cuerpo: unknown) => new HttpErrorResponse({ status, error: cuerpo });

    it('validation_failed trae todos los parámetros inválidos con el nombre del filtro', () => {
      const error = traducirErrorListado(
        respuesta(400, {
          error: 'validation_failed',
          message: 'one or more fields are invalid',
          fields: [
            { field: 'status', code: 'invalid_format' },
            { field: 'granted_to', code: 'out_of_range' },
            { field: 'page_size', code: 'out_of_range' },
            { field: 'desconocido', code: 'invalid_format' },
            'no es un objeto',
          ],
        }),
      );

      expect(error).toBeInstanceOf(ErrorListado);
      expect(error.codigo).toBe('validation_failed');
      expect(error.campos).toEqual([
        { campo: 'estado', codigo: 'invalid_format' },
        { campo: 'hasta', codigo: 'out_of_range' },
        { campo: 'tamano', codigo: 'out_of_range' },
      ]);
    });

    it.each([
      [400, null, 'validation_failed'],
      [401, { error: 'unauthorized', message: 'x' }, 'unauthorized'],
      [403, { error: 'forbidden', message: 'x' }, 'forbidden'],
      [503, { error: 'service_unavailable', message: 'x' }, 'service_unavailable'],
      [502, 'Bad Gateway', 'service_unavailable'],
      [0, null, 'service_unavailable'],
    ])('el estado %s se traduce a %s', (status, cuerpo, codigo) => {
      expect(traducirErrorListado(respuesta(status, cuerpo)).codigo).toBe(codigo);
    });

    it('validation_failed sin lista de campos queda sin campos', () => {
      expect(traducirErrorListado(respuesta(400, { error: 'validation_failed' })).campos).toEqual([]);
    });

    it('un error que no es HTTP es service_unavailable', () => {
      expect(traducirErrorListado(new Error('red')).codigo).toBe('service_unavailable');
    });
  });
});
