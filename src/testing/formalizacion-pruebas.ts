import { ConfirmacionEnviadaDto, FormalizacionDto } from '@core/api/originacion/formalizacion.modelos';

import { COTIZACION_DTO } from './cotizacion-asistida-pruebas';

/** Respuesta de `POST /v1/assisted-quotes/{id}/consent` documentada en `docs/contratos/HU-W1.1-03-api.md`. */
export const CONFIRMACION_ENVIADA_DTO: ConfirmacionEnviadaDto = {
  quote_id: COTIZACION_DTO.quote_id,
  sent_to: 'an***@example.com',
  expires_at: '2026-10-16T15:10:00Z',
};

/** Respuesta de `POST /v1/assisted-quotes/{id}/formalization` documentada en el mismo contrato. */
export const FORMALIZACION_DTO: FormalizacionDto = {
  formalization_id: `frm-${COTIZACION_DTO.quote_id}`,
  quote_id: COTIZACION_DTO.quote_id,
  offer_id: `off-q-${COTIZACION_DTO.quote_id}`,
  acceptance_id: 'e2b1c7d4-5a60-4f1e-8b39-0c2d4e6f8a10',
  customer_id: COTIZACION_DTO.customer_id,
  advisor_id: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  advisor_email: 'laura.gomez@solventa.example',
  consent_method: 'recorded_call',
  accepted_at: '2026-10-16T15:00:00Z',
  consent_reference: 'GRAB-2026-88910',
  formalized_at: '2026-10-16T15:03:11Z',
  status: 'registered',
};
