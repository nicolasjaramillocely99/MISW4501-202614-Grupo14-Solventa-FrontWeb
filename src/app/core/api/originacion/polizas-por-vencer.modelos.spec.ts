import { HttpErrorResponse } from '@angular/common/http';
import {
  PAGINA_POR_VENCER_DTO,
  POLIZA_EN_RENOVACION_DTO,
  POLIZA_POR_VENCER_DTO,
  paginaPorVencerDto,
} from '@testing/polizas-por-vencer-pruebas';

import {
  ErrorPorVencer,
  aParametrosPorVencer,
  mapearPaginaPorVencer,
  mapearPolizaPorVencer,
  traducirErrorPorVencer,
} from './polizas-por-vencer.modelos';

describe('modelos de las pólizas próximas a vencer (HU-W1.5-01)', () => {
  it('traduce una póliza por vencer con su titular, su vencimiento, su ventana y sin renovación', () => {
    const poliza = mapearPolizaPorVencer(POLIZA_POR_VENCER_DTO);

    expect(poliza).toEqual({
      polizaId: 'pol-acc-118204',
      linea: 'life',
      producto: null,
      titular: { nombreCompleto: 'Carolina Pérez Ruiz', tipoDocumento: null, documento: '1020345678' },
      prima: 142300,
      moneda: 'COP',
      venceEn: '2026-10-02T23:59:00Z',
      estado: 'expiring',
      puedeRenovar: true,
      ventana: { abreEn: '2026-09-02T23:59:00Z', cierraEn: '2026-10-02T23:59:00Z' },
      renovacion: null,
    });
  });

  it('traduce la renovación en curso con el resumen de HU-W1.5-02', () => {
    const poliza = mapearPolizaPorVencer(POLIZA_EN_RENOVACION_DTO);

    expect(poliza.estado).toBe('renewal_in_progress');
    expect(poliza.puedeRenovar).toBe(false);
    expect(poliza.renovacion).toMatchObject({ estado: 'accepted', cobroId: 'ren-pol-acc-771003-20261005', cerradaEn: null });
  });

  it('un estado que el cliente no conoce (el contrato es ampliable) llega como «desconocido»', () => {
    expect(mapearPolizaPorVencer({ ...POLIZA_POR_VENCER_DTO, status: 'cancelled_non_payment' }).estado).toBe('desconocido');
  });

  it('traduce la página con el rango aplicado, la ventana, el indicador y el total', () => {
    const pagina = mapearPaginaPorVencer(PAGINA_POR_VENCER_DTO);

    expect(pagina.items).toHaveLength(3);
    expect(pagina).toMatchObject({
      desde: '2026-09-16',
      hasta: '2026-11-16',
      diasVentana: 30,
      vencenEnVentana: 12,
      total: 3,
      pagina: 1,
      tamano: 20,
    });
    expect(mapearPaginaPorVencer(paginaPorVencerDto({ items: [], total: 0 })).items).toEqual([]);
  });

  it('arma los parámetros del contrato solo con lo que tiene valor', () => {
    expect(aParametrosPorVencer({ desde: null, hasta: null, estado: null, pagina: 1, tamano: 20 }).toString()).toBe(
      'page=1&page_size=20',
    );
    expect(
      aParametrosPorVencer({ desde: '2026-10-01', hasta: '2026-10-31', estado: 'renewal_in_progress', pagina: 2, tamano: 20 }).toString(),
    ).toBe('page=2&page_size=20&expires_from=2026-10-01&expires_to=2026-10-31&status=renewal_in_progress');
  });

  describe('traducirErrorPorVencer', () => {
    const http = (status: number, cuerpo: unknown = null) => new HttpErrorResponse({ status, error: cuerpo });

    it('usa el código del contrato cuando viene en el cuerpo', () => {
      expect(traducirErrorPorVencer(http(400, { error: 'out_of_range', message: 'x' })).codigo).toBe('out_of_range');
      expect(traducirErrorPorVencer(http(400, { error: 'invalid_request', message: 'x' })).codigo).toBe('invalid_request');
      expect(traducirErrorPorVencer(http(503, { error: 'renewal_unavailable', message: 'x' })).codigo).toBe('renewal_unavailable');
    });

    it('sin cuerpo del contrato decide por el estado HTTP', () => {
      expect(traducirErrorPorVencer(http(400)).codigo).toBe('invalid_request');
      expect(traducirErrorPorVencer(http(401)).codigo).toBe('unauthorized');
      expect(traducirErrorPorVencer(http(403, { message: 'Forbidden' })).codigo).toBe('forbidden');
      expect(traducirErrorPorVencer(http(502, '<html>')).codigo).toBe('renewal_unavailable');
      expect(traducirErrorPorVencer(http(400, { error: 'otro' })).codigo).toBe('invalid_request');
    });

    it('un error que no es HTTP es «no disponible»', () => {
      const error = traducirErrorPorVencer(new Error('red'));

      expect(error).toBeInstanceOf(ErrorPorVencer);
      expect(error.codigo).toBe('renewal_unavailable');
      expect(error.name).toBe('ErrorPorVencer');
    });
  });
});
