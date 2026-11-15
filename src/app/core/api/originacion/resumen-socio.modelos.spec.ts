import { HttpErrorResponse } from '@angular/common/http';

import { aParametrosResumen, mapearResumenSocio, traducirErrorResumenSocio } from './resumen-socio.modelos';

describe('modelos del resumen del tablero del socio (HU-W3.2-01)', () => {
  it('envía solo el rango, nunca el socio (CA-4)', () => {
    expect(aParametrosResumen({ desde: '2026-09-10', hasta: '2026-09-16' }).toString()).toBe(
      'from=2026-09-10&to=2026-09-16',
    );
  });

  it('traduce el resumen sin datos con ceros (CA-3)', () => {
    expect(
      mapearResumenSocio({
        partner_id: 'socio-001',
        from: '2026-09-16',
        to: '2026-09-16',
        quotes_requested: 0,
        policies_issued: 0,
        conversion_rate: 0,
      }),
    ).toEqual({ socioId: 'socio-001', desde: '2026-09-16', hasta: '2026-09-16', cotizaciones: 0, polizasEmitidas: 0, tasaConversion: 0 });
  });

  it('usa el código del contrato cuando viene en el cuerpo', () => {
    const conCodigo = (codigo: string, status: number) =>
      traducirErrorResumenSocio(new HttpErrorResponse({ status, error: { error: codigo, message: 'm' } })).codigo;

    expect(conCodigo('out_of_range', 400)).toBe('out_of_range');
    expect(conCodigo('range_too_long', 400)).toBe('range_too_long');
    expect(conCodigo('metrics_unavailable', 503)).toBe('metrics_unavailable');
  });

  it('sin cuerpo del contrato decide por el estado', () => {
    const porEstado = (status: number) => traducirErrorResumenSocio(new HttpErrorResponse({ status })).codigo;

    expect(porEstado(400)).toBe('invalid_request');
    expect(porEstado(401)).toBe('unauthorized');
    expect(porEstado(403)).toBe('forbidden');
    expect(porEstado(502)).toBe('metrics_unavailable');
    expect(traducirErrorResumenSocio(new Error('x')).codigo).toBe('metrics_unavailable');
  });
});
