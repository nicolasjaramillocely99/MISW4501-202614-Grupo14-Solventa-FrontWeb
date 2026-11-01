import { HttpErrorResponse } from '@angular/common/http';
import {
  ESTADO_ACTIVO_DTO,
  ESTADO_PARCIAL_DTO,
  ESTADO_REVOCADO_EN_APP_DTO,
} from '@testing/revocacion-pruebas';

import {
  CodigoErrorRevocacion,
  ErrorRevocacion,
  EstadoRevocacionDto,
  aSolicitudRevocacionDto,
  mapearEstadoRevocacion,
  mapearResultadoReintento,
  traducirErrorRevocacion,
} from './revocacion.modelos';

const respuesta = (status: number, cuerpo: unknown) => new HttpErrorResponse({ status, error: cuerpo });

describe('modelos de la revocación (HU-W4.2-02)', () => {
  describe('mapearEstadoRevocacion', () => {
    it('mapea el consentimiento activo del contrato: revocable y sin revocación', () => {
      const estado = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);

      expect(estado.consentimientoId).toBe('cns-4f1c2a9be0d34c6f8a7e5d1b2c3a4f5e');
      expect(estado.estado).toBe('active');
      expect(estado.revocable).toBe(true);
      expect(estado.titular).toEqual({ nombreCompleto: 'Ana María Pérez', documentoEnmascarado: '******4050' });
      expect(estado.alcance[0]).toEqual({
        codigo: 'open_finance',
        categoriasDatos: ['credit_products', 'balances', 'payment_behavior'],
        vigencia: '12_months',
      });
      expect(estado.alcance).toHaveLength(3);
      expect(estado.entidades).toEqual([{ codigo: 'aliado-banco-1', nombre: 'Banco Aliado' }]);
      expect(estado.revocacion).toBeNull();
      expect(estado.historial).toEqual([
        {
          estado: 'granted',
          ocurridoEn: '2026-10-20T15:00:00Z',
          entidadCodigo: null,
          tipoActor: null,
          canal: 'embedded',
          motivo: null,
          referencia: null,
        },
      ]);
    });

    it('mapea la vigencia, la finalidad y el canal de otorgamiento del contrato 0.6.0 (HU-W4.2-01)', () => {
      const estado = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);

      expect(estado).toMatchObject({
        otorgadoEn: '2026-10-20T15:00:00Z',
        venceEn: '2027-10-20T15:00:00Z',
        finalizadoEn: null,
        finalidad: 'risk_profiling_mortgage_life_offer',
        canalOtorgamiento: 'embedded',
        versionTerminos: 'v1',
      });
      expect(mapearEstadoRevocacion(ESTADO_PARCIAL_DTO).finalizadoEn).toBe('2026-10-25T16:00:00.123456Z');
      expect(mapearEstadoRevocacion(ESTADO_PARCIAL_DTO).historial[2].canal).toBe('compliance_portal');
    });

    it('tolera un estado sin los campos de 0.6.0: quedan en null', () => {
      const anterior: EstadoRevocacionDto = structuredClone(ESTADO_ACTIVO_DTO);
      delete anterior.granted_at;
      delete anterior.expires_at;
      delete anterior.ended_at;
      delete anterior.purpose;
      delete anterior.grant_channel;
      delete anterior.terms_version;
      delete anterior.history[0].channel;
      const estado = mapearEstadoRevocacion(anterior);

      expect(estado).toMatchObject({
        otorgadoEn: null,
        venceEn: null,
        finalizadoEn: null,
        finalidad: null,
        canalOtorgamiento: null,
        versionTerminos: null,
      });
      expect(estado.historial[0].canal).toBeNull();
    });

    it('mapea la revocación parcial con la entidad que no confirmó y la hora en que se agotó el plazo', () => {
      const estado = mapearEstadoRevocacion(ESTADO_PARCIAL_DTO);

      expect(estado.estado).toBe('partially_revoked');
      expect(estado.revocable).toBe(false);
      expect(estado.revocacion).toEqual({
        numeroComprobante: 'REV-2026-0089',
        solicitadaEn: '2026-10-25T16:00:00.123456Z',
        efectivaEn: '2026-10-25T16:00:00.123456Z',
        canal: 'compliance_portal',
        estadoAviso: 'partial',
        solicitadaPor: { tipo: 'operations', id: 'sub-operaciones' },
        motivo: 'customer_request',
        referencia: 'TCK-2026-0412',
        entidades: [
          {
            codigo: 'aliado-banco-1',
            nombre: 'Banco Aliado',
            estado: 'not_confirmed',
            confirmadaEn: null,
            plazoHasta: '2026-10-25T16:05:00.123456Z',
          },
        ],
      });
      expect(estado.historial.at(-1)).toMatchObject({ estado: 'revocation_not_confirmed', entidadCodigo: 'aliado-banco-1', tipoActor: 'system' });
    });

    it('mapea lo revocado desde la app: canal mobile_app, motivo y referencia en null', () => {
      const revocacion = mapearEstadoRevocacion(ESTADO_REVOCADO_EN_APP_DTO).revocacion;

      expect(revocacion?.canal).toBe('mobile_app');
      expect(revocacion?.solicitadaPor).toEqual({ tipo: 'holder', id: 'sub-titular' });
      expect(revocacion?.motivo).toBeNull();
      expect(revocacion?.referencia).toBeNull();
      expect(revocacion?.entidades[0]).toMatchObject({ estado: 'confirmed', confirmadaEn: '2026-10-25T16:01:10Z' });
    });

    it('conserva un canal que el cliente no conoce y tolera campos ausentes', () => {
      const dto = structuredClone(ESTADO_REVOCADO_EN_APP_DTO);
      dto.revocation!.channel = 'canal_nuevo';
      dto.revocation!.entities[0].deadline_at = null;
      delete (dto.revocation as { reason?: unknown }).reason;

      const revocacion = mapearEstadoRevocacion(dto).revocacion;

      expect(revocacion?.canal).toBe('canal_nuevo');
      expect(revocacion?.entidades[0].plazoHasta).toBeNull();
      expect(revocacion?.motivo).toBeNull();
    });
  });

  describe('mapearResultadoReintento', () => {
    it('lleva las entidades avisadas de nuevo y el estado resultante', () => {
      const resultado = mapearResultadoReintento({ retried_entities: ['aliado-banco-1'], state: ESTADO_PARCIAL_DTO });

      expect(resultado.entidadesReintentadas).toEqual(['aliado-banco-1']);
      expect(resultado.estado).toEqual(mapearEstadoRevocacion(ESTADO_PARCIAL_DTO));
    });
  });

  describe('aSolicitudRevocacionDto', () => {
    it('envía solo reason, reference y role_confirmed', () => {
      expect(aSolicitudRevocacionDto({ motivo: 'regulatory_order', referencia: 'ORD-9 / 2026', rolConfirmado: true })).toEqual({
        reason: 'regulatory_order',
        reference: 'ORD-9 / 2026',
        role_confirmed: true,
      });
    });
  });

  describe('traducirErrorRevocacion', () => {
    it.each<[number, CodigoErrorRevocacion]>([
      [400, 'invalid_request'],
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [404, 'consent_not_found'],
      [409, 'consent_already_revoked'],
      [409, 'consent_not_active'],
      [409, 'idempotency_key_reused'],
      [409, 'consent_not_revoked'],
      [409, 'nothing_to_retry'],
      [503, 'service_unavailable'],
    ])('el %i con error «%s» conserva el código del contrato', (estado, codigo) => {
      const error = traducirErrorRevocacion(respuesta(estado, { error: codigo, message: 'x' }));

      expect(error).toBeInstanceOf(ErrorRevocacion);
      expect(error.codigo).toBe(codigo);
      expect(error.campos).toEqual([]);
    });

    it('lleva los tres campos de validation_failed a la vez, con el nombre del modelo', () => {
      const error = traducirErrorRevocacion(
        respuesta(400, {
          error: 'validation_failed',
          message: 'one or more fields are invalid',
          fields: [
            { field: 'reason', code: 'required' },
            { field: 'reference', code: 'out_of_range' },
            { field: 'role_confirmed', code: 'must_be_true' },
            { field: 'campo_desconocido', code: 'required' },
            { field: 'reference', code: 'codigo_desconocido' },
          ],
        }),
      );

      expect(error.codigo).toBe('validation_failed');
      expect(error.campos).toEqual([
        { campo: 'motivo', codigo: 'required' },
        { campo: 'referencia', codigo: 'out_of_range' },
        { campo: 'rolConfirmado', codigo: 'must_be_true' },
      ]);
    });

    it('tolera un validation_failed sin lista de campos', () => {
      expect(traducirErrorRevocacion(respuesta(400, { error: 'validation_failed' })).campos).toEqual([]);
      expect(traducirErrorRevocacion(respuesta(400, { error: 'validation_failed', fields: ['x', null] })).campos).toEqual([]);
    });

    it('un error de la Idempotency-Key es del cliente (invalid_request), no del analista', () => {
      const error = traducirErrorRevocacion(
        respuesta(400, { error: 'validation_failed', fields: [{ field: 'Idempotency-Key', code: 'invalid_format' }] }),
      );

      expect(error.codigo).toBe('invalid_request');
      expect(error.campos).toEqual([]);
    });

    it('sin cuerpo JSON resuelve por el estado HTTP', () => {
      const porEstado = [400, 401, 403, 404, 409, 500, 502, 503].map((estado) => traducirErrorRevocacion(respuesta(estado, '')).codigo);

      expect(porEstado).toEqual([
        'invalid_request',
        'unauthorized',
        'forbidden',
        'consent_not_found',
        'consent_already_revoked',
        'service_unavailable',
        'service_unavailable',
        'service_unavailable',
      ]);
    });

    it('un código desconocido en el cuerpo también resuelve por el estado HTTP', () => {
      expect(traducirErrorRevocacion(respuesta(404, { error: 'otra_cosa' })).codigo).toBe('consent_not_found');
      expect(traducirErrorRevocacion(respuesta(500, { error: 'otra_cosa' })).codigo).toBe('service_unavailable');
    });

    it('un error de red o que no es HTTP es service_unavailable', () => {
      expect(traducirErrorRevocacion(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })).codigo).toBe('service_unavailable');
      expect(traducirErrorRevocacion(new Error('x')).codigo).toBe('service_unavailable');
      expect(traducirErrorRevocacion(undefined).codigo).toBe('service_unavailable');
    });
  });
});
