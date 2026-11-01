import { HttpErrorResponse } from '@angular/common/http';
import { SOLICITUD_AJUSTADA_DTO, SOLICITUD_PENDIENTE_DTO, SOLICITUD_RECHAZADA_DTO } from '@testing/revision-pruebas';

import {
  ErrorRevision,
  aRegistroDecisionDto,
  mapearListaSolicitudesRevision,
  mapearSolicitudRevision,
  traducirErrorRevision,
} from './revision.modelos';

function errorHttp(status: number, cuerpo: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, statusText: 'Error' });
}

describe('mapearSolicitudRevision', () => {
  it('traduce la solicitud pendiente con el detalle de su oferta', () => {
    expect(mapearSolicitudRevision(SOLICITUD_PENDIENTE_DTO)).toEqual({
      aceptacionId: '6af8ce61-2424-4ed2-8375-57eaf9f9ee67',
      ofertaId: 'demo-review-1792212135',
      clienteId: 'ff5a40b9-19f8-413a-8665-f73d9196fc6d',
      solicitante: { nombreCompleto: 'Carolina Pérez Ruiz', documento: 'CC 1020345678', correo: 'carolina@example.com' },
      oferta: { prima: 89500, moneda: 'COP', modo: 'provisional', venceEn: '2026-10-18T04:42:19.9766934Z' },
      motivo: 'provisional_offer',
      llegadaEn: '2026-10-17T04:42:19.9766934Z',
      estado: 'pending',
      decision: null,
    });
  });

  it('traduce la decisión de ajuste con la oferta nueva y el aviso al cliente (CA-4)', () => {
    const solicitud = mapearSolicitudRevision(SOLICITUD_AJUSTADA_DTO);

    expect(solicitud.oferta).toEqual({ prima: 89500, moneda: 'COP', modo: null, venceEn: null });
    expect(solicitud.decision).toEqual({
      decisionId: 'a37c997a-e061-4042-8621-2d365ed021bc',
      tipo: 'adjust',
      asesor: { id: '413ed637-0f56-4b36-b181-70fe3ee8e578', correo: 'asesor@example.com' },
      decididaEn: '2026-10-17T04:42:20.022742Z',
      observaciones: 'Ingreso declarado sin verificar',
      ajustePrimaPct: 10,
      ofertaAjustada: {
        ofertaId: 'adj-6af8ce61-2424-4ed2-8375-57eaf9f9ee67',
        prima: 98450,
        moneda: 'COP',
        venceEn: '2026-10-18T04:42:20.022742Z',
      },
      aviso: { canal: 'email', estado: 'sent', intentos: 0, enviadoEn: '2026-10-17T04:42:20.0484603Z' },
    });
  });

  it('traduce el rechazo sin oferta nueva y una aceptación sin aviso', () => {
    expect(mapearSolicitudRevision(SOLICITUD_RECHAZADA_DTO).decision).toMatchObject({
      tipo: 'reject',
      ajustePrimaPct: null,
      ofertaAjustada: null,
      aviso: { estado: 'pending', enviadoEn: null },
    });
    const aceptada = mapearSolicitudRevision({
      ...SOLICITUD_RECHAZADA_DTO,
      decision: { ...SOLICITUD_RECHAZADA_DTO.decision!, type: 'accept', observations: '', notification: null },
    });
    expect(aceptada.decision?.aviso).toBeNull();
  });
});

describe('mapearListaSolicitudesRevision', () => {
  it('traduce las solicitudes y los conteos de las dos pestañas', () => {
    const lista = mapearListaSolicitudesRevision({
      items: [SOLICITUD_PENDIENTE_DTO],
      counts: { pending: 1, decided: 12 },
    });

    expect(lista.solicitudes).toHaveLength(1);
    expect(lista.solicitudes[0].aceptacionId).toBe('6af8ce61-2424-4ed2-8375-57eaf9f9ee67');
    expect(lista.conteos).toEqual({ pendientes: 1, decididas: 12 });
  });
});

describe('aRegistroDecisionDto', () => {
  it('ajustar envía el porcentaje y las observaciones recortadas', () => {
    expect(aRegistroDecisionDto({ tipo: 'adjust', observaciones: '  Recargo  ', ajustePrimaPct: 12.5 })).toEqual({
      type: 'adjust',
      observations: 'Recargo',
      premium_adjustment_pct: 12.5,
    });
  });

  it('aceptar sin observaciones no envía campos vacíos ni porcentaje', () => {
    expect(aRegistroDecisionDto({ tipo: 'accept', observaciones: '   ', ajustePrimaPct: 10 })).toEqual({ type: 'accept' });
    expect(aRegistroDecisionDto({ tipo: 'reject', observaciones: 'Fuera de política' })).toEqual({
      type: 'reject',
      observations: 'Fuera de política',
    });
  });
});

describe('traducirErrorRevision', () => {
  it.each([
    'observations_required',
    'premium_adjustment_invalid',
    'review_request_not_found',
    'review_request_already_decided',
    'decision_continuation_pending',
    'decision_not_registered',
    'review_unavailable',
    'invalid_request',
  ] as const)('respeta el código %s del cuerpo', (codigo) => {
    const error = traducirErrorRevision(errorHttp(400, { error: codigo, message: 'x' }), 'review_unavailable');

    expect(error).toBeInstanceOf(ErrorRevision);
    expect(error.codigo).toBe(codigo);
  });

  it.each([
    [400, 'invalid_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'review_request_not_found'],
    [409, 'review_request_already_decided'],
    [500, 'decision_not_registered'],
    [502, 'decision_not_registered'],
  ] as const)('sin cuerpo del contrato, %i → %s', (status, codigo) => {
    expect(traducirErrorRevision(errorHttp(status, '<html>'), 'decision_not_registered').codigo).toBe(codigo);
  });

  it('un código desconocido o un error que no es HTTP usa el respaldo del endpoint', () => {
    expect(traducirErrorRevision(errorHttp(503, { error: 'otro' }), 'review_unavailable').codigo).toBe('review_unavailable');
    expect(traducirErrorRevision(new Error('red'), 'decision_not_registered').codigo).toBe('decision_not_registered');
  });
});
