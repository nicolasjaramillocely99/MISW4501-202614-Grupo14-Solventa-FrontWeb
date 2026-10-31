import { OpcionesRadicacionDto, SoporteDeclaradoDto, SoporteSubidoDto } from '@core/api/siniestros/radicacion.modelos';
import { DetalleSiniestroDto, PaginaSiniestrosDto, ResumenSiniestroDto } from '@core/api/siniestros/siniestro.modelos';

/**
 * Datos de prueba de la radicación web del siniestro con la forma del contrato de HU-W2.1-01
 * (`docs/contratos/HU-W2.1-01-api.md` del backend, catálogo `claim-catalog-v1`).
 */

type RequisitoDto = OpcionesRadicacionDto['policies'][number]['incident_types'][number]['requirements'][number];

const IMAGEN: RequisitoDto['formats'] = ['jpeg', 'png'];
const DOCUMENTO: RequisitoDto['formats'] = ['pdf', 'jpeg', 'png'];

function requisito(
  code: string,
  label: string,
  min: number,
  max: number,
  formats: RequisitoDto['formats'],
): RequisitoDto {
  return { code, label, required: min > 0, min_files: min, max_files: max, formats: [...formats] };
}

const fotosVehiculo = (min = 4) => requisito('vehicle_photos', 'Fotos del vehículo', min, 10, IMAGEN);
const documentoConductor = (min = 1) => requisito('driver_document', 'Documento del conductor', min, 2, DOCUMENTO);
const informeTransito = () => requisito('traffic_report', 'Informe de tránsito o croquis', 1, 3, DOCUMENTO);

/** Una póliza de Autos (cinco tipos) y una de Hogar, como `GET /v1/claims/filing-options`. */
export const OPCIONES_RADICACION_DTO: OpcionesRadicacionDto = {
  catalog_version: 'claim-catalog-v1',
  policies: [
    {
      policy_id: 'AU-2025-118204',
      line: 'auto',
      product: 'Autos',
      insured_object: 'KJT-482',
      valid_from: '2025-11-01T05:00:00Z',
      valid_to: '2026-11-01T05:00:00Z',
      incident_types: [
        {
          code: 'collision',
          label: 'Colisión con daños al vehículo',
          requirements: [fotosVehiculo(), documentoConductor(), informeTransito()],
        },
        {
          code: 'theft',
          label: 'Hurto',
          requirements: [
            requisito('police_report', 'Denuncia ante autoridad', 1, 3, DOCUMENTO),
            documentoConductor(),
            fotosVehiculo(0),
          ],
        },
        {
          code: 'third_party_damage',
          label: 'Daño a terceros',
          requirements: [fotosVehiculo(), documentoConductor(), informeTransito()],
        },
        {
          code: 'glass',
          label: 'Cristales',
          requirements: [
            requisito('glass_photos', 'Fotos de los cristales', 2, 6, IMAGEN),
            documentoConductor(0),
          ],
        },
        {
          code: 'other',
          label: 'Otro',
          requirements: [
            requisito('supporting_document', 'Documento de soporte', 1, 5, DOCUMENTO),
          ],
        },
      ],
    },
    {
      policy_id: 'HG-2025-880231',
      line: 'home',
      product: 'Hogar',
      insured_object: 'Calle 93 # 11-20, Bogotá',
      valid_from: '2025-06-01T05:00:00Z',
      valid_to: '2026-12-01T05:00:00Z',
      incident_types: [
        {
          code: 'water_damage',
          label: 'Daño por agua',
          requirements: [
            requisito('damage_photos', 'Fotos del daño', 2, 10, IMAGEN),
            requisito('repair_quote', 'Factura o cotización de la reparación', 1, 3, DOCUMENTO),
          ],
        },
      ],
    },
  ],
};

/** Respuesta de `POST /v1/claims/supports` (201) para el croquis: la URL firmada de S3. */
export const SOPORTE_DECLARADO_DTO: SoporteDeclaradoDto = {
  support_id: 'sup-3f2a9c0d6b8e4f1a9c2d7e5b0a4c6d8e',
  file_name: 'croquis.pdf',
  content_type: 'application/pdf',
  byte_size: 482113,
  sha256: '9b1c4f0e7a2d3c5b6e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d',
  upload_url: 'https://evidencia.s3.us-east-2.amazonaws.com/supports/sub-1/sup-3f2a9c0d?X-Amz-Signature=abc',
  upload_headers: { 'Content-Type': 'application/pdf', 'Content-Length': '482113' },
  expires_at: '2026-09-15T00:08:02Z',
};

/** Respuesta de `POST /v1/claims/supports/{id}/confirmation` (200) para el croquis. */
export const SOPORTE_SUBIDO_DTO: SoporteSubidoDto = {
  support_id: 'sup-3f2a9c0d6b8e4f1a9c2d7e5b0a4c6d8e',
  file_name: 'croquis.pdf',
  content_type: 'application/pdf',
  byte_size: 482113,
  sha256: '9b1c4f0e7a2d3c5b6e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d',
  confirmed_at: '2026-09-14T23:58:02Z',
};

/** Caso web recién radicado (201 de la radicación y `GET /v1/claims/{id}`). */
export const SINIESTRO_RADICADO_DTO: DetalleSiniestroDto = {
  claim_id: '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90',
  filing_number: 'SIN-2026-01712',
  status: 'active',
  channel: 'web',
  policy: { policy_id: 'AU-2025-118204', line: 'auto', product: 'Autos', insured_object: 'KJT-482' },
  incident_type: 'collision',
  occurred_at: '2026-09-14T23:40:00Z',
  place: 'Calle 80 con carrera 30, Bogotá',
  description: 'Al detenerme en el semáforo, un vehículo particular golpeó la parte trasera.',
  filed_at: '2026-09-15T00:05:00Z',
  supports: {
    required_total: 3,
    required_attached: 3,
    files: 8,
    items: [
      {
        requirement_code: 'traffic_report',
        label: 'Informe de tránsito o croquis',
        files: [
          {
            support_id: SOPORTE_SUBIDO_DTO.support_id,
            file_name: 'croquis.pdf',
            content_type: 'application/pdf',
            byte_size: 482113,
          },
        ],
      },
    ],
  },
};

/** Caso radicado desde la app móvil (HU-M2.2-01): sin foto de la póliza ni soportes. */
export const SINIESTRO_MOVIL_DTO: ResumenSiniestroDto = {
  claim_id: '1c9a3e57-2b4d-4f6a-8e0b-7d5c3a1f9e24',
  filing_number: 'SIN-2026-01655',
  status: 'active',
  channel: 'mobile',
  policy: { policy_id: 'AU-2025-118204', line: null, product: null, insured_object: null },
  incident_type: 'theft',
  occurred_at: '2026-09-03T15:20:00Z',
  filed_at: '2026-09-03T16:02:00Z',
};

/** Una página de «Mis siniestros» con el caso web y el móvil. */
export const PAGINA_SINIESTROS_DTO: PaginaSiniestrosDto = {
  items: [
    {
      claim_id: SINIESTRO_RADICADO_DTO.claim_id,
      filing_number: SINIESTRO_RADICADO_DTO.filing_number,
      status: 'active',
      channel: 'web',
      policy: SINIESTRO_RADICADO_DTO.policy,
      incident_type: 'collision',
      occurred_at: SINIESTRO_RADICADO_DTO.occurred_at,
      filed_at: SINIESTRO_RADICADO_DTO.filed_at,
    },
    SINIESTRO_MOVIL_DTO,
  ],
  next_page_token: null,
};
