import { HttpErrorResponse } from '@angular/common/http';
import {
  APROBACION_EN_EXCEPCION_DTO,
  EVALUACION_DTO,
  PAGINA_COLA_DTO,
  RECHAZO_DTO,
  evaluacionCon,
} from '@testing/evaluacion-pruebas';

import {
  ErrorEvaluacion,
  aDestinoDto,
  calcularDesglose,
  mapearDecision,
  mapearEvaluacion,
  mapearPaginaCola,
  traducirErrorEvaluacion,
} from './evaluacion.modelos';

describe('modelos de la evaluación del siniestro (HU-W2.2-03)', () => {
  it('calcula el desglose con la regla del backend: el asegurado asume el deducible', () => {
    expect(calcularDesglose(4_350_000, 500)).toEqual({ bruto: 4_350_000, deducible: 217_500, neto: 4_132_500 });
    expect(calcularDesglose(4_350_000, 0)).toEqual({ bruto: 4_350_000, deducible: 0, neto: 4_350_000 });
    // 5 % de 0,15 pesos es 0,0075: se redondea al centavo como en domain.DeductibleOf.
    expect(calcularDesglose(0.15, 500)).toEqual({ bruto: 0.15, deducible: 0.01, neto: 0.14 });
  });

  it('convierte la cola a pesos y conserva la prioridad', () => {
    const pagina = mapearPaginaCola(PAGINA_COLA_DTO);

    expect(pagina.items[0]).toMatchObject({
      numeroRadicado: 'SIN-2026-01655',
      montoEstimado: 4_800_000,
      prioridad: { estado: 'assessed', nivel: 2 },
    });
    expect(pagina.items[1].montoEstimado).toBeNull();
    expect(pagina.items[1].prioridad.nivel).toBeNull();
  });

  it('convierte el detalle: cobertura, asegurado con la cuenta enmascarada y soportes firmados', () => {
    const e = mapearEvaluacion(EVALUACION_DTO);

    expect(e.siniestro.montoEstimado).toBe(4_350_000);
    expect(e.cobertura).toEqual({ incidente: 'water_damage', valorAsegurado: 320_000_000, moneda: 'COP', deduciblePuntosBasicos: 500 });
    expect(e.asegurado?.cuenta.numeroEnmascarado).toBe('•••• 4512');
    expect(e.soportes[0].urlDescarga).toBe('https://firmada/sup-1');
    expect(e.siniestro.evidencia[0]).toMatchObject({ tipo: 'photo', ubicacionConfiable: false });
    expect(e.prioridadActual?.nivel).toBe(2);
    expect(e.decision).toBeNull();
  });

  it('sin núcleo de pólizas no hay póliza, cobertura ni asegurado', () => {
    const e = mapearEvaluacion({ ...EVALUACION_DTO, policy: null, coverage: null, holder: null, policy_unavailable: true });

    expect(e.polizaNoDisponible).toBe(true);
    expect(e.poliza).toBeNull();
    expect(e.asegurado).toBeNull();
  });

  it('convierte la decisión: bruto, deducible y neto, y el pago en excepción', () => {
    const d = mapearDecision(APROBACION_EN_EXCEPCION_DTO);

    expect(d.aprobacion).toEqual({
      bruto: 4_350_000,
      valorAsegurado: 320_000_000,
      deduciblePuntosBasicos: 500,
      deducible: 217_500,
      neto: 4_132_500,
      moneda: 'COP',
    });
    expect(d.pago).toMatchObject({ estado: 'failed', falla: 'rejected', codigoPasarela: 'invalid_destination_account' });
    expect(mapearDecision(RECHAZO_DTO).rechazo?.motivo).toContain('mantenimiento');
    expect(mapearEvaluacion(evaluacionCon(RECHAZO_DTO)).siniestro.estado).toBe('rejected');
  });

  it('el destino corregido solo lleva el nombre del banco si se escribió', () => {
    expect(aDestinoDto({ codigoBanco: '1007', nombreBanco: '', tipoCuenta: 'savings', numeroCuenta: '0123-4567-12' })).toEqual({
      bank_code: '1007',
      account_type: 'savings',
      account_number: '0123-4567-12',
    });
  });

  it('traduce los errores por código del contrato o, sin él, por estado', () => {
    const con = (status: number, error: unknown = null) => traducirErrorEvaluacion(new HttpErrorResponse({ status, error }));

    expect(con(422, { error: 'amount_exceeds_insured_value' }).codigo).toBe('amount_exceeds_insured_value');
    expect(con(503, { error: 'policy_unavailable' }).codigo).toBe('policy_unavailable');
    expect(con(400).codigo).toBe('invalid_request');
    expect(con(401).codigo).toBe('unauthorized');
    expect(con(403).codigo).toBe('forbidden');
    expect(con(404).codigo).toBe('claim_not_found');
    expect(con(409, { error: 'otro' }).codigo).toBe('claim_not_decidable');
    expect(con(502).codigo).toBe('claims_unavailable');
    expect(traducirErrorEvaluacion(new Error('red'))).toEqual(new ErrorEvaluacion('claims_unavailable'));
  });
});
