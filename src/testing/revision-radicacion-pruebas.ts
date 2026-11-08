import { PaginaColaDto } from '@core/api/siniestros/evaluacion.modelos';
import {
  RadicacionEnRevisionDto,
  ResultadoRevisionDto,
  RevisionDto,
} from '@core/api/siniestros/revision.modelos';

import { EVALUACION_DTO, ID_EVALUADO } from './evaluacion-pruebas';

/**
 * Radicación de colisión pendiente de revisión con la forma de `GET /v1/claims/{id}/review` (HU-W2.1-03, S8), tomada
 * del ejemplo de `docs/contratos/HU-W2.1-03-api.md` (los nombres son de prueba): fotos, documento e informe de
 * tránsito adjuntos y la fotografía de la placa, opcional, sin adjuntar.
 */
export const RADICACION_EN_REVISION_DTO: RadicacionEnRevisionDto = {
  ...EVALUACION_DTO,
  claim: {
    ...EVALUACION_DTO.claim,
    status: 'active',
    filing_number: 'SIN-2026-01877',
    policy: {
      policy_id: 'AU-2025-118204',
      line: 'auto',
      product: 'Autos',
      insured_object: 'KJT-482',
    },
    incident_type: 'collision',
    place: 'Calle 80 con carrera 30, Bogotá',
    description:
      'Golpe trasero al detenerse en un semáforo; daños en bómper y luz izquierda; sin lesionados.',
    estimated_amount_minor: 320_000_000,
    evidence: [],
  },
  support_files: [
    {
      support_id: 'sup-1',
      requirement_code: 'vehicle_photos',
      file_name: 'frente.jpg',
      content_type: 'image/jpeg',
      download_url: 'https://firmada/sup-1',
    },
    {
      support_id: 'sup-2',
      requirement_code: 'driver_document',
      file_name: 'licencia.pdf',
      content_type: 'application/pdf',
      download_url: 'https://firmada/sup-2',
    },
    {
      support_id: 'sup-3',
      requirement_code: 'traffic_report',
      file_name: 'croquis.jpg',
      content_type: 'image/jpeg',
      download_url: null,
    },
  ],
  triage: {
    view: 'operations',
    claim_id: ID_EVALUADO,
    state: 'not_applicable',
    current: null,
    history: [],
  },
  policy: {
    policy_id: 'AU-2025-118204',
    line: 'auto',
    product: 'Autos',
    insured_object: 'KJT-482',
    status: 'active',
    coverages: [
      {
        incident: 'collision',
        insured_value_minor: 8_500_000_000,
        currency: 'COP',
        deductible_basis_points: 1000,
      },
    ],
  },
  coverage: {
    incident: 'collision',
    insured_value_minor: 8_500_000_000,
    currency: 'COP',
    deductible_basis_points: 1000,
  },
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
      claim_id: '11111111-1111-4111-8111-111111111111',
      filing_number: 'SIN-2026-01500',
      status: 'rejected',
      channel: 'web',
      policy: {
        policy_id: 'AU-2025-118204',
        line: 'auto',
        product: 'Autos',
        insured_object: 'KJT-482',
      },
      incident_type: 'glass',
      occurred_at: '2026-08-10T15:00:00Z',
      filed_at: '2026-08-12T15:00:00Z',
    },
  ],
  reviews: [],
};

export const DEVOLUCION_DTO: RevisionDto = {
  seq: 1,
  outcome: 'returned',
  reviewed_by: 'juan.rios@solventa.example',
  reviewer_name: 'Juan Ríos',
  reviewed_at: '2026-09-15T14:12:00Z',
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
      note: 'borroso',
    },
    {
      requirement_code: 'plate_photo',
      label: 'Fotografía de la placa',
      verdict: 'missing',
      note: null,
    },
  ],
  facts_to_correct: [],
};

export const APROBACION_REVISION_DTO: RevisionDto = {
  ...DEVOLUCION_DTO,
  outcome: 'approved',
  reason_code: null,
  message: null,
  supports: DEVOLUCION_DTO.supports
    .slice(0, 3)
    .map((s) => ({ ...s, verdict: 'valid', note: null })),
};

export const RESULTADO_DEVOLUCION_DTO: ResultadoRevisionDto = {
  claim_id: ID_EVALUADO,
  filing_number: 'SIN-2026-01877',
  status: 'returned',
  review: DEVOLUCION_DTO,
};

export const RESULTADO_APROBACION_DTO: ResultadoRevisionDto = {
  ...RESULTADO_DEVOLUCION_DTO,
  status: 'in_evaluation',
  review: APROBACION_REVISION_DTO,
};

/** La misma radicación, ya devuelta: se ve en solo lectura con el veredicto registrado. */
export const RADICACION_DEVUELTA_DTO: RadicacionEnRevisionDto = {
  ...RADICACION_EN_REVISION_DTO,
  claim: { ...RADICACION_EN_REVISION_DTO.claim, status: 'returned' },
  reviews: [DEVOLUCION_DTO],
};

export const PAGINA_REVISIONES_DTO: PaginaColaDto = {
  items: [
    {
      claim_id: ID_EVALUADO,
      filing_number: 'SIN-2026-01877',
      status: 'active',
      channel: 'web',
      policy: {
        policy_id: 'AU-2025-118204',
        line: 'auto',
        product: 'Autos',
        insured_object: 'KJT-482',
      },
      incident_type: 'collision',
      occurred_at: '2026-09-14T23:40:00Z',
      filed_at: '2026-09-14T23:55:00Z',
      estimated_amount_minor: 320_000_000,
      triage: { state: 'not_applicable', level: null, severity: null, amount_band: null },
    },
  ],
  next_page_token: 'tok-2',
};
