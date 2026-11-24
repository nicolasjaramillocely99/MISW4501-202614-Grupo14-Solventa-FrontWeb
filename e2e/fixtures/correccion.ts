/**
 * Datos de la edición de la radicación devuelta (HU-W2.1-04, A9) con la forma del contrato del backend
 * (`docs/contratos/HU-W2.1-04-api.md`): la colisión de A9, devuelta porque el informe de tránsito no se lee y falta la
 * foto de la placa; el asesor pidió además corregir el lugar.
 */

export const ID_DEVUELTO = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e93';

const archivo = (n: number, nombre: string, tipo = 'image/jpeg') => ({
  support_id: `sup-${n.toString(16).padStart(32, '0')}`,
  file_name: nombre,
  content_type: tipo,
  byte_size: 250_000,
});

export const FOTOS = [1, 2, 3, 4, 5, 6].map((n) => archivo(n, `foto-${n}.jpg`));
export const INFORME_ILEGIBLE = archivo(8, 'croquis.pdf', 'application/pdf');

/** `GET /v1/claims/{id}` del asegurado. */
export const CASO_DEVUELTO = {
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
      { requirement_code: 'vehicle_photos', label: 'Fotos del vehículo', files: FOTOS },
      {
        requirement_code: 'driver_document',
        label: 'Documento del conductor',
        files: [archivo(7, 'licencia.pdf', 'application/pdf')],
      },
      {
        requirement_code: 'traffic_report',
        label: 'Informe de tránsito o croquis',
        files: [INFORME_ILEGIBLE],
      },
    ],
  },
};

const DEVOLUCION = {
  seq: 1,
  outcome: 'returned',
  reviewed_by: 'juan.rios@solventa.example',
  reviewer_name: 'Juan Ríos',
  reviewed_at: '2026-09-15T14:12:00Z',
  reason_code: 'illegible_or_incomplete_supports',
  message:
    'El informe de tránsito adjunto no es legible y falta la fotografía de la placa del vehículo.',
  supports: [
    {
      requirement_code: 'vehicle_photos',
      label: 'Fotos del vehículo',
      verdict: 'valid',
      note: null,
    },
    {
      requirement_code: 'driver_document',
      label: 'Documento del conductor',
      verdict: 'valid',
      note: null,
    },
    {
      requirement_code: 'traffic_report',
      label: 'Informe de tránsito o croquis',
      verdict: 'illegible',
      note: 'No se lee el número del croquis.',
    },
    {
      requirement_code: 'plate_photo',
      label: 'Fotografía de la placa',
      verdict: 'missing',
      note: null,
    },
  ],
  facts_to_correct: ['place'],
};

/** `GET /v1/claims/{id}/history` del caso devuelto. */
export const HISTORIAL_DEVUELTO = {
  claim_id: ID_DEVUELTO,
  filing_number: 'SIN-2026-01877',
  status: 'returned',
  last_changed_at: '2026-09-15T14:12:00Z',
  changes: [
    { id: 1, status: 'active', previous_status: null, changed_at: '2026-09-14T23:55:00Z' },
    { id: 2, status: 'returned', previous_status: 'active', changed_at: '2026-09-15T14:12:00Z' },
  ],
  reviews: [DEVOLUCION],
  last_return: DEVOLUCION,
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
  stale: false,
  as_of: '2026-09-16T15:00:00Z',
};

/** La prioridad del asegurado de un caso que aún no está en evaluación. */
export const TRIAGE_SIN_NIVEL = {
  view: 'insured',
  claim_id: ID_DEVUELTO,
  state: 'not_applicable',
  level: null,
  estimated_resolution_business_days: null,
  assessed_at: null,
};

/** Respuesta del reenvío (200), con lo que cambió según la petición. */
export function reenviado(cuerpo: {
  supports?: { requirement_code: string; support_ids: string[] }[];
}) {
  return {
    claim_id: ID_DEVUELTO,
    filing_number: 'SIN-2026-01877',
    status: 'active',
    resubmission: {
      seq: 1,
      review_seq: 1,
      resubmitted_by: 'sub-asegurado',
      resubmitted_at: new Date().toISOString(),
      changed_facts: [],
      changed_supports: (cuerpo.supports ?? []).map((g) => ({
        requirement_code: g.requirement_code,
        label: g.requirement_code,
        added: g.support_ids,
        withdrawn: [],
      })),
    },
  };
}
