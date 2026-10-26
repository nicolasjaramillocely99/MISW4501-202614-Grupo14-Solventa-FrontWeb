/**
 * Datos de las E2E de la radicación web del siniestro (HU-W2.1-01), con la forma del contrato del backend
 * (`docs/contratos/HU-W2.1-01-api.md`, catálogo `claim-catalog-v1`). Las vigencias se calculan desde hoy para que las
 * pruebas no venzan con el calendario.
 */

const DIA = 24 * 60 * 60 * 1000;
/** Bogotá no tiene horario de verano: siempre UTC−5. */
const DESFASE_BOGOTA = 5 * 60 * 60 * 1000;

/** Instante UTC (RFC 3339) a `n` días de hoy, a la hora en punto. */
export function enDias(dias: number): string {
  const instante = new Date(Date.now() + dias * DIA);
  instante.setUTCMinutes(0, 0, 0);
  return instante.toISOString();
}

/** Valor de `<input type="datetime-local">` en Bogotá para un instante UTC (`YYYY-MM-DDTHH:mm`). */
export function localBogota(iso: string): string {
  return new Date(Date.parse(iso) - DESFASE_BOGOTA).toISOString().slice(0, 16);
}

/** El instante UTC que el portal envía para ese valor local (con los segundos y milisegundos en cero). */
export function isoDesdeLocalBogota(local: string): string {
  return new Date(Date.parse(`${local}:00.000Z`) + DESFASE_BOGOTA).toISOString();
}

const IMAGEN = ['jpeg', 'png'];
const DOCUMENTO = ['pdf', 'jpeg', 'png'];

const requisito = (code: string, label: string, min: number, max: number, formats: string[]) => ({
  code,
  label,
  required: min > 0,
  min_files: min,
  max_files: max,
  formats,
});

/** Póliza de Autos vigente desde hace 300 días hasta dentro de 65, con los cinco tipos de Autos. */
export const POLIZA_AUTOS = {
  policy_id: 'AU-2025-118204',
  line: 'auto',
  product: 'Autos',
  insured_object: 'KJT-482',
  valid_from: enDias(-300),
  valid_to: enDias(65),
  incident_types: [
    {
      code: 'collision',
      label: 'Colisión con daños al vehículo',
      requirements: [
        requisito('vehicle_photos', 'Fotos del vehículo', 4, 10, IMAGEN),
        requisito('driver_document', 'Documento del conductor', 1, 2, DOCUMENTO),
        requisito('traffic_report', 'Informe de tránsito o croquis', 1, 3, DOCUMENTO),
      ],
    },
    {
      code: 'theft',
      label: 'Hurto',
      requirements: [
        requisito('police_report', 'Denuncia ante autoridad', 1, 3, DOCUMENTO),
        requisito('driver_document', 'Documento del conductor', 1, 2, DOCUMENTO),
        requisito('vehicle_photos', 'Fotos del vehículo', 0, 10, IMAGEN),
      ],
    },
    {
      code: 'glass',
      label: 'Cristales',
      requirements: [requisito('glass_photos', 'Fotos de los cristales', 2, 6, IMAGEN)],
    },
  ],
};

export const POLIZA_HOGAR = {
  policy_id: 'HG-2025-880231',
  line: 'home',
  product: 'Hogar',
  insured_object: 'Calle 93 # 11-20, Bogotá',
  valid_from: enDias(-200),
  valid_to: enDias(165),
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
};

/** `GET /v1/claims/filing-options`. */
export const OPCIONES_RADICACION = { catalog_version: 'claim-catalog-v1', policies: [POLIZA_AUTOS, POLIZA_HOGAR] };

export const ID_CASO = '8f14e45f-ceea-467a-9f3a-5a2d0b1c7e90';

/** Caso web radicado (201 de `POST /v1/claims/web-filings` y `GET /v1/claims/{id}`). */
export function casoRadicado(ocurridoEn: string) {
  return {
    claim_id: ID_CASO,
    filing_number: 'SIN-2026-01712',
    status: 'active',
    channel: 'web',
    policy: { policy_id: 'AU-2025-118204', line: 'auto', product: 'Autos', insured_object: 'KJT-482' },
    incident_type: 'collision',
    occurred_at: ocurridoEn,
    place: 'Calle 80 con carrera 30, Bogotá',
    description: 'Un vehículo particular golpeó la parte trasera en el semáforo.',
    filed_at: enDias(0),
    supports: {
      required_total: 3,
      required_attached: 3,
      files: 6,
      items: [
        { requirement_code: 'vehicle_photos', label: 'Fotos del vehículo', files: [] },
        { requirement_code: 'driver_document', label: 'Documento del conductor', files: [] },
        { requirement_code: 'traffic_report', label: 'Informe de tránsito o croquis', files: [] },
      ],
    },
  };
}

/** Fila de «Mis siniestros» del caso radicado. */
export function filaDelCaso(ocurridoEn: string) {
  const caso = casoRadicado(ocurridoEn);
  return {
    claim_id: caso.claim_id,
    filing_number: caso.filing_number,
    status: caso.status,
    channel: caso.channel,
    policy: caso.policy,
    incident_type: caso.incident_type,
    occurred_at: caso.occurred_at,
    filed_at: caso.filed_at,
  };
}

/** Caso radicado desde la app móvil: sin foto de la póliza. */
export const CASO_MOVIL = {
  claim_id: '1c9a3e57-2b4d-4f6a-8e0b-7d5c3a1f9e24',
  filing_number: 'SIN-2026-01655',
  status: 'active',
  channel: 'mobile',
  policy: { policy_id: 'AU-2025-118204', line: null, product: null, insured_object: null },
  incident_type: 'theft',
  occurred_at: enDias(-20),
  filed_at: enDias(-20),
};

/** Archivo para `setInputFiles`. */
export interface ArchivoPrueba {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export const fotoJpg = (nombre: string): ArchivoPrueba => ({
  name: nombre,
  mimeType: 'image/jpeg',
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
});

export const documentoPdf = (nombre: string): ArchivoPrueba => ({
  name: nombre,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n'),
});

/** 10 MiB + 1 byte: el portal lo rechaza sin subirlo (CA-5). */
export const fotoDemasiadoGrande = (): ArchivoPrueba => ({
  name: 'foto-enorme.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0xff),
});

/** Un ejecutable renombrado `.pdf`: pasa la prevalidación del navegador y el backend lo rechaza por su contenido (415). */
export const ejecutableRenombrado = (): ArchivoPrueba => ({
  name: 'croquis-falso.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('MZ\x90\x00'),
});
