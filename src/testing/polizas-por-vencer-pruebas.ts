import { PaginaPorVencerDto, PolizaPorVencerDto } from '@core/api/originacion/polizas-por-vencer.modelos';

/**
 * Respuestas de `GET /v1/policies/expiring` con la forma del contrato de HU-W1.5-01 (`docs/contratos/HU-W1.5-01-api.md`):
 * una póliza por vencer dentro de la ventana, una con la renovación en curso y una por vencer fuera de la ventana.
 */

/** Por vencer y dentro de su ventana de renovación: el asesor puede renovarla. */
export const POLIZA_POR_VENCER_DTO: PolizaPorVencerDto = {
  policy_id: 'pol-acc-118204',
  line: 'life',
  product: null,
  holder: { full_name: 'Carolina Pérez Ruiz', document_type: null, document_id: '1020345678' },
  premium: 142300,
  currency: 'COP',
  coverage_end: '2026-10-02T23:59:00Z',
  status: 'expiring',
  can_renew: true,
  renewal_window: { opens_at: '2026-09-02T23:59:00Z', closes_at: '2026-10-02T23:59:00Z' },
  renewal: null,
};

/** El asegurado aceptó la renovación en línea y se cobra la prima: «Renovación en curso». */
export const POLIZA_EN_RENOVACION_DTO: PolizaPorVencerDto = {
  ...POLIZA_POR_VENCER_DTO,
  policy_id: 'pol-acc-771003',
  holder: { full_name: 'Marta Ruiz Ospina', document_type: null, document_id: '41556902' },
  premium: 95000,
  coverage_end: '2026-10-05T23:59:00Z',
  status: 'renewal_in_progress',
  can_renew: false,
  renewal_window: { opens_at: '2026-09-05T23:59:00Z', closes_at: '2026-10-05T23:59:00Z' },
  renewal: {
    renewal_id: 'ren-pol-acc-771003-20261005',
    status: 'accepted',
    reason: null,
    new_policy_id: null,
    charge_id: 'ren-pol-acc-771003-20261005',
    accepted_at: '2026-09-20T15:00:00Z',
    retry_until: '2026-09-23T15:00:00Z',
    closed_at: null,
  },
};

/** Por vencer pero fuera de su ventana: «Renovable desde el 16/10/2026». */
export const POLIZA_FUERA_DE_VENTANA_DTO: PolizaPorVencerDto = {
  ...POLIZA_POR_VENCER_DTO,
  policy_id: 'pol-acc-004512',
  holder: { full_name: 'Jorge Molina Castro', document_type: null, document_id: '79845112' },
  premium: 55400,
  coverage_end: '2026-11-15T23:59:00Z',
  can_renew: false,
  renewal_window: { opens_at: '2026-10-16T23:59:00Z', closes_at: '2026-11-15T23:59:00Z' },
};

/** Una página del listado con las tres pólizas, el rango aplicado y el indicador; `cambios` la ajusta. */
export function paginaPorVencerDto(cambios: Partial<PaginaPorVencerDto> = {}): PaginaPorVencerDto {
  return {
    items: [POLIZA_POR_VENCER_DTO, POLIZA_EN_RENOVACION_DTO, POLIZA_FUERA_DE_VENTANA_DTO],
    expires_from: '2026-09-16',
    expires_to: '2026-11-16',
    window_days: 30,
    due_within_window: 12,
    total: 3,
    page: 1,
    page_size: 20,
    ...cambios,
  };
}

export const PAGINA_POR_VENCER_DTO = paginaPorVencerDto();

/** Sin pólizas en el rango (CA-3). */
export const PAGINA_POR_VENCER_VACIA_DTO = paginaPorVencerDto({
  items: [],
  total: 0,
  expires_from: '2026-12-01',
  expires_to: '2026-12-15',
});
