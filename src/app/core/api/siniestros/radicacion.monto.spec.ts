import { HttpErrorResponse } from '@angular/common/http';
import { SINIESTRO_RADICADO_DTO } from '@testing/siniestros-pruebas';

import { ErrorRadicacion, SolicitudRadicacion, aSolicitudRadicacionDto, traducirErrorRadicacion } from './radicacion.modelos';
import { mapearDetalleSiniestro } from './siniestro.modelos';

const SOLICITUD: SolicitudRadicacion = {
  polizaId: 'AU-2025-118204',
  tipoSiniestro: 'collision',
  ocurridoEn: '2026-09-14T23:40:00.000Z',
  lugar: 'Calle 80 con carrera 30, Bogotá',
  descripcion: 'Al detenerme en el semáforo, un vehículo particular golpeó la parte trasera.',
  soportes: [{ codigoRequisito: 'vehicle_photos', soporteIds: ['sup-a'] }],
};

describe('monto estimado de la radicación (HU-W2.2-01, D12)', () => {
  describe('aSolicitudRadicacionDto', () => {
    it('sin monto el cuerpo es idéntico al de HU-W2.1-01 (regresión)', () => {
      expect(aSolicitudRadicacionDto(SOLICITUD)).toEqual({
        policy_id: 'AU-2025-118204',
        incident_type: 'collision',
        occurred_at: '2026-09-14T23:40:00.000Z',
        place: 'Calle 80 con carrera 30, Bogotá',
        description: 'Al detenerme en el semáforo, un vehículo particular golpeó la parte trasera.',
        supports: [{ requirement_code: 'vehicle_photos', support_ids: ['sup-a'] }],
      });
      expect(Object.keys(aSolicitudRadicacionDto(SOLICITUD))).not.toContain('estimated_amount_minor');
    });

    it('con monto lleva el entero en centavos', () => {
      const dto = aSolicitudRadicacionDto({ ...SOLICITUD, montoEstimadoMinor: 480000000 });

      expect(dto['estimated_amount_minor']).toBe(480000000);
    });
  });

  describe('traducirErrorRadicacion', () => {
    it('el 422 del campo estimated_amount_minor se traduce a montoEstimado', () => {
      const error = traducirErrorRadicacion(
        new HttpErrorResponse({
          status: 422,
          error: {
            error: 'validation_failed',
            fields: [
              { field: 'estimated_amount_minor', code: 'out_of_range' },
              { field: 'place', code: 'invalid_format' },
            ],
          },
        }),
      );

      expect(error).toBeInstanceOf(ErrorRadicacion);
      expect(error.campos).toEqual([
        { campo: 'montoEstimado', codigo: 'out_of_range' },
        { campo: 'lugar', codigo: 'invalid_format' },
      ]);
    });
  });

  describe('mapearDetalleSiniestro', () => {
    it('trae el monto estimado en centavos', () => {
      const detalle = mapearDetalleSiniestro({ ...SINIESTRO_RADICADO_DTO, estimated_amount_minor: 480000000 });

      expect(detalle.montoEstimadoMinor).toBe(480000000);
    });

    it('si el campo no viene el monto es null', () => {
      expect(mapearDetalleSiniestro(SINIESTRO_RADICADO_DTO).montoEstimadoMinor).toBeNull();
    });

    it('si viene en null el monto es null', () => {
      expect(mapearDetalleSiniestro({ ...SINIESTRO_RADICADO_DTO, estimated_amount_minor: null }).montoEstimadoMinor).toBeNull();
    });
  });
});
