import { HttpErrorResponse } from '@angular/common/http';
import { REGISTRO_DECISION_DTO } from '@testing/decision-pruebas';

import { ErrorDecision, mapearRegistroDecision, traducirErrorDecision } from './decision.modelos';

describe('modelos del registro de auditoría (HU-W4.1-01)', () => {
  it('traduce el contrato y ordena las reglas por su orden de ejecución', () => {
    const registro = mapearRegistroDecision(REGISTRO_DECISION_DTO);

    expect(registro.ofertaId).toBe('off-4f2a9c');
    expect(registro.solicitadaEn).toBe('2026-10-20T15:04:05Z');
    expect(registro.versionMotor).toBe('v1');
    expect(registro.reglas.map((r) => r.codigo)).toEqual(['base_monthly_rate', 'age_factor']);
    expect(registro.reglas.map((r) => r.orden)).toEqual([1, 2]);
    expect(registro.fuentes[0]).toEqual({
      fuente: 'open_finance',
      estado: 'ok',
      latenciaMs: 85,
      consultadaEn: '2026-10-20T15:04:05.120Z',
      puntaje: 0.82,
      categoria: 'preferred',
    });
    expect(registro.fuentes[1]).toEqual({
      fuente: 'kyc',
      estado: 'timeout',
      latenciaMs: 700,
      consultadaEn: '2026-10-20T15:04:05.120Z',
      puntaje: null,
      categoria: '',
    });
    expect(registro.consentimientoId).toBe('cns-7d1e');
    expect(registro.perfil).toEqual({ puntaje: 0.4, categoria: 'standard', parcial: true });
    expect(registro.decision).toBe('deferred');
    expect(registro.motivo).toBe('base_actuarial_profile');
  });

  it('deja el motivo vacío cuando se aceptó', () => {
    const sinMotivo = { ...REGISTRO_DECISION_DTO, decision: 'accepted' as const };
    delete sinMotivo.decision_reason;
    expect(mapearRegistroDecision(sinMotivo).motivo).toBe('');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'decision_not_found'],
    [500, 'service_unavailable'],
    [0, 'service_unavailable'],
  ])('traduce el estado %i a %s', (status, codigo) => {
    expect(traducirErrorDecision(new HttpErrorResponse({ status })).codigo).toBe(codigo);
  });

  it('trata un error que no es HTTP como servicio no disponible', () => {
    const error = traducirErrorDecision(new Error('boom'));
    expect(error).toBeInstanceOf(ErrorDecision);
    expect(error.codigo).toBe('service_unavailable');
  });
});
