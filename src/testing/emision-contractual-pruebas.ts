import { EmisionContractualDto } from '@core/api/originacion/emision-contractual.modelos';

/** Forma de la respuesta de `GET /v1/policies/{id}/issuance-status` (`docs/contratos/HU-W1.3-03-api.md`). */
export const EMISION_COMPLETADA_DTO: EmisionContractualDto = {
  policy_id: 'pol-3f1c',
  status: 'completed',
  activated_at: '2026-10-16T15:00:00Z',
  available_at: '2026-10-16T15:00:01Z',
  within_slo: true,
  document: { document_id: 'b1e2', version: 1, size_bytes: 2310, generated_at: '2026-10-16T15:00:01Z' },
  notification: { channel: 'email', status: 'sent', attempts: 0, sent_at: '2026-10-16T15:00:01Z' },
};

export const EMISION_PENDIENTE_DTO: EmisionContractualDto = {
  ...EMISION_COMPLETADA_DTO,
  status: 'pending',
  available_at: null,
  within_slo: null,
  document: null,
  notification: { channel: 'email', status: 'pending', attempts: 0, sent_at: null },
};
