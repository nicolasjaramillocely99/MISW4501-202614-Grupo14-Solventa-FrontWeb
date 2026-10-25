import { HttpErrorResponse } from '@angular/common/http';
import {
  ACCIONES_DTO,
  EMISION_ACEPTADA_DTO,
  EMISION_DOCUMENTO_FALLIDO_DTO,
  EMISION_EN_COBRO_DTO,
  EMISION_EXCEPCION_DTO,
  EMISION_NOTIFICADA_DTO,
  LISTA_EMISIONES_DTO,
} from '@testing/emision-monitor-pruebas';

import {
  ErrorEmision,
  aParametrosEmisiones,
  limiteDelDia,
  mapearEmision,
  mapearListaAcciones,
  mapearListaEmisiones,
  mapearReintento,
  rangoValido,
  traducirErrorEmision,
  ultimoPaso,
} from './emision-monitor.modelos';

const SIN_FILTROS = { estado: null, canal: null, desde: null, hasta: null };

describe('modelos del monitoreo de emisiones (HU-W1.3-04)', () => {
  it('traduce una excepción al modelo del cliente', () => {
    expect(mapearEmision(EMISION_EXCEPCION_DTO)).toEqual({
      aceptacionId: 'acc-0004',
      ofertaId: 'off-0004',
      clienteId: 'cliente-0001',
      nombreCliente: 'Luis Fernando Castro',
      canal: 'web',
      estado: 'exception',
      paso: 'premium_charge',
      aceptadaEn: '2026-10-20T15:04:05Z',
      actualizadaEn: '2026-10-20T15:04:05Z',
      monto: 89500,
      moneda: 'COP',
      intentos: 9,
      polizaId: null,
      motivo: 'retry_window_expired',
      fallaEn: '2026-10-20T15:30:00Z',
      notificadaEn: null,
      sinAtender: true,
      reanudaciones: 0,
      ultimaReanudacionEn: null,
      ultimaReanudacionPor: null,
    });
  });

  it('una emisión solo aceptada no trae prima, nombre ni motivo', () => {
    const e = mapearEmision(EMISION_ACEPTADA_DTO);

    expect(e.monto).toBeNull();
    expect(e.moneda).toBeNull();
    expect(e.nombreCliente).toBeNull();
    expect(e.motivo).toBeNull();
    expect(e.sinAtender).toBe(false);
  });

  it('una notificada trae su fecha de aviso y su póliza', () => {
    const e = mapearEmision(EMISION_NOTIFICADA_DTO);

    expect(e.estado).toBe('notified');
    expect(e.notificadaEn).toBe('2026-10-20T15:05:00Z');
    expect(e.polizaId).toBe('pol-acc-0006');
  });

  it('mantiene el orden de la lista y traduce los conteos de las tarjetas', () => {
    const lista = mapearListaEmisiones(LISTA_EMISIONES_DTO);

    expect(lista.emisiones.map((e) => e.aceptacionId)).toEqual([
      'acc-0004',
      'acc-0005',
      'acc-0006',
      'acc-0003',
      'acc-0002',
      'acc-0001',
    ]);
    expect(lista.conteos).toEqual({
      aceptadas: 18,
      enCobro: 6,
      enCobroConReintentos: 2,
      activasHoy: 42,
      notificadasHoy: 40,
      enExcepcion: 3,
      sinAtender: 1,
    });
  });

  it('sin emisiones la lista es vacía, no un error', () => {
    expect(mapearListaEmisiones({ items: [], counts: LISTA_EMISIONES_DTO.counts }).emisiones).toEqual([]);
  });

  it('traduce el historial de acciones con su tipo, autor, nota y fecha', () => {
    const [reintento, reanudacion] = mapearListaAcciones({ items: ACCIONES_DTO });

    expect(reintento).toEqual({
      id: 2,
      accion: 'retry',
      autor: 'ops-2',
      nota: 'El generador volvió',
      creadaEn: '2026-10-20T17:00:00Z',
    });
    expect(reanudacion.accion).toBe('resume');
    expect(mapearListaAcciones({ items: [] })).toEqual([]);
  });

  it('traduce el resultado de un reintento', () => {
    expect(mapearReintento({ acceptance_id: 'acc-0004', action: 'resume' })).toEqual({
      aceptacionId: 'acc-0004',
      accion: 'resume',
    });
  });

  describe('último paso', () => {
    it('de una excepción lo dice el motivo', () => {
      expect(ultimoPaso(mapearEmision(EMISION_EXCEPCION_DTO)).clave).toBe('retry_window_expired');
      expect(ultimoPaso(mapearEmision(EMISION_DOCUMENTO_FALLIDO_DTO)).clave).toBe('document_generation_failed');
    });

    it('del cobro dice si ya reintentó, con el número de intentos', () => {
      expect(ultimoPaso(mapearEmision(EMISION_EN_COBRO_DTO))).toEqual({ clave: 'premium_charge_retrying', intentos: 3 });
      expect(ultimoPaso(mapearEmision({ ...EMISION_EN_COBRO_DTO, attempts: 0 })).clave).toBe('premium_charge');
    });

    it('del resto lo dice el paso', () => {
      expect(ultimoPaso(mapearEmision(EMISION_ACEPTADA_DTO)).clave).toBe('underwriting');
      expect(ultimoPaso(mapearEmision({ ...EMISION_EN_COBRO_DTO, step: 'awaiting_payment_method' })).clave).toBe(
        'awaiting_payment_method',
      );
      expect(ultimoPaso(mapearEmision({ ...EMISION_NOTIFICADA_DTO, status: 'active', step: 'contract_document' })).clave).toBe(
        'contract_document',
      );
      expect(ultimoPaso(mapearEmision({ ...EMISION_NOTIFICADA_DTO, status: 'active', step: 'notification' })).clave).toBe(
        'notification',
      );
      expect(ultimoPaso(mapearEmision(EMISION_NOTIFICADA_DTO)).clave).toBe('completed');
    });
  });

  describe('filtros', () => {
    it('el día de calendario se acota en la zona local, de 00:00:00.000 a 23:59:59.999', () => {
      const inicio = new Date(limiteDelDia('2026-10-20', false) as string);
      const fin = new Date(limiteDelDia('2026-10-20', true) as string);

      expect([inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), inicio.getHours(), inicio.getMinutes()]).toEqual([
        2026, 9, 20, 0, 0,
      ]);
      expect([fin.getDate(), fin.getHours(), fin.getMinutes(), fin.getSeconds(), fin.getMilliseconds()]).toEqual([
        20, 23, 59, 59, 999,
      ]);
    });

    it('una fecha que no es de calendario no se envía', () => {
      expect(limiteDelDia('20/10/2026', false)).toBeNull();
      expect(limiteDelDia('', true)).toBeNull();
    });

    it('sin filtros solo viaja el inicio del día del analista, para las tarjetas de «hoy»', () => {
      const params = aParametrosEmisiones(SIN_FILTROS, new Date(2026, 9, 20, 15, 30));

      expect(Object.keys(params)).toEqual(['day_from']);
      const inicio = new Date(params['day_from']);
      expect([inicio.getDate(), inicio.getHours(), inicio.getMinutes()]).toEqual([20, 0, 0]);
    });

    it('con filtros usa los nombres del contrato', () => {
      const params = aParametrosEmisiones({ estado: 'exception', canal: 'mobile', desde: '2026-10-19', hasta: '2026-10-20' });

      expect(Object.keys(params).sort()).toEqual(['channel', 'day_from', 'from', 'status', 'to']);
      expect(params['status']).toBe('exception');
      expect(params['channel']).toBe('mobile');
      expect(new Date(params['from']) < new Date(params['to'])).toBe(true);
    });

    it('el rango es válido si falta un extremo o la fecha inicial no pasa de la final', () => {
      expect(rangoValido(SIN_FILTROS)).toBe(true);
      expect(rangoValido({ ...SIN_FILTROS, desde: '2026-10-20' })).toBe(true);
      expect(rangoValido({ ...SIN_FILTROS, desde: '2026-10-20', hasta: '2026-10-20' })).toBe(true);
      expect(rangoValido({ ...SIN_FILTROS, desde: '2026-10-21', hasta: '2026-10-20' })).toBe(false);
    });
  });

  describe('errores', () => {
    const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

    it('usa el código estable del cuerpo', () => {
      expect(traducirErrorEmision(http(409, { error: 'issuance_not_retryable' })).codigo).toBe('issuance_not_retryable');
    });

    it('sin código reconocible decide por el estado HTTP', () => {
      const codigos = [400, 401, 403, 404, 409, 500, 503].map((s) => traducirErrorEmision(http(s)).codigo);

      expect(codigos).toEqual([
        'invalid_request',
        'unauthorized',
        'forbidden',
        'issuance_not_found',
        'issuance_not_retryable',
        'charge_unavailable',
        'charge_unavailable',
      ]);
    });

    it('un código desconocido en el cuerpo no se toma por válido', () => {
      expect(traducirErrorEmision(http(503, { error: 'otra_cosa' })).codigo).toBe('charge_unavailable');
    });

    it('algo que no es HTTP (red) es servicio no disponible', () => {
      const error = traducirErrorEmision(new Error('red'));

      expect(error).toBeInstanceOf(ErrorEmision);
      expect(error.codigo).toBe('charge_unavailable');
    });
  });
});
