import { HttpErrorResponse } from '@angular/common/http';
import {
  DEVOLUCION_DTO,
  RADICACION_EN_REVISION_DTO,
  RESULTADO_DEVOLUCION_DTO,
} from '@testing/revision-radicacion-pruebas';

import {
  ErrorRevision,
  aDevolucionDto,
  mapearRadicacionEnRevision,
  mapearResultadoRevision,
  traducirErrorRevision,
} from './revision.modelos';

describe('revision.modelos (HU-W2.1-03)', () => {
  it('mapea la radicación en revisión con su checklist, los siniestros previos y las revisiones', () => {
    const r = mapearRadicacionEnRevision({
      ...RADICACION_EN_REVISION_DTO,
      reviews: [DEVOLUCION_DTO],
    });

    expect(r.siniestro.numeroRadicado).toBe('SIN-2026-01877');
    expect(r.siniestro.estado).toBe('active');
    expect(r.checklist).toEqual([
      {
        codigoRequisito: 'vehicle_photos',
        etiqueta: 'Fotos del vehículo',
        requerido: true,
        archivos: 1,
      },
      {
        codigoRequisito: 'driver_document',
        etiqueta: 'Documento del conductor',
        requerido: true,
        archivos: 1,
      },
      {
        codigoRequisito: 'traffic_report',
        etiqueta: 'Informe de tránsito o croquis',
        requerido: true,
        archivos: 1,
      },
      {
        codigoRequisito: 'plate_photo',
        etiqueta: 'Fotografía de la placa',
        requerido: false,
        archivos: 0,
      },
    ]);
    expect(r.siniestrosPrevios.map((s) => [s.numeroRadicado, s.estado, s.tipoSiniestro])).toEqual([
      ['SIN-2026-01500', 'rejected', 'glass'],
    ]);
    expect(r.revisiones).toHaveLength(1);
    expect(r.revisiones[0]).toEqual({
      secuencia: 1,
      resultado: 'returned',
      revisadaPor: 'juan.rios@solventa.example',
      nombreRevisor: 'Juan Ríos',
      revisadaEn: '2026-09-15T14:12:00Z',
      motivo: 'illegible_or_incomplete_supports',
      mensaje: 'El informe de tránsito no se puede leer y falta la foto de la placa.',
      soportes: [
        {
          codigoRequisito: 'vehicle_photos',
          etiqueta: 'Fotos del vehículo',
          veredicto: 'valid',
          nota: null,
        },
        {
          codigoRequisito: 'driver_document',
          etiqueta: 'Documento del conductor',
          veredicto: 'valid',
          nota: null,
        },
        {
          codigoRequisito: 'traffic_report',
          etiqueta: 'Informe de tránsito o croquis',
          veredicto: 'illegible',
          nota: 'borroso',
        },
        {
          codigoRequisito: 'plate_photo',
          etiqueta: 'Fotografía de la placa',
          veredicto: 'missing',
          nota: null,
        },
      ],
      datosACorregir: [],
    });
    expect(r.cobertura?.deduciblePuntosBasicos).toBe(1000);
  });

  it('mapea el resultado de una revisión', () => {
    const r = mapearResultadoRevision(RESULTADO_DEVOLUCION_DTO);

    expect(r.estado).toBe('returned');
    expect(r.numeroRadicado).toBe('SIN-2026-01877');
    expect(r.revision.resultado).toBe('returned');
  });

  it('arma el cuerpo de la devolución: recorta el mensaje y la nota, y la nota vacía no viaja', () => {
    expect(
      aDevolucionDto({
        motivo: 'illegible_or_incomplete_supports',
        mensaje: '  Falta la foto de la placa.  ',
        soportes: [
          { codigoRequisito: 'traffic_report', veredicto: 'illegible', nota: ' borroso ' },
          { codigoRequisito: 'plate_photo', veredicto: 'missing', nota: '   ' },
          { codigoRequisito: 'driver_document', veredicto: 'illegible' },
        ],
        datosACorregir: ['place'],
      }),
    ).toEqual({
      reason_code: 'illegible_or_incomplete_supports',
      message: 'Falta la foto de la placa.',
      supports: [
        { requirement_code: 'traffic_report', verdict: 'illegible', note: 'borroso' },
        { requirement_code: 'plate_photo', verdict: 'missing' },
        { requirement_code: 'driver_document', verdict: 'illegible' },
      ],
      facts_to_correct: ['place'],
    });
  });

  it.each([
    [{ error: 'supports_incomplete' }, 422, 'supports_incomplete'],
    [{ error: 'nothing_requested' }, 422, 'nothing_requested'],
    [{ error: 'verdict_not_applicable' }, 422, 'verdict_not_applicable'],
    [{ error: 'claim_not_reviewable' }, 409, 'claim_not_reviewable'],
    [{ error: 'algo_nuevo' }, 409, 'claim_not_reviewable'],
    [null, 400, 'invalid_request'],
    [null, 401, 'unauthorized'],
    [null, 403, 'forbidden'],
    [null, 404, 'claim_not_found'],
    [null, 503, 'claims_unavailable'],
    [null, 0, 'claims_unavailable'],
  ])('traduce %j con %i a %s', (cuerpo, status, codigo) => {
    expect(traducirErrorRevision(new HttpErrorResponse({ error: cuerpo, status })).codigo).toBe(
      codigo,
    );
  });

  it('un error que no es HTTP es «claims_unavailable»', () => {
    const error = traducirErrorRevision(new Error('x'));

    expect(error).toBeInstanceOf(ErrorRevision);
    expect(error.codigo).toBe('claims_unavailable');
    expect(error.message).toContain('claims_unavailable');
  });
});
