import { HttpErrorResponse } from '@angular/common/http';
import {
  CONDICIONES_RENOVACION_DTO,
  LISTA_POLIZAS_DTO,
  POLIZA_LISTADA_DTO,
  RENOVACION_ACEPTADA_DTO,
  RENOVACION_RENOVADA_DTO,
} from '@testing/renovacion-pruebas';

import {
  ErrorRenovacion,
  mapearCondicionesRenovacion,
  mapearPolizaListada,
  mapearRenovacion,
  traducirErrorRenovacion,
} from './renovacion.modelos';

describe('modelos de renovación en línea (HU-W1.5-02)', () => {
  it('traduce una póliza del listado con su ventana y sin renovación', () => {
    const poliza = mapearPolizaListada(POLIZA_LISTADA_DTO);

    expect(poliza.polizaId).toBe('pol-acc-118204');
    expect(poliza.titular).toBe('Carolina Pérez');
    expect(poliza.prima).toBe(142300);
    expect(poliza.coberturas[0]).toEqual({ codigo: 'death', valorAsegurado: 68000000 });
    expect(poliza.vigenciaHasta).toBe('2026-10-02T23:59:00Z');
    expect(poliza.ventana).toEqual({ abreEn: '2026-09-02T23:59:00Z', cierraEn: '2026-10-02T23:59:00Z' });
    expect(poliza.puedeRenovar).toBe(true);
    expect(poliza.renovacion).toBeNull();
    expect(LISTA_POLIZAS_DTO.items).toHaveLength(2);
  });

  it('traduce las condiciones vigentes y las recotizadas con el medio de pago registrado', () => {
    const c = mapearCondicionesRenovacion(CONDICIONES_RENOVACION_DTO);

    expect(c.vigente.prima).toBe(142300);
    expect(c.renovada.prima).toBe(149800);
    expect(c.renovada.vigenciaDesde).toBe(c.vigente.vigenciaHasta);
    expect(c.recotizada).toBe(true);
    expect(c.descuento).toBe(0.08);
    expect(c.medioDePago).toMatchObject({ tipo: 'card', marca: 'visa', ultimosCuatro: '1111' });
  });

  it('sin medio de pago registrado el medio es null', () => {
    expect(mapearCondicionesRenovacion({ ...CONDICIONES_RENOVACION_DTO, payment_method: null }).medioDePago).toBeNull();
  });

  it('traduce la renovación aceptada con su cobro y la renovada con la póliza nueva', () => {
    const aceptada = mapearRenovacion(RENOVACION_ACEPTADA_DTO);
    const renovada = mapearRenovacion(RENOVACION_RENOVADA_DTO);

    expect(aceptada.resumen).toMatchObject({ estado: 'accepted', cobroId: 'ren-pol-acc-118204-20261002', polizaNuevaId: null });
    expect(aceptada.cobro?.estado).toBe('pending');
    expect(renovada.resumen).toMatchObject({ estado: 'renewed', polizaNuevaId: 'pol-ren-pol-acc-118204-20261002' });
    expect(renovada.cobro?.polizaId).toBe('pol-ren-pol-acc-118204-20261002');
    expect(mapearRenovacion({ ...RENOVACION_ACEPTADA_DTO, charge: null }).cobro).toBeNull();
  });

  describe('traducirErrorRenovacion', () => {
    const http = (status: number, cuerpo: unknown = null) => new HttpErrorResponse({ status, error: cuerpo });

    it('usa el código estable del cuerpo', () => {
      for (const codigo of ['renewal_not_available', 'renewal_closed', 'renewal_not_found', 'policy_not_found']) {
        expect(traducirErrorRenovacion(http(409, { error: codigo, message: 'm' })).codigo).toBe(codigo);
      }
    });

    it('sin cuerpo del contrato decide por el estado HTTP', () => {
      const codigo = (status: number) => traducirErrorRenovacion(http(status)).codigo;

      expect(codigo(400)).toBe('invalid_request');
      expect(codigo(401)).toBe('unauthorized');
      expect(codigo(403)).toBe('forbidden');
      expect(codigo(404)).toBe('policy_not_found');
      expect(codigo(409)).toBe('renewal_not_available');
      expect(codigo(503)).toBe('renewal_unavailable');
      expect(traducirErrorRenovacion(http(500, { error: 'desconocido' })).codigo).toBe('renewal_unavailable');
    });

    it('un error que no es HTTP es servicio no disponible', () => {
      const error = traducirErrorRenovacion(new Error('red'));

      expect(error).toBeInstanceOf(ErrorRenovacion);
      expect(error.codigo).toBe('renewal_unavailable');
    });
  });
});
