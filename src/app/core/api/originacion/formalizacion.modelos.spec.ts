import { HttpErrorResponse } from '@angular/common/http';
import { CONFIRMACION_ENVIADA_DTO, FORMALIZACION_DTO } from '@testing/formalizacion-pruebas';

import {
  ErrorFormalizacion,
  aSolicitudFormalizacionDto,
  mapearConfirmacionEnviada,
  mapearFormalizacion,
  traducirErrorFormalizacion,
} from './formalizacion.modelos';

describe('modelos de formalización (HU-W1.1-03)', () => {
  it('traduce la confirmación enviada sin exponer ningún código', () => {
    expect(mapearConfirmacionEnviada(CONFIRMACION_ENVIADA_DTO)).toEqual({
      cotizacionId: CONFIRMACION_ENVIADA_DTO.quote_id,
      enviadoA: 'an***@example.com',
      venceEn: '2026-10-16T15:10:00Z',
    });
  });

  it('traduce la formalización: asesor, fecha y cotización de origen (CA-4)', () => {
    expect(mapearFormalizacion(FORMALIZACION_DTO)).toMatchObject({
      cotizacionId: FORMALIZACION_DTO.quote_id,
      asesorId: FORMALIZACION_DTO.advisor_id,
      asesorCorreo: 'laura.gomez@solventa.example',
      formalizadaEn: '2026-10-16T15:03:11Z',
      metodo: 'recorded_call',
      aceptadaEn: '2026-10-16T15:00:00Z',
      referencia: 'GRAB-2026-88910',
      estado: 'registered',
    });
  });

  describe('aSolicitudFormalizacionDto', () => {
    it('con la llamada grabada envía el medio, la fecha y la referencia, sin código', () => {
      expect(
        aSolicitudFormalizacionDto({ metodo: 'recorded_call', aceptadaEn: '2026-10-16T15:00:00Z', referencia: ' GRAB-1 ', codigo: '123456' }),
      ).toEqual({ acceptance: { method: 'recorded_call', accepted_at: '2026-10-16T15:00:00Z', reference: 'GRAB-1' } });
    });

    it('con el código de confirmación envía el código y omite la referencia vacía', () => {
      expect(
        aSolicitudFormalizacionDto({ metodo: 'confirmation_code', aceptadaEn: '2026-10-16T15:00:00Z', referencia: ' ', codigo: '482913' }),
      ).toEqual({ acceptance: { method: 'confirmation_code', accepted_at: '2026-10-16T15:00:00Z' }, confirmation_code: '482913' });
    });
  });

  describe('traducirErrorFormalizacion', () => {
    const http = (status: number, cuerpo: unknown) => new HttpErrorResponse({ status, error: cuerpo });

    it('usa el código del contrato cuando el cuerpo lo trae', () => {
      for (const codigo of [
        'quote_expired',
        'already_formalized',
        'invalid_confirmation_code',
        'confirmation_code_expired',
        'too_many_attempts',
        'code_delivery_unavailable',
      ]) {
        expect(traducirErrorFormalizacion(http(422, { error: codigo })).codigo).toBe(codigo);
      }
    });

    it('sin cuerpo del contrato decide por el estado HTTP', () => {
      expect(traducirErrorFormalizacion(http(400, null)).codigo).toBe('invalid_request');
      expect(traducirErrorFormalizacion(http(401, null)).codigo).toBe('unauthorized');
      expect(traducirErrorFormalizacion(http(403, null)).codigo).toBe('forbidden');
      expect(traducirErrorFormalizacion(http(404, null)).codigo).toBe('quote_not_found');
      expect(traducirErrorFormalizacion(http(409, null)).codigo).toBe('already_formalized');
      expect(traducirErrorFormalizacion(http(503, null)).codigo).toBe('formalization_unavailable');
      expect(traducirErrorFormalizacion(http(422, { error: 'otro' })).codigo).toBe('formalization_unavailable');
    });

    it('validation_failed trae todos los campos inválidos a la vez, con el nombre del formulario', () => {
      const error = traducirErrorFormalizacion(
        http(422, {
          error: 'validation_failed',
          fields: [
            { field: 'acceptance.reference', code: 'required' },
            { field: 'acceptance.accepted_at', code: 'out_of_range' },
            { field: 'confirmation_code', code: 'invalid_format' },
            { field: 'acceptance.method', code: 'required' },
            { field: 'otro', code: 'required' },
            { field: 'acceptance.reference', code: 'raro' },
            null,
          ],
        }),
      );

      expect(error.codigo).toBe('validation_failed');
      expect(error.campos).toEqual([
        { campo: 'referencia', codigo: 'required' },
        { campo: 'fecha', codigo: 'out_of_range' },
        { campo: 'codigo', codigo: 'invalid_format' },
        { campo: 'metodo', codigo: 'required' },
      ]);
    });

    it('validation_failed sin lista de campos no inventa ninguno', () => {
      expect(traducirErrorFormalizacion(http(422, { error: 'validation_failed' })).campos).toEqual([]);
    });

    it('un error que no es de HTTP es una falla del servicio', () => {
      const error = traducirErrorFormalizacion(new Error('red'));

      expect(error).toBeInstanceOf(ErrorFormalizacion);
      expect(error.codigo).toBe('formalization_unavailable');
    });
  });
});
