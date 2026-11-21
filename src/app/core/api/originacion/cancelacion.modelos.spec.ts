import { HttpErrorResponse } from '@angular/common/http';
import {
  CANCELACION_EN_PROCESO_DTO,
  COTIZACION_CANCELACION_DTO,
  COTIZACION_DIA_SIGUIENTE_DTO,
  POLIZA_CANCELADA_A_PEDIDO_DTO,
} from '@testing/cancelacion-voluntaria-pruebas';

import {
  ErrorCancelacion,
  aSolicitudCancelacionDto,
  mapearCotizacionCancelacion,
  traducirErrorCancelacion,
} from './cancelacion.modelos';
import { mapearPolizaListada } from './renovacion.modelos';

// HU-W1.6-01: la cotización y la confirmación de la cancelación con reembolso prorrateado.

describe('modelos de la cancelación a solicitud del asegurado (HU-W1.6-01)', () => {
  it('la cotización trae el cálculo que A5 muestra antes de confirmar (CA-1)', () => {
    expect(mapearCotizacionCancelacion(COTIZACION_CANCELACION_DTO)).toEqual({
      polizaId: 'pol-acc-220331',
      efectivaEn: '2026-12-04T04:59:59Z',
      periodoPagado: {
        mes: 1,
        tipo: 'issuance',
        inicio: '2026-11-18T15:00:00Z',
        fin: '2026-12-18T15:00:00Z',
        montoPagado: 142300,
        moneda: 'COP',
      },
      diasNoUtilizados: 14,
      diasPeriodo: 30,
      porcentajeProrrateo: 46.7,
      montoReembolso: 66406,
      moneda: 'COP',
      medioReembolso: { tipo: 'card', marca: 'visa', ultimosCuatro: '1111', codigoBanco: null },
      estadoPago: 'up_to_date',
    });
  });

  it('la confirmación lleva el monto visto, la aceptación y los comentarios recortados', () => {
    expect(
      aSolicitudCancelacionDto({ motivo: 'property_sold', comentarios: '  vendí el apartamento ', montoReembolso: 66406 }),
    ).toEqual({ reason: 'property_sold', comments: 'vendí el apartamento', refund_amount: 66406, accept_terms: true });
    expect(aSolicitudCancelacionDto({ motivo: 'other', comentarios: '   ', montoReembolso: 0 }).comments).toBeNull();
  });

  it('una póliza cancelada a solicitud trae el reembolso con su monto, fecha, medio y referencia (CA-2)', () => {
    const c = mapearPolizaListada(POLIZA_CANCELADA_A_PEDIDO_DTO).cancelacion;

    expect(c?.motivo).toBe('insured_request');
    if (c?.motivo !== 'insured_request') {
      return;
    }
    expect(c.efectivaEn).toBe(CANCELACION_EN_PROCESO_DTO.effective_at);
    expect(c.reembolso).toBe('in_process');
    expect(c.motivoAsegurado).toEqual({ codigo: 'mortgage_paid', comentarios: null });
    expect(c.detalleReembolso).toMatchObject({
      referencia: 'REF-2026-00001',
      monto: 66406,
      registradoEn: '2026-12-03T15:00:00Z',
      medio: { tipo: 'card', marca: 'visa', ultimosCuatro: '1111', codigoBanco: null },
    });
  });

  it('traduce los conflictos y trae la cotización nueva cuando cambió el monto', () => {
    const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

    const cambio = traducirErrorCancelacion(http(409, { error: 'refund_changed', quote: COTIZACION_DIA_SIGUIENTE_DTO }));
    expect(cambio.codigo).toBe('refund_changed');
    expect(cambio.cotizacion?.montoReembolso).toBe(61663);

    const codigos = [
      http(409, { error: 'payment_in_progress' }),
      http(409, { error: 'renewal_in_progress' }),
      http(409, { error: 'policy_already_cancelled' }),
      http(409, { error: 'policy_not_in_force' }),
      http(404, { error: 'policy_not_found' }),
      http(422, { error: 'invalid_request' }),
      http(401, {}),
      http(403, {}),
      http(503, {}),
      new Error('sin red'),
    ].map((e) => traducirErrorCancelacion(e).codigo);
    expect(codigos).toEqual([
      'payment_in_progress',
      'renewal_in_progress',
      'policy_already_cancelled',
      'policy_not_in_force',
      'policy_not_found',
      'invalid_request',
      'unauthorized',
      'forbidden',
      'cancellation_unavailable',
      'cancellation_unavailable',
    ]);
    expect(new ErrorCancelacion('forbidden').cotizacion).toBeNull();
  });
});
