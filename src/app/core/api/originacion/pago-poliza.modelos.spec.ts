import { HttpErrorResponse } from '@angular/common/http';
import {
  DETALLE_CANCELADA_DTO,
  POLIZA_CANCELADA_DTO,
  POLIZA_EN_GRACIA_DTO,
} from '@testing/cancelacion-pruebas';
import { POLIZA_LISTADA_DTO } from '@testing/renovacion-pruebas';

import { ErrorPoliza, mapearDetallePoliza, traducirErrorPoliza } from './detalle-poliza.modelos';
import { mapearPolizaListada } from './renovacion.modelos';

// HU-W1.6-02: la prima mensual, la cancelación por no pago y el detalle de la póliza.

describe('modelos del pago y la cancelación de la póliza (HU-W1.6-02)', () => {
  it('una póliza en gracia trae su cuota pendiente', () => {
    const p = mapearPolizaListada(POLIZA_EN_GRACIA_DTO);

    expect(p.pago?.estado).toBe('payment_pending');
    expect(p.pago?.pendiente).toEqual({
      mes: 4,
      venceEn: '2026-09-01T12:00:00Z',
      graciaHasta: '2026-10-01T12:00:00Z',
      cancelaEn: '2026-10-02T12:00:00Z',
      monto: 142300,
      moneda: 'COP',
      intentos: 1,
      proximoIntentoEn: '2026-09-09T12:00:00Z',
    });
    expect(p.cancelacion).toBeNull();
  });

  it('una póliza cancelada trae la cancelación, sin reembolso', () => {
    const p = mapearPolizaListada(POLIZA_CANCELADA_DTO);

    expect(p.pago?.estado).toBe('cancelled');
    expect(p.cancelacion).toEqual({
      motivo: 'non_payment',
      canceladaEn: '2026-09-12T05:00:00Z',
      mes: 2,
      venceEn: '2026-08-12T05:00:00Z',
      graciaHasta: '2026-09-11T05:00:00Z',
      monto: 142300,
      moneda: 'COP',
      intentos: 3,
      correoEnviadoEn: '2026-09-12T05:01:00Z',
    });
  });

  it('una respuesta anterior a 0.17.0 se lee sin pago ni cancelación', () => {
    const p = mapearPolizaListada(POLIZA_LISTADA_DTO);

    expect(p.pago).toBeNull();
    expect(p.cancelacion).toBeNull();
  });

  it('el detalle trae el medio de pago y cada mes con sus intentos', () => {
    const d = mapearDetallePoliza(DETALLE_CANCELADA_DTO);

    expect(d.medioDePago?.ultimosCuatro).toBe('0010');
    expect(d.meses.map((m) => [m.mes, m.tipo, m.estado])).toEqual([
      [2, 'installment', 'unpaid'],
      [1, 'issuance', 'paid'],
    ]);
    expect(d.meses[0].intentos[2]).toEqual({
      intento: 3,
      resultado: 'declined',
      codigoRechazo: '51',
      intentadoEn: '2026-08-27T05:00:00Z',
    });
    expect(
      mapearDetallePoliza({ ...DETALLE_CANCELADA_DTO, payment_method: null }).medioDePago,
    ).toBeNull();
  });

  it('traduce los errores del detalle', () => {
    const http = (status: number) => new HttpErrorResponse({ status });

    expect(traducirErrorPoliza(http(404)).codigo).toBe('policy_not_found');
    expect(traducirErrorPoliza(http(400)).codigo).toBe('policy_not_found');
    expect(traducirErrorPoliza(http(401)).codigo).toBe('unauthorized');
    expect(traducirErrorPoliza(http(403)).codigo).toBe('forbidden');
    expect(traducirErrorPoliza(http(503)).codigo).toBe('renewal_unavailable');
    expect(traducirErrorPoliza(new Error('red'))).toBeInstanceOf(ErrorPoliza);
  });
});
