import { HistorialSiniestroDto, ResultadoReenvioDto } from '@core/api/siniestros/reenvio.modelos';
import { DetalleSiniestroDto } from '@core/api/siniestros/siniestro.modelos';

import { DEVOLUCION_DTO } from './revision-radicacion-pruebas';

/**
 * Datos de prueba de la edición de la radicación devuelta (HU-W2.1-04, A9) con la forma del contrato
 * (`docs/contratos/HU-W2.1-04-api.md` del backend): la colisión de A9, devuelta porque el informe de tránsito no se lee
 * y falta la foto de la placa.
 */

export const ID_DEVUELTO = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e93';

const archivo = (n: number, nombre: string, tipo = 'image/jpeg') => ({
  support_id: `sup-${n.toString(16).padStart(32, '0')}`,
  file_name: nombre,
  content_type: tipo,
  byte_size: 250_000,
});

/** `GET /v1/claims/{id}` del caso devuelto: seis fotos, el documento del conductor y el informe ilegible. */
export const CASO_DEVUELTO_DTO: DetalleSiniestroDto = {
  claim_id: ID_DEVUELTO,
  filing_number: 'SIN-2026-01877',
  status: 'returned',
  channel: 'web',
  policy: {
    policy_id: 'AU-2025-118204',
    line: 'auto',
    product: 'Autos',
    insured_object: 'KJT-482',
  },
  incident_type: 'collision',
  occurred_at: '2026-09-14T23:40:00Z',
  place: 'Calle 80 con carrera 30, Bogotá',
  description: 'Al detenerme en el semáforo, un vehículo particular golpeó la parte trasera.',
  filed_at: '2026-09-14T23:55:00Z',
  estimated_amount_minor: 480_000_000,
  supports: {
    required_total: 3,
    required_attached: 3,
    files: 8,
    items: [
      {
        requirement_code: 'vehicle_photos',
        label: 'Fotos del vehículo',
        files: [1, 2, 3, 4, 5, 6].map((n) => archivo(n, `foto-${n}.jpg`)),
      },
      {
        requirement_code: 'driver_document',
        label: 'Documento del conductor',
        files: [archivo(7, 'licencia.pdf', 'application/pdf')],
      },
      {
        requirement_code: 'traffic_report',
        label: 'Informe de tránsito o croquis',
        files: [archivo(8, 'croquis.pdf', 'application/pdf')],
      },
    ],
  },
};

/** `GET /v1/claims/{id}/history` del caso devuelto, con las reglas de cada soporte de la colisión. */
export const HISTORIAL_DEVUELTO_DTO: HistorialSiniestroDto = {
  claim_id: ID_DEVUELTO,
  filing_number: 'SIN-2026-01877',
  status: 'returned',
  last_changed_at: '2026-09-15T14:12:00Z',
  changes: [
    { id: 1, status: 'active', previous_status: null, changed_at: '2026-09-14T23:55:00Z' },
    { id: 2, status: 'returned', previous_status: 'active', changed_at: '2026-09-15T14:12:00Z' },
  ],
  reviews: [{ ...DEVOLUCION_DTO, facts_to_correct: ['place'] }],
  last_return: { ...DEVOLUCION_DTO, facts_to_correct: ['place'] },
  resubmissions: [],
  requirements: [
    {
      code: 'vehicle_photos',
      label: 'Fotos del vehículo',
      required: true,
      min_files: 4,
      max_files: 10,
      formats: ['jpeg', 'png'],
    },
    {
      code: 'driver_document',
      label: 'Documento del conductor',
      required: true,
      min_files: 1,
      max_files: 2,
      formats: ['pdf', 'jpeg', 'png'],
    },
    {
      code: 'traffic_report',
      label: 'Informe de tránsito o croquis',
      required: true,
      min_files: 1,
      max_files: 3,
      formats: ['pdf', 'jpeg', 'png'],
    },
    {
      code: 'plate_photo',
      label: 'Fotografía de la placa',
      required: false,
      min_files: 0,
      max_files: 2,
      formats: ['jpeg', 'png'],
    },
  ],
};

/** Respuesta del reenvío (200): el caso vuelve a revisión con el mismo número. */
export const RESULTADO_REENVIO_DTO: ResultadoReenvioDto = {
  claim_id: ID_DEVUELTO,
  filing_number: 'SIN-2026-01877',
  status: 'active',
  resubmission: {
    seq: 1,
    review_seq: 1,
    resubmitted_by: 'sub-carolina',
    resubmitted_at: '2026-09-16T15:00:00Z',
    changed_facts: [],
    changed_supports: [
      {
        requirement_code: 'traffic_report',
        label: 'Informe de tránsito o croquis',
        added: ['sup-3f2a9c0d6b8e4f1a9c2d7e5b0a4c6d8e'],
        withdrawn: [archivo(8, 'croquis.pdf').support_id],
      },
    ],
  },
};
