import { HttpErrorResponse } from '@angular/common/http';
import {
  OFERTA_CON_CACHE_DTO,
  OFERTA_NORMAL_DTO,
  OFERTA_REDUCIDA_DTO,
  OFERTA_REEMPLAZADA_DTO,
} from '@testing/oferta-pruebas';

import { ErrorOferta, aSolicitudOfertaDto, mapearOferta, traducirErrorOferta } from './oferta.modelos';

function respuesta(status: number, cuerpo: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo });
}

describe('oferta.modelos', () => {
  it('traduce la oferta normal al modelo del cliente', () => {
    expect(mapearOferta(OFERTA_NORMAL_DTO)).toEqual({
      id: 'off-b948aa0f4d51e923a67c7cee087e94ed',
      clase: 'personalized',
      estado: 'active',
      primaMensual: 132000,
      moneda: 'COP',
      modo: 'normal',
      venceEn: '2026-10-19T15:53:01.627931Z',
      puedeAceptar: true,
      puedeRenovar: false,
      creadaEn: '2026-10-18T15:53:01.627931Z',
      motivoProvisional: null,
      fechaPerfil: null,
      fuenteNoDisponible: null,
      perfil: { categoria: 'standard', fuente: 'external_sources' },
      valorAsegurado: 250000000,
      plazoMeses: 240,
      coberturas: [
        { codigo: 'death', valorAsegurado: 250000000 },
        { codigo: 'total_permanent_disability', valorAsegurado: 250000000 },
      ],
      condiciones: ['validity_24h', 'onerous_beneficiary_lender', 'monthly_premium', 'max_insured_age_70'],
      versionMotor: 'v1',
      titular: 'Ana María Pérez',
      credito: { aliadoId: 'aliado-banco-1', solicitudId: '48213' },
      reemplazadaPor: null,
      renovadaPor: null,
    });
  });

  it('conserva el motivo, la fecha del perfil y la fuente caída de la oferta provisional', () => {
    const oferta = mapearOferta(OFERTA_CON_CACHE_DTO);

    expect(oferta.modo).toBe('provisional');
    expect(oferta.motivoProvisional).toBe('cached_profile');
    expect(oferta.fechaPerfil).toBe('2026-10-04T14:00:00Z');
    expect(oferta.fuenteNoDisponible).toBe('open_finance');
    expect(oferta.condiciones).toContain('provisional_requote_when_source_restored');
  });

  it('enlaza la oferta reemplazada con la que la sustituyó', () => {
    expect(mapearOferta(OFERTA_REEMPLAZADA_DTO)).toMatchObject({
      estado: 'superseded',
      reemplazadaPor: 'off-7618b94e3329fa1b05c7d6b5f4ab2297',
    });
  });

  it('acepta la vista reducida de una oferta de demostración sin términos ni condiciones', () => {
    const oferta = mapearOferta(OFERTA_REDUCIDA_DTO);

    expect(oferta).toMatchObject({
      clase: 'demo',
      primaMensual: 89500,
      perfil: null,
      valorAsegurado: null,
      plazoMeses: null,
      coberturas: [],
      condiciones: [],
      credito: null,
      titular: null,
    });
  });

  it('arma el cuerpo de POST /v1/offers en snake_case', () => {
    expect(
      aSolicitudOfertaDto({
        clienteId: 'cli-1',
        consentimientoId: 'cns-1',
        aliadoId: 'aliado-1',
        solicitudId: '48213',
        documento: '1020304050',
        nombreCompleto: 'Ana María Pérez',
        correo: 'ana@example.com',
        fechaNacimiento: '1988-04-12',
        valorAsegurado: 250000000,
        plazoMeses: 240,
      }),
    ).toEqual({
      customer_id: 'cli-1',
      consent_id: 'cns-1',
      partner_id: 'aliado-1',
      application_id: '48213',
      document_id: '1020304050',
      full_name: 'Ana María Pérez',
      email: 'ana@example.com',
      birth_date: '1988-04-12',
      insured_amount: 250000000,
      term_months: 240,
    });
  });

  describe('traducirErrorOferta', () => {
    it('usa el código del cuerpo y conserva el reemplazo del 409 offer_superseded', () => {
      const error = traducirErrorOferta(
        respuesta(409, { error: 'offer_superseded', message: 'x', offer_id: 'a', superseded_by: 'b' }),
      );

      expect(error).toBeInstanceOf(ErrorOferta);
      expect(error.codigo).toBe('offer_superseded');
      expect(error.reemplazadaPor).toBe('b');
    });

    it('conserva el fin de la vigencia del 409 offer_still_valid', () => {
      const error = traducirErrorOferta(
        respuesta(409, { error: 'offer_still_valid', message: 'x', expires_at: '2026-10-19T15:53:01Z' }),
      );

      expect(error.codigo).toBe('offer_still_valid');
      expect(error.venceEn).toBe('2026-10-19T15:53:01Z');
    });

    it.each([
      ['consent_required', 422],
      ['consent_mismatch', 422],
      ['consent_unverifiable', 503],
      ['validation_failed', 422],
    ])('reconoce %s', (codigo, estado) => {
      expect(traducirErrorOferta(respuesta(estado, { error: codigo, message: 'x' })).codigo).toBe(codigo);
    });

    it.each([
      [400, 'invalid_request'],
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [404, 'offer_not_found'],
      [502, 'offer_unavailable'],
    ])('sin cuerpo del contrato, el estado %i es %s', (estado, codigo) => {
      expect(traducirErrorOferta(respuesta(estado, null)).codigo).toBe(codigo);
    });

    it('ignora un código desconocido y cae al estado HTTP', () => {
      expect(traducirErrorOferta(respuesta(503, { error: 'otro', message: 'x' })).codigo).toBe('offer_unavailable');
    });

    it('trata un error que no es HTTP como oferta no disponible', () => {
      expect(traducirErrorOferta(new Error('red')).codigo).toBe('offer_unavailable');
    });
  });
});
