import { HttpErrorResponse } from '@angular/common/http';

import {
  AceptacionDto,
  ErrorAceptacion,
  RespaldoErrorAceptacion,
  esEstadoFinal,
  mapearAceptacion,
  mapearOfertaAjustada,
  traducirErrorAceptacion,
} from './aceptacion.modelos';

/** Respuestas capturadas del binario del backend (contrato HU-W1.3-01, §5.2 y §5.4). */
const EN_REVISION: AceptacionDto = {
  acceptance_id: '7131ceb6-2050-4c83-ab99-f47a4b870fb9',
  offer_id: 'demo-review-002',
  customer_id: '0f3c2a9e-1b7d-4c55-9a51-2f0d4e6b8c11',
  channel: 'web',
  accepted_at: '2026-10-12T01:54:42.7390974Z',
  status: 'in_review',
  underwriting: { outcome: 'human_review', reason: 'provisional_offer', decided_at: '2026-10-12T01:54:42.7390974Z' },
  processing: { attempts: 0, last_failure_at: null, next_attempt_at: null },
  updated_at: '2026-10-12T01:54:42.7390974Z',
};

const RESPALDO_GET: RespaldoErrorAceptacion = {
  noEncontrado: 'acceptance_not_found',
  indisponible: 'acceptance_unavailable',
};

function errorHttp(status: number, cuerpo: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, statusText: 'Error' });
}

describe('mapearAceptacion', () => {
  it('traduce la aceptación en revisión con su decisión de suscripción', () => {
    expect(mapearAceptacion(EN_REVISION)).toEqual({
      aceptacionId: '7131ceb6-2050-4c83-ab99-f47a4b870fb9',
      ofertaId: 'demo-review-002',
      clienteId: '0f3c2a9e-1b7d-4c55-9a51-2f0d4e6b8c11',
      canal: 'web',
      aceptadaEn: '2026-10-12T01:54:42.7390974Z',
      estado: 'in_review',
      suscripcion: { resultado: 'human_review', motivo: 'provisional_offer', decididaEn: '2026-10-12T01:54:42.7390974Z' },
      revision: null,
      procesamiento: { intentos: 0, ultimaFallaEn: null, proximoIntentoEn: null },
      actualizadaEn: '2026-10-12T01:54:42.7390974Z',
    });
  });

  it('conserva la suscripción nula y los intentos fallidos de una aceptación reanudándose', () => {
    const aceptacion = mapearAceptacion({
      ...EN_REVISION,
      status: 'registered',
      underwriting: null,
      processing: {
        attempts: 1,
        last_failure_at: '2026-10-12T01:54:44.4842859Z',
        next_attempt_at: '2026-10-12T01:54:46.4842859Z',
      },
    });

    expect(aceptacion.suscripcion).toBeNull();
    expect(aceptacion.procesamiento).toEqual({
      intentos: 1,
      ultimaFallaEn: '2026-10-12T01:54:44.4842859Z',
      proximoIntentoEn: '2026-10-12T01:54:46.4842859Z',
    });
  });
});

describe('mapearAceptacion con la decisión del asesor (HU-W1.1-02)', () => {
  /** Respuesta capturada del binario (contrato HU-W1.1-02, §2.4). */
  const AJUSTADA: AceptacionDto = {
    ...EN_REVISION,
    status: 'adjusted',
    review: {
      outcome: 'adjust',
      decided_at: '2026-10-17T04:42:20.022742Z',
      adjusted_offer: {
        offer_id: 'adj-6af8ce61-2424-4ed2-8375-57eaf9f9ee67',
        premium: 98450,
        currency: 'COP',
        expires_at: '2026-10-18T04:42:20.022742Z',
      },
    },
  };

  it('traduce el ajuste con la oferta nueva', () => {
    const aceptacion = mapearAceptacion(AJUSTADA);

    expect(aceptacion.estado).toBe('adjusted');
    expect(aceptacion.revision).toEqual({
      resultado: 'adjust',
      decididaEn: '2026-10-17T04:42:20.022742Z',
      ofertaAjustada: {
        ofertaId: 'adj-6af8ce61-2424-4ed2-8375-57eaf9f9ee67',
        prima: 98450,
        moneda: 'COP',
        venceEn: '2026-10-18T04:42:20.022742Z',
      },
    });
  });

  it('traduce el rechazo sin oferta nueva', () => {
    const aceptacion = mapearAceptacion({
      ...EN_REVISION,
      status: 'rejected',
      review: { outcome: 'reject', decided_at: '2026-10-17T04:42:20.2845185Z', adjusted_offer: null },
    });

    expect(aceptacion.estado).toBe('rejected');
    expect(aceptacion.revision).toEqual({ resultado: 'reject', decididaEn: '2026-10-17T04:42:20.2845185Z', ofertaAjustada: null });
  });

  it('trata como nula una revisión ausente (contrato anterior a 0.8.0) o nula', () => {
    expect(mapearAceptacion(EN_REVISION).revision).toBeNull();
    expect(mapearAceptacion({ ...EN_REVISION, review: null }).revision).toBeNull();
  });
});

describe('mapearOfertaAjustada', () => {
  it('devuelve null sin oferta', () => {
    expect(mapearOfertaAjustada(null)).toBeNull();
  });
});

describe('esEstadoFinal', () => {
  it.each([
    ['registered', false],
    ['issuance_pending', true],
    ['in_review', true],
    ['adjusted', true],
    ['rejected', true],
  ] as const)('%s → %s', (estado, esperado) => {
    expect(esEstadoFinal(estado)).toBe(esperado);
  });
});

describe('traducirErrorAceptacion', () => {
  it('usa el código estable del cuerpo, no el mensaje', () => {
    const error = traducirErrorAceptacion(
      errorHttp(404, { error: 'acceptance_not_found', message: 'cualquier texto' }),
      RESPALDO_GET,
    );

    expect(error).toBeInstanceOf(ErrorAceptacion);
    expect(error.codigo).toBe('acceptance_not_found');
    expect(error.venceEn).toBeNull();
  });

  it('conserva el fin de la vigencia de una oferta vencida', () => {
    const error = traducirErrorAceptacion(
      errorHttp(422, {
        error: 'offer_expired',
        message: 'the offer validity is over; request a new offer',
        offer_id: 'demo-expired-002',
        expires_at: '2026-10-12T00:54:44.4210077Z',
      }),
      { noEncontrado: 'offer_not_found', indisponible: 'acceptance_not_registered' },
    );

    expect(error.codigo).toBe('offer_expired');
    expect(error.venceEn).toBe('2026-10-12T00:54:44.4210077Z');
  });

  it.each([
    [400, 'invalid_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'acceptance_not_found'],
    [502, 'acceptance_unavailable'],
    [0, 'acceptance_unavailable'],
  ] as const)('sin cuerpo del contrato, el estado %s se trata como %s', (status, codigo) => {
    expect(traducirErrorAceptacion(errorHttp(status, '<html>gateway</html>'), RESPALDO_GET).codigo).toBe(codigo);
  });

  it('un código desconocido en el cuerpo cae al estado HTTP', () => {
    expect(traducirErrorAceptacion(errorHttp(503, { error: 'otro' }), RESPALDO_GET).codigo).toBe(
      'acceptance_unavailable',
    );
  });

  it('un error que no es HTTP se trata como el 503 del endpoint', () => {
    expect(
      traducirErrorAceptacion(new Error('red'), {
        noEncontrado: 'offer_not_found',
        indisponible: 'acceptance_not_registered',
      }).codigo,
    ).toBe('acceptance_not_registered');
  });
});
