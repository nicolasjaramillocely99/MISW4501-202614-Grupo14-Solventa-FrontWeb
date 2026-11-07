import { ID_CASO } from './evaluacion';

/**
 * Respuestas de `claims` para la revisión del asesor (HU-W2.1-03), con la forma de `docs/contratos/HU-W2.1-03-api.md`.
 * La radicación es la colisión de S8: fotos, documento e informe de tránsito adjuntos, y la fotografía de la placa,
 * opcional, sin adjuntar (los nombres son de prueba).
 */
const POLIZA = {
  policy_id: 'AU-2025-118204',
  line: 'auto',
  product: 'Autos',
  insured_object: 'KJT-482',
};
const COBERTURA = {
  incident: 'collision',
  insured_value_minor: 8_500_000_000,
  currency: 'COP',
  deductible_basis_points: 1000,
};

const RESUMEN = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01877',
  status: 'active',
  channel: 'web',
  policy: POLIZA,
  incident_type: 'collision',
  occurred_at: '2026-09-14T23:40:00Z',
  filed_at: '2026-09-14T23:55:00Z',
};

export const RADICACIONES = [
  {
    ...RESUMEN,
    estimated_amount_minor: 320_000_000,
    triage: { state: 'not_applicable', level: null, severity: null, amount_band: null },
  },
];

const archivo = (id: string, codigo: string, nombre: string, tipo: string) => ({
  support_id: id,
  requirement_code: codigo,
  file_name: nombre,
  content_type: tipo,
  download_url: `https://firmada/${id}`,
});

export const RADICACION = {
  claim: {
    ...RESUMEN,
    place: 'Calle 80 con carrera 30, Bogotá',
    description:
      'Golpe trasero al detenerse en un semáforo; daños en bómper y luz izquierda; sin lesionados.',
    estimated_amount_minor: 320_000_000,
    supports: { required_total: 3, required_attached: 3, files: 3, items: [] },
    evidence: [],
  },
  support_files: [
    archivo('sup-1', 'vehicle_photos', 'frente.jpg', 'image/jpeg'),
    archivo('sup-2', 'driver_document', 'licencia.pdf', 'application/pdf'),
    archivo('sup-3', 'traffic_report', 'croquis.jpg', 'image/jpeg'),
  ],
  triage: {
    view: 'operations',
    claim_id: ID_CASO,
    state: 'not_applicable',
    current: null,
    history: [],
  },
  policy: { ...POLIZA, status: 'active', coverages: [COBERTURA] },
  coverage: COBERTURA,
  holder: {
    full_name: 'Carolina Pérez Ruiz',
    document_type: 'CC',
    document_id: '1020345678',
    email: 'carolina@correo.example',
    phone: '+57 301 234 5678',
    payout_account: {
      bank_code: '1007',
      bank_name: 'Banco Aliado',
      account_type: 'savings',
      masked_number: '•••• 4512',
    },
  },
  policy_unavailable: false,
  decision: null,
  checklist: [
    { requirement_code: 'vehicle_photos', label: 'Fotos del vehículo', required: true, files: 1 },
    {
      requirement_code: 'driver_document',
      label: 'Documento del conductor',
      required: true,
      files: 1,
    },
    {
      requirement_code: 'traffic_report',
      label: 'Informe de tránsito o croquis',
      required: true,
      files: 1,
    },
    { requirement_code: 'plate_photo', label: 'Fotografía de la placa', required: false, files: 0 },
  ],
  prior_claims: [
    {
      ...RESUMEN,
      claim_id: '11111111-1111-4111-8111-111111111111',
      filing_number: 'SIN-2026-01500',
      status: 'rejected',
      incident_type: 'glass',
      filed_at: '2026-08-12T15:00:00Z',
    },
  ],
  reviews: [],
};

const REVISION = {
  seq: 1,
  reviewed_by: 'laura.gomez@solventa.co',
  reviewer_name: 'Laura Gómez',
  reviewed_at: '2026-09-15T14:12:00Z',
  facts_to_correct: [],
};

export const DEVUELTA = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01877',
  status: 'returned',
  review: {
    ...REVISION,
    outcome: 'returned',
    reason_code: 'illegible_or_incomplete_supports',
    message: 'El informe de tránsito no se puede leer y falta la foto de la placa.',
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
        note: 'borroso, no se lee el número de croquis',
      },
      {
        requirement_code: 'plate_photo',
        label: 'Fotografía de la placa',
        verdict: 'missing',
        note: null,
      },
    ],
  },
};

export const APROBADA = {
  claim_id: ID_CASO,
  filing_number: 'SIN-2026-01877',
  status: 'in_evaluation',
  review: {
    ...REVISION,
    outcome: 'approved',
    reason_code: null,
    message: null,
    supports: DEVUELTA.review.supports
      .slice(0, 3)
      .map((s) => ({ ...s, verdict: 'valid', note: null })),
  },
};
