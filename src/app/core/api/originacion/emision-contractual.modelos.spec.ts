import { HttpErrorResponse } from '@angular/common/http';
import { EMISION_COMPLETADA_DTO, EMISION_PENDIENTE_DTO } from '@testing/emision-contractual-pruebas';

import { esEmisionFinal, mapearEmisionContractual, traducirErrorEmision } from './emision-contractual.modelos';

const errorHttp = (status: number, cuerpo: unknown = null) => new HttpErrorResponse({ status, error: cuerpo, statusText: 'x' });

describe('mapearEmisionContractual', () => {
  it('traduce la emisión completada con su documento y su notificación', () => {
    expect(mapearEmisionContractual(EMISION_COMPLETADA_DTO)).toEqual({
      polizaId: 'pol-3f1c',
      estado: 'completed',
      activadaEn: '2026-10-16T15:00:00Z',
      disponibleEn: '2026-10-16T15:00:01Z',
      dentroDelPlazo: true,
      documento: { documentoId: 'b1e2', version: 1, tamanoBytes: 2310, generadoEn: '2026-10-16T15:00:01Z' },
      notificacion: { canal: 'email', estado: 'sent', intentos: 0, enviadaEn: '2026-10-16T15:00:01Z' },
    });
  });

  it('conserva los nulos mientras el documento no está listo', () => {
    const emision = mapearEmisionContractual(EMISION_PENDIENTE_DTO);
    expect(emision.documento).toBeNull();
    expect(emision.disponibleEn).toBeNull();
    expect(emision.dentroDelPlazo).toBeNull();
    expect(emision.notificacion.enviadaEn).toBeNull();
  });
});

describe('esEmisionFinal', () => {
  it('solo completed y failed son finales', () => {
    expect(esEmisionFinal('completed')).toBe(true);
    expect(esEmisionFinal('failed')).toBe(true);
    expect(esEmisionFinal('pending')).toBe(false);
    expect(esEmisionFinal('document_ready')).toBe(false);
  });
});

describe('traducirErrorEmision', () => {
  it('reconoce el código del cuerpo', () => {
    expect(traducirErrorEmision(errorHttp(404, { error: 'document_not_available' })).codigo).toBe('document_not_available');
  });

  it('sin cuerpo del contrato se apoya en el estado HTTP', () => {
    expect(traducirErrorEmision(errorHttp(400)).codigo).toBe('invalid_request');
    expect(traducirErrorEmision(errorHttp(401)).codigo).toBe('unauthorized');
    expect(traducirErrorEmision(errorHttp(403, new Blob())).codigo).toBe('forbidden');
    expect(traducirErrorEmision(errorHttp(404)).codigo).toBe('policy_not_found');
    expect(traducirErrorEmision(errorHttp(502, '<html>')).codigo).toBe('document_unavailable');
    expect(traducirErrorEmision(new Error('red')).codigo).toBe('document_unavailable');
  });
});
