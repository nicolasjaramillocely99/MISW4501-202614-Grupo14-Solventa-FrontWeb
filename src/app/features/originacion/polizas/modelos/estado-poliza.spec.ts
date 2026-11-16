import {
  POLIZA_AL_DIA_DTO,
  POLIZA_CANCELADA_DTO,
  POLIZA_EN_GRACIA_DTO,
} from '@testing/cancelacion-pruebas';
import { POLIZA_LISTADA_DTO, RESUMEN_ACEPTADA_DTO } from '@testing/renovacion-pruebas';

import { mapearPolizaListada } from '@core/api/originacion/renovacion.modelos';

import { estadoDePoliza, finDeVigencia, tonoDePoliza } from './estado-poliza';

// HU-W1.6-02: el estado de una póliza con su pago.

describe('estadoDePoliza', () => {
  const ahora = new Date('2026-09-16T12:00:00Z').getTime();

  it('la cancelación por no pago pesa más que todo lo demás', () => {
    const p = mapearPolizaListada({ ...POLIZA_CANCELADA_DTO, can_renew: true });

    expect(estadoDePoliza(p, ahora)).toBe('canceladaNoPago');
    expect(tonoDePoliza('canceladaNoPago')).toBe('error');
  });

  it('una cuota en gracia pesa más que la ventana de renovación, porque se cancela antes', () => {
    const p = mapearPolizaListada({ ...POLIZA_EN_GRACIA_DTO, can_renew: true });

    expect(estadoDePoliza(p, ahora)).toBe('pagoPendiente');
    expect(tonoDePoliza('pagoPendiente')).toBe('advertencia');
  });

  it('una renovación en curso sigue mandando sobre el pago pendiente', () => {
    const p = mapearPolizaListada({ ...POLIZA_EN_GRACIA_DTO, renewal: RESUMEN_ACEPTADA_DTO });

    expect(estadoDePoliza(p, ahora)).toBe('enRenovacion');
  });

  it('sin pago pendiente queda como antes: por vencer, vigente o finalizada', () => {
    expect(estadoDePoliza(mapearPolizaListada(POLIZA_LISTADA_DTO), ahora)).toBe('porVencer');
    expect(estadoDePoliza(mapearPolizaListada(POLIZA_AL_DIA_DTO), ahora)).toBe('vigente');
    expect(
      estadoDePoliza(mapearPolizaListada(POLIZA_AL_DIA_DTO), new Date('2028-01-01').getTime()),
    ).toBe('finalizada');
  });

  it('la vigencia de una póliza cancelada termina el día de la cancelación', () => {
    expect(finDeVigencia(mapearPolizaListada(POLIZA_CANCELADA_DTO))).toBe('2026-09-12T05:00:00Z');
    expect(finDeVigencia(mapearPolizaListada(POLIZA_AL_DIA_DTO))).toBe(
      POLIZA_AL_DIA_DTO.coverage_end,
    );
  });
});
