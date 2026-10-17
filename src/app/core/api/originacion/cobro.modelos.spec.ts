import { HttpErrorResponse } from '@angular/common/http';

import { COBRO_PENDIENTE_DTO } from '@testing/cobro-pruebas';

import { ErrorCobro, esCobroFinal, mapearCobro, traducirErrorCobro } from './cobro.modelos';

function errorHttp(status: number, cuerpo: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, statusText: 'Error' });
}

describe('mapearCobro', () => {
  it('traduce el cobro pendiente con su clave, sus intentos y la ventana de reintentos', () => {
    expect(mapearCobro(COBRO_PENDIENTE_DTO)).toEqual({
      aceptacionId: '6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
      ofertaId: 'demo-active-001',
      clienteId: 'cust-1',
      aceptadaEn: '2026-10-16T19:04:58Z',
      estado: 'pending',
      claveIdempotencia: 'cobro-6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
      monto: 89500,
      moneda: 'COP',
      intentos: 3,
      ultimoIntentoEn: '2026-10-16T19:05:12.5Z',
      ultimaFallaEn: '2026-10-16T19:05:13.2Z',
      proximoIntentoEn: '2026-10-16T19:05:15.2Z',
      ventana: { iniciaEn: '2026-10-16T19:05:00Z', terminaEn: '2026-10-17T19:05:00Z' },
      motivoFalla: null,
      confirmadoEn: null,
      polizaId: null,
      coberturaActivadaEn: null,
      activacionPublicadaEn: null,
      reanudaciones: 0,
      actualizadoEn: '2026-10-16T19:05:13.2Z',
    });
  });

  it('trae la póliza y la activación de un cobro confirmado', () => {
    const cobro = mapearCobro({
      ...COBRO_PENDIENTE_DTO,
      status: 'confirmed',
      next_attempt_at: null,
      confirmed_at: '2026-10-16T19:06:00Z',
      policy_id: 'pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc',
      coverage_activated_at: '2026-10-16T19:06:00Z',
      activation_published_at: '2026-10-16T19:06:00.1Z',
    });

    expect(cobro.polizaId).toBe('pol-6f1c2a9e-1b2c-4d5e-8f90-123456789abc');
    expect(cobro.coberturaActivadaEn).toBe('2026-10-16T19:06:00Z');
    expect(cobro.activacionPublicadaEn).toBe('2026-10-16T19:06:00.1Z');
    expect(cobro.proximoIntentoEn).toBeNull();
  });
});

describe('esCobroFinal', () => {
  const base = mapearCobro(COBRO_PENDIENTE_DTO);

  it('pendiente y en curso siguen consultándose', () => {
    expect(esCobroFinal(base)).toBe(false);
    expect(esCobroFinal({ ...base, estado: 'in_progress' })).toBe(false);
  });

  it('confirmado sin póliza todavía sigue consultándose; con póliza termina', () => {
    expect(esCobroFinal({ ...base, estado: 'confirmed' })).toBe(false);
    expect(esCobroFinal({ ...base, estado: 'confirmed', polizaId: 'pol-1' })).toBe(true);
  });

  it('una excepción termina el seguimiento', () => {
    expect(esCobroFinal({ ...base, estado: 'failed', motivoFalla: 'retry_window_expired' })).toBe(true);
  });
});

describe('traducirErrorCobro', () => {
  it('usa el código del cuerpo del contrato', () => {
    expect(traducirErrorCobro(errorHttp(404, { error: 'charge_not_found', message: 'x' })).codigo).toBe(
      'charge_not_found',
    );
    expect(traducirErrorCobro(errorHttp(503, { error: 'charge_unavailable', message: 'x' })).codigo).toBe(
      'charge_unavailable',
    );
  });

  it('sin cuerpo del contrato, decide por el estado HTTP', () => {
    expect(traducirErrorCobro(errorHttp(400)).codigo).toBe('invalid_request');
    expect(traducirErrorCobro(errorHttp(401)).codigo).toBe('unauthorized');
    expect(traducirErrorCobro(errorHttp(403)).codigo).toBe('forbidden');
    expect(traducirErrorCobro(errorHttp(404, '<html>')).codigo).toBe('charge_not_found');
    expect(traducirErrorCobro(errorHttp(502, { error: 'otro' })).codigo).toBe('charge_unavailable');
  });

  it('un error que no es HTTP es charge_unavailable', () => {
    const error = traducirErrorCobro(new Error('red'));
    expect(error).toBeInstanceOf(ErrorCobro);
    expect(error.codigo).toBe('charge_unavailable');
    expect(error.message).toContain('charge_unavailable');
  });
});
