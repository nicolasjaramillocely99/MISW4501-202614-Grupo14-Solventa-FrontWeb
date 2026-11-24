import { HttpErrorResponse } from '@angular/common/http';
import {
  CODIGO_ENVIADO_DTO,
  RECOTIZACION_CACHE_DTO,
  RECOTIZACION_DTO,
  RENOVACION_PAGO_FALLIDO_DTO,
  RENOVACION_SIN_NOMBRE_DTO,
  RENOVACION_SIN_RECOTIZAR_DTO,
} from '@testing/renovacion-asistida-pruebas';

import {
  CODIGOS_ERROR_RENOVACION_ASISTIDA,
  ErrorRenovacionAsistida,
  aSolicitudFormalizacionRenovacionDto,
  aSolicitudRecotizacionDto,
  mapearCodigoEnviado,
  mapearRecotizacion,
  mapearRenovacionAsistida,
  nombreDelAsesor,
  traducirErrorRenovacionAsistida,
} from './renovacion-asistida.modelos';

function errorHttp(status: number, cuerpo: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo });
}

describe('modelos de la renovación asistida (HU-W1.5-03)', () => {
  it('traduce la recotización sin puntaje, con los factores del motor y las fuentes', () => {
    const r = mapearRecotizacion(RECOTIZACION_DTO);

    expect(r).toMatchObject({
      recotizacionId: RECOTIZACION_DTO.requote_id,
      estado: 'valid',
      variacionPrima: 0.0527,
      descuento: 0.08,
      recotizada: true,
      versionMotor: 'v1',
      modo: 'normal',
      aviso: null,
      baseConsentimiento: 'audit_verified',
    });
    expect(r.vigente.prima).toBe(142300);
    expect(r.renovada).toMatchObject({ prima: 149800, vigenciaDesde: '2026-10-02T23:59:00Z', vigenciaHasta: '2027-10-02T23:59:00Z' });
    expect(r.factores[0]).toEqual({ codigo: 'base_monthly_rate', valor: 0.00045 });
    expect(r.fuentes).toEqual([
      { nombre: 'open_finance', estado: 'ok', latenciaMs: 96 },
      { nombre: 'open_data', estado: 'ok', latenciaMs: 88 },
      { nombre: 'kyc', estado: 'ok', latenciaMs: 64 },
    ]);
  });

  it('conserva el aviso y la fecha del perfil en modo degradado', () => {
    const r = mapearRecotizacion(RECOTIZACION_CACHE_DTO);

    expect(r).toMatchObject({ modo: 'provisional', origen: 'cache', aviso: 'last_profile_in_use', fechaPerfil: '2026-08-27T21:02:00Z' });
    expect(r.fuenteNoDisponible).toBe('open_finance');
  });

  it('traduce la vista de la página con la póliza, el medio y el modo de consentimiento', () => {
    const v = mapearRenovacionAsistida(RENOVACION_SIN_RECOTIZAR_DTO);

    expect(v.poliza).toMatchObject({
      polizaId: 'pol-acc-118204',
      linea: 'life',
      titular: { nombreCompleto: 'Carolina Pérez Ruiz', tipoDocumento: null, documento: '1020345678' },
    });
    expect(v.ventana).toEqual({ abreEn: '2026-09-02T23:59:00Z', cierraEn: '2026-10-02T23:59:00Z', abierta: true });
    expect(v.medioDePago).toMatchObject({ tipo: 'card', marca: 'visa', ultimosCuatro: '1111' });
    expect(v).toMatchObject({
      recotizacion: null,
      renovacion: null,
      formalizacion: null,
      cobro: null,
      modoConsentimiento: 'audit',
      puedeRecotizar: true,
      puedeFormalizar: false,
      motivoBloqueo: null,
    });
  });

  it('traduce la renovación en curso con el canal, el registro del asesor y el cobro fallido', () => {
    const v = mapearRenovacionAsistida(RENOVACION_PAGO_FALLIDO_DTO);

    expect(v.renovacion).toMatchObject({ estado: 'accepted', canal: 'advisor', reintentarHasta: '2026-09-19T21:06:00Z' });
    expect(v.formalizacion).toEqual({
      asesorId: 'sub-laura',
      asesorCorreo: 'asesor@example.com',
      asesorNombre: 'Laura Gómez',
      formalizadaEn: '2026-09-16T21:06:00Z',
      recotizacionId: RECOTIZACION_DTO.requote_id,
      metodo: 'recorded_call',
      aceptadaEn: '2026-09-16T21:05:00Z',
      referencia: 'GRAB-2026-88931',
    });
    expect(v.cobro).toEqual({
      estado: 'failed',
      motivoFalla: 'payment_rejected',
      codigoRechazo: '51',
      ultimaFallaEn: '2026-09-16T21:08:00Z',
      intentos: 1,
      polizaId: null,
    });
    expect(v.motivoBloqueo).toBe('renewal_closed');
  });

  it('nombra al asesor por su nombre o, sin él, por su correo', () => {
    expect(nombreDelAsesor(mapearRenovacionAsistida(RENOVACION_PAGO_FALLIDO_DTO).formalizacion!)).toBe('Laura Gómez');
    expect(nombreDelAsesor(mapearRenovacionAsistida(RENOVACION_SIN_NOMBRE_DTO).formalizacion!)).toBe('asesor@example.com');
  });

  it('traduce el código enviado', () => {
    expect(mapearCodigoEnviado(CODIGO_ENVIADO_DTO)).toEqual({
      recotizacionId: RECOTIZACION_DTO.requote_id,
      enviadoA: 'ca***@example.com',
      venceEn: '2026-09-16T21:12:00Z',
    });
  });

  it('arma los cuerpos de la recotización y de la formalización', () => {
    expect(aSolicitudRecotizacionDto(true)).toEqual({ consent_affirmed: true });
    expect(aSolicitudRecotizacionDto(false)).toEqual({});
    expect(
      aSolicitudFormalizacionRenovacionDto({
        recotizacionId: 'rq-1',
        metodo: 'recorded_call',
        aceptadaEn: '2026-09-16T21:05:00Z',
        referencia: ' GRAB-1 ',
      }),
    ).toEqual({ requote_id: 'rq-1', acceptance: { method: 'recorded_call', accepted_at: '2026-09-16T21:05:00Z', reference: 'GRAB-1' } });
  });

  it('reconoce cada código del contrato y los campos de la validación', () => {
    for (const codigo of CODIGOS_ERROR_RENOVACION_ASISTIDA) {
      expect(traducirErrorRenovacionAsistida(errorHttp(422, { error: codigo, message: 'm' })).codigo).toBe(codigo);
    }
    const error = traducirErrorRenovacionAsistida(
      errorHttp(422, {
        error: 'validation_failed',
        message: 'm',
        fields: [
          { field: 'requote_id', code: 'required' },
          { field: 'acceptance.method', code: 'invalid_format' },
          { field: 'acceptance.accepted_at', code: 'out_of_range' },
          { field: 'acceptance.reference', code: 'required' },
          { field: 'confirmation_code', code: 'invalid_format' },
          { field: 'consent_affirmed', code: 'required' },
          { field: 'desconocido', code: 'required' },
          { field: 'acceptance.method', code: 'raro' },
          'no es un objeto',
        ],
      }),
    );
    expect(error).toBeInstanceOf(ErrorRenovacionAsistida);
    expect(error.campos).toEqual([
      { campo: 'recotizacion', codigo: 'required' },
      { campo: 'metodo', codigo: 'invalid_format' },
      { campo: 'fecha', codigo: 'out_of_range' },
      { campo: 'referencia', codigo: 'required' },
      { campo: 'codigo', codigo: 'invalid_format' },
      { campo: 'consentimiento', codigo: 'required' },
    ]);
    expect(traducirErrorRenovacionAsistida(errorHttp(422, { error: 'validation_failed' })).campos).toEqual([]);
  });

  it('sin cuerpo del contrato decide por el estado', () => {
    const por = (status: number) => traducirErrorRenovacionAsistida(errorHttp(status, null)).codigo;

    expect([por(400), por(401), por(403), por(404), por(409), por(500)]).toEqual([
      'invalid_request',
      'unauthorized',
      'forbidden',
      'policy_not_found',
      'renewal_not_available',
      'renewal_unavailable',
    ]);
    expect(traducirErrorRenovacionAsistida(errorHttp(422, { error: 'otro' })).codigo).toBe('renewal_unavailable');
    expect(traducirErrorRenovacionAsistida(new Error('red')).codigo).toBe('renewal_unavailable');
  });
});
