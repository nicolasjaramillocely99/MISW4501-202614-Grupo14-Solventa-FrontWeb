import { HttpErrorResponse } from '@angular/common/http';

import { COTIZACION_DTO } from '@testing/cotizacion-asistida-pruebas';

import {
  ClienteDto,
  ErrorCotizacionAsistida,
  RespaldoErrorCotizacion,
  aSolicitudDto,
  mapearCliente,
  mapearCotizacionAsistida,
  traducirErrorCotizacion,
} from './cotizacion-asistida.modelos';

const RESPALDO: RespaldoErrorCotizacion = { noEncontrado: 'quote_not_found', indisponible: 'quote_unavailable' };

function errorHttp(status: number, cuerpo: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, statusText: 'Error' });
}

describe('mapearCotizacionAsistida', () => {
  it('traduce la cotización del contrato al modelo del cliente', () => {
    expect(mapearCotizacionAsistida(COTIZACION_DTO)).toEqual({
      cotizacionId: '3f1c8a52-7d0e-4c1b-9d3a-0e6b1f7a2c44',
      clienteId: '9a7e5c10-2b3d-4e8f-a1c2-5d6e7f8a9b0c',
      documento: '1032456789',
      nombreCompleto: 'Ana María Pérez',
      correo: 'ana@example.com',
      montoAsegurado: 250000000,
      plazoMeses: 180,
      prima: 132800,
      moneda: 'COP',
      coberturas: [
        { codigo: 'death', montoAsegurado: 250000000 },
        { codigo: 'total_permanent_disability', montoAsegurado: 250000000 },
      ],
      versionTarifa: 'v1',
      modo: 'normal',
      origen: 'external_sources',
      puntaje: 0.44,
      categoria: 'standard',
      fechaPerfil: '2026-10-16T14:55:00Z',
      fuenteNoDisponible: null,
      aviso: null,
      creadaEn: '2026-10-16T15:00:00Z',
      venceEn: '2026-10-17T15:00:00Z',
      estado: 'valid',
      puedeFormalizar: true,
      motivoBloqueo: null,
    });
  });

  it('conserva el modo degradado y el motivo del bloqueo de una cotización vencida', () => {
    const cotizacion = mapearCotizacionAsistida({
      ...COTIZACION_DTO,
      mode: 'provisional',
      source: 'base_actuarial',
      profile_date: null,
      unavailable_source: 'open_finance',
      notice: 'personalization_unavailable',
      status: 'expired',
      can_formalize: false,
      blocked_reason: 'quote_expired',
    });

    expect(cotizacion).toMatchObject({
      modo: 'provisional',
      origen: 'base_actuarial',
      fechaPerfil: null,
      fuenteNoDisponible: 'open_finance',
      aviso: 'personalization_unavailable',
      estado: 'expired',
      puedeFormalizar: false,
      motivoBloqueo: 'quote_expired',
    });
  });
});

describe('mapearCliente', () => {
  it('traduce el cliente recuperado por documento', () => {
    const dto: ClienteDto = {
      customer_id: 'c1',
      document_id: '1032456789',
      full_name: 'Ana María Pérez',
      email: 'ana@example.com',
      birth_date: '1990-05-20',
    };

    expect(mapearCliente(dto)).toEqual({
      clienteId: 'c1',
      documento: '1032456789',
      nombreCompleto: 'Ana María Pérez',
      correo: 'ana@example.com',
      fechaNacimiento: '1990-05-20',
    });
  });
});

describe('aSolicitudDto', () => {
  it('arma el cuerpo del contrato en snake_case', () => {
    expect(
      aSolicitudDto({
        documento: '1032456789',
        nombreCompleto: 'Ana',
        correo: 'a@x.co',
        fechaNacimiento: '1990-05-20',
        montoAsegurado: 250000000,
        plazoMeses: 180,
        consentimientoActivo: true,
      }),
    ).toEqual({
      document_id: '1032456789',
      full_name: 'Ana',
      email: 'a@x.co',
      birth_date: '1990-05-20',
      insured_amount: 250000000,
      term_months: 180,
      consent_active: true,
    });
  });
});

describe('traducirErrorCotizacion', () => {
  it('trae todos los campos inválidos de un validation_failed con su código', () => {
    const error = traducirErrorCotizacion(
      errorHttp(422, {
        error: 'validation_failed',
        message: 'x',
        fields: [
          { field: 'email', code: 'invalid_format' },
          { field: 'birth_date', code: 'out_of_range' },
          { field: 'document_id', code: 'required' },
          { field: 'consent_active', code: 'required' },
        ],
      }),
      RESPALDO,
    );

    expect(error).toBeInstanceOf(ErrorCotizacionAsistida);
    expect(error.codigo).toBe('validation_failed');
    expect(error.campos).toEqual([
      { campo: 'correo', codigo: 'invalid_format' },
      { campo: 'fechaNacimiento', codigo: 'out_of_range' },
      { campo: 'documento', codigo: 'required' },
      { campo: 'consentimiento', codigo: 'required' },
    ]);
  });

  it('ignora los campos o códigos que el cliente no conoce', () => {
    const error = traducirErrorCotizacion(
      errorHttp(422, {
        error: 'validation_failed',
        fields: [{ field: 'desconocido', code: 'required' }, { field: 'email', code: 'otro' }, 'basura', null],
      }),
      RESPALDO,
    );

    expect(error.campos).toEqual([]);
    expect(
      traducirErrorCotizacion(errorHttp(422, { error: 'validation_failed', fields: 'no es lista' }), RESPALDO).campos,
    ).toEqual([]);
  });

  it('reconoce el resto de códigos del contrato por el cuerpo', () => {
    for (const codigo of ['consent_required', 'quote_not_found', 'customer_not_found', 'quote_unavailable']) {
      expect(traducirErrorCotizacion(errorHttp(422, { error: codigo, message: 'm' }), RESPALDO).codigo).toBe(codigo);
    }
  });

  it('sin cuerpo del contrato se apoya en el estado HTTP', () => {
    expect(traducirErrorCotizacion(errorHttp(400), RESPALDO).codigo).toBe('invalid_request');
    expect(traducirErrorCotizacion(errorHttp(401), RESPALDO).codigo).toBe('unauthorized');
    expect(traducirErrorCotizacion(errorHttp(403), RESPALDO).codigo).toBe('forbidden');
    expect(traducirErrorCotizacion(errorHttp(404), RESPALDO).codigo).toBe('quote_not_found');
    expect(traducirErrorCotizacion(errorHttp(502, '<html>'), RESPALDO).codigo).toBe('quote_unavailable');
    expect(traducirErrorCotizacion(errorHttp(0), RESPALDO).codigo).toBe('quote_unavailable');
  });

  it('un error que no es HTTP se trata como el 503 del endpoint', () => {
    expect(
      traducirErrorCotizacion(new Error('red'), { noEncontrado: 'customer_not_found', indisponible: 'customer_unavailable' }).codigo,
    ).toBe('customer_unavailable');
  });
});
