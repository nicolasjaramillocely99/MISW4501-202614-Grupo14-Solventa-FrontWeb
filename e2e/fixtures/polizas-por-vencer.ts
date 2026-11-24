/**
 * Datos de las E2E de las pólizas próximas a vencer del asesor (HU-W1.5-01), con la forma de `GET /v1/policies/expiring`
 * (contrato `HU-W1.5-01-api.md`, `openapi.yaml` 0.14.0). El rango por defecto que «aplica el backend» es el del frame S6
 * (16/09/2026 → 16/10/2026, ventana de 30 días); el gateway simulado filtra estas pólizas por rango y estado como el
 * servicio: días civiles de Colombia, los dos incluidos.
 */

export interface RespuestaPorVencer {
  estado: number;
  cuerpo: unknown;
}

const DESDE_POR_DEFECTO = '2026-09-16';
const HASTA_POR_DEFECTO = '2026-10-16';

type Poliza = ReturnType<typeof poliza>;

export function poliza(id: string, nombre: string, documento: string, vence: string, cambios: Record<string, unknown> = {}) {
  return {
    policy_id: id,
    line: 'life',
    product: null as string | null,
    holder: { full_name: nombre, document_type: null as string | null, document_id: documento },
    premium: 142300,
    currency: 'COP',
    coverage_end: `${vence}T23:59:00Z`,
    status: 'expiring',
    can_renew: true,
    renewal_window: { opens_at: `${vence}T00:00:00Z`, closes_at: `${vence}T23:59:00Z` },
    renewal: null as Record<string, unknown> | null,
    ...cambios,
  };
}

/** Las filas de la pantalla S6: cuatro en el rango por defecto (una con la renovación en curso) y una que vence más adelante. */
export const POLIZAS: Poliza[] = [
  poliza('pol-acc-000455', 'Pedro Gómez Lara', '1032410221', '2026-09-20', { premium: 38000 }),
  poliza('pol-acc-118204', 'Carolina Pérez Ruiz', '1020345678', '2026-10-02'),
  poliza('pol-acc-771003', 'Marta Ruiz Ospina', '41556902', '2026-10-05', {
    premium: 95000,
    status: 'renewal_in_progress',
    can_renew: false,
    renewal: {
      renewal_id: 'ren-pol-acc-771003-20261005',
      status: 'accepted',
      reason: null,
      new_policy_id: null,
      charge_id: 'ren-pol-acc-771003-20261005',
      accepted_at: '2026-09-15T15:00:00Z',
      retry_until: '2026-09-18T15:00:00Z',
      closed_at: null,
    },
  }),
  poliza('pol-acc-002210', 'Diego Salazar Peña', '80221334', '2026-10-12', { premium: 61000 }),
  poliza('pol-acc-004512', 'Jorge Molina Castro', '79845112', '2026-11-15', {
    premium: 55400,
    can_renew: false,
    renewal_window: { opens_at: '2026-10-16T23:59:00Z', closes_at: '2026-11-15T23:59:00Z' },
  }),
];

/** El día de Colombia en que vence una póliza (`coverage_end` en UTC − 5 h). */
function diaColombia(iso: string): string {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * La respuesta del gateway simulado para los parámetros de la consulta: rango por defecto 16/09 → 16/10 de 2026, solo con
 * «desde» la ventana de 30 días desde ese día, `400 out_of_range` con el rango invertido y el filtro de estado.
 */
export function responder(params: URLSearchParams, polizas: Poliza[] = POLIZAS): RespuestaPorVencer {
  const desde = params.get('expires_from') ?? DESDE_POR_DEFECTO;
  const hasta =
    params.get('expires_to') ??
    (params.has('expires_from') ? new Date(Date.parse(`${desde}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10) : HASTA_POR_DEFECTO);
  if (hasta < desde) {
    return { estado: 400, cuerpo: { error: 'out_of_range', message: 'expires_to must not be before expires_from' } };
  }
  const estado = params.get('status');
  const items = polizas.filter((p) => {
    const dia = diaColombia(p.coverage_end);
    return dia >= desde && dia <= hasta && (!estado || p.status === estado);
  });
  return {
    estado: 200,
    cuerpo: {
      items,
      expires_from: desde,
      expires_to: hasta,
      window_days: 30,
      due_within_window: 12,
      total: items.length,
      page: Number(params.get('page') ?? '1'),
      page_size: Number(params.get('page_size') ?? '20'),
    },
  };
}
