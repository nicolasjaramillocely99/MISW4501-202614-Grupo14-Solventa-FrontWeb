import { mapearEstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';
import { ESTADO_ACTIVO_DTO } from '@testing/revocacion-pruebas';

import { EstadoConsultadoService } from './estado-consultado.service';

describe('EstadoConsultadoService', () => {
  const estado = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);

  it('devuelve el estado guardado solo para su consentimiento', () => {
    const servicio = new EstadoConsultadoService();
    servicio.guardar(estado);

    expect(servicio.de(estado.consentimientoId)).toBe(estado);
    expect(servicio.de('cns-otro')).toBeNull();
  });

  it('no tiene nada antes de guardar y el último guardado reemplaza al anterior', () => {
    const servicio = new EstadoConsultadoService();
    expect(servicio.de(estado.consentimientoId)).toBeNull();

    servicio.guardar(estado);
    servicio.guardar({ ...estado, consentimientoId: 'cns-otro' });

    expect(servicio.de(estado.consentimientoId)).toBeNull();
    expect(servicio.de('cns-otro')?.consentimientoId).toBe('cns-otro');
  });
});
