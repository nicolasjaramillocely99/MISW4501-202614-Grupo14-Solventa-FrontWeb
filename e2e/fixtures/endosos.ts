import { Page, Route } from '@playwright/test';

/**
 * Datos y API Gateway simulado de las E2E de los endosos del analista (HU-W1.4-02), con la forma del contrato
 * (`HU-W1.4-02-api.md`, `openapi.yaml` 0.19.0 de `origination`). El gateway guarda el estado de cada solicitud: *Revisar*
 * la pasa a «En revisión», *Aplicar endoso* la aplica (SOL-MOD-2026-0042) o registra el intento no aplicado porque el
 * documento de un beneficiario no está en la Registraduría (SOL-MOD-2026-0043), y *Rechazar* y *Devolver al asegurado*
 * exigen observaciones de 10 a 500 caracteres, como el servicio.
 */

export const POLIZA_CAROLINA = 'pol-acc-4f2a';
export const POLIZA_DIEGO = 'pol-dsp-77';
export const POLIZA_SIN_ENDOSOS = 'pol-sin-endosos';

/** Una respuesta fija del gateway. */
export interface RespuestaEndoso {
  estado: number;
  cuerpo: unknown;
}

export interface GuionEndosos {
  /** Respuestas de cada `POST …/application`, en orden; sin ellas, el gateway decide por la solicitud. */
  aplicar?: RespuestaEndoso[];
}

/** Lo que el portal envió al gateway, en orden. */
export interface TraficoEndosos {
  tomadas: string[];
  aplicadas: string[];
  cierres: { solicitud: string; accion: 'rejection' | 'return'; cuerpo: unknown }[];
  consultas: URLSearchParams[];
}

type Estado = 'filed' | 'in_review' | 'applied' | 'rejected' | 'not_applied';

interface Solicitud {
  id: string;
  poliza: string;
  titular: { full_name: string; document_id: string };
  tipo: 'beneficiaries' | 'insured_amount';
  radicada: string;
  estado: Estado;
  cambioEstado: string;
  devuelta: boolean;
  motivo: string | null;
  decision: { outcome: string; at: string; observations: string | null; endorsement_id: string | null; failed: string[] } | null;
}

const ANALISTA = { name: 'Andrés Ruiz', role: 'operations' };
const MATEO = { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001' };
const LUCIA = { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310' };
const TOMAS = { full_name: 'Tomás Salazar Mejía', relationship: 'child', document_type: 'TI', document_number: '1021447905' };
const LAURA = { full_name: 'Laura Salazar Mejía', relationship: 'child', document_type: 'CC', document_number: '1018552740' };

function solicitudesIniciales(): Solicitud[] {
  const base = { devuelta: false, motivo: null, decision: null };
  return [
    {
      ...base,
      id: 'SOL-MOD-2026-0042',
      poliza: POLIZA_CAROLINA,
      titular: { full_name: 'Carolina Pérez Ruiz', document_id: '1020345678' },
      tipo: 'beneficiaries',
      radicada: '2026-09-16T20:10:00Z',
      estado: 'filed',
      cambioEstado: '2026-09-16T20:10:00Z',
    },
    {
      ...base,
      id: 'SOL-MOD-2026-0043',
      poliza: POLIZA_DIEGO,
      titular: { full_name: 'Diego Salazar Peña', document_id: '80221334' },
      tipo: 'beneficiaries',
      radicada: '2026-09-16T17:20:00Z',
      estado: 'in_review',
      cambioEstado: '2026-09-16T17:25:00Z',
    },
    {
      ...base,
      id: 'SOL-MOD-2026-0044',
      poliza: 'pol-jgo-12',
      titular: { full_name: 'Juan Gómez Ortiz', document_id: '79555120' },
      tipo: 'insured_amount',
      radicada: '2026-09-15T15:00:00Z',
      estado: 'filed',
      cambioEstado: '2026-09-15T15:00:00Z',
    },
    {
      ...base,
      id: 'SOL-MOD-2026-0039',
      poliza: 'pol-mro-31',
      titular: { full_name: 'Marta Ruiz Ospina', document_id: '41556902' },
      tipo: 'beneficiaries',
      radicada: '2026-09-14T14:00:00Z',
      estado: 'applied',
      cambioEstado: '2026-09-14T16:00:00Z',
      decision: { outcome: 'applied', at: '2026-09-14T16:00:00Z', observations: null, endorsement_id: 'END-2026-0098', failed: [] },
    },
  ];
}

function solicitudDto(s: Solicitud) {
  return {
    request_id: s.id,
    policy_id: s.poliza,
    change_type: s.tipo,
    channel: 'web',
    filed_at: s.radicada,
    status: s.estado,
    status_changed_at: s.cambioEstado,
    returned: s.devuelta,
    decision_reason: s.motivo,
    requester_name: s.titular.full_name,
  };
}

function cambios(s: Solicitud) {
  if (s.tipo === 'insured_amount') {
    return [{ field: 'insured_amount', previous: 250000000, requested: 300000000 }];
  }
  return s.poliza === POLIZA_DIEGO
    ? [
        { field: 'beneficiaries', previous: { ...LAURA, share_percent: 100 }, requested: { ...LAURA, share_percent: 60 } },
        { field: 'beneficiaries', previous: null, requested: { ...TOMAS, share_percent: 40 } },
      ]
    : [
        { field: 'beneficiaries', previous: { ...MATEO, share_percent: 100 }, requested: { ...MATEO, share_percent: 60 } },
        { field: 'beneficiaries', previous: null, requested: { ...LUCIA, share_percent: 40 } },
      ];
}

function validaciones(s: Solicitud) {
  const documentoFalla = s.poliza === POLIZA_DIEGO;
  return [
    { code: 'shares_total_100', outcome: 'passed', params: { shares: '60|40', total: '100' } },
    { code: 'onerous_beneficiary_intact', outcome: 'passed', params: { lender: 'Banco Aliado', basis: 'outstanding_balance' } },
    documentoFalla
      ? { code: 'identity_documents_valid', outcome: 'failed', params: { checks: '2', not_found: '1', document: 'TI 1021447905' } }
      : { code: 'identity_documents_valid', outcome: 'passed', params: { checks: '2' } },
    { code: 'no_open_claim', outcome: 'passed', params: { open_claims: '0' } },
    { code: 'requester_is_holder', outcome: 'passed', params: { requester: s.titular.full_name, channel: 'web' } },
  ];
}

export interface Gateway {
  solicitudes: Solicitud[];
  historial: Record<string, unknown[]>;
}

function nuevoGateway(): Gateway {
  return {
    solicitudes: solicitudesIniciales(),
    historial: {
      [POLIZA_CAROLINA]: [
        {
          outcome: 'applied',
          at: '2026-09-16T19:30:00Z',
          endorsement_id: 'END-2026-0099',
          request_id: 'SOL-MOD-2026-0031',
          change_type: 'personal_data',
          changes: [{ field: 'personal_data.phone', previous: '3001112233', requested: '3012345678' }],
          premium: null,
          failed: [],
          by: ANALISTA,
        },
      ],
      [POLIZA_SIN_ENDOSOS]: [],
    },
  };
}

function detalleDto(g: Gateway, s: Solicitud) {
  const entradas = (g.historial[s.poliza] ?? []) as { outcome: string; endorsement_id: string; change_type: string; at: string }[];
  const aplicados = entradas.filter((e) => e.outcome === 'applied');
  const ultimo = aplicados[0];
  const conIntento = s.estado === 'applied' || s.estado === 'not_applied';
  return {
    request: solicitudDto(s),
    changes: cambios(s),
    premium: s.tipo === 'insured_amount' ? { previous: 68500, new: 82200, currency: 'COP', rating_version: 'v1' } : null,
    policy: {
      policy_id: s.poliza,
      line: 'life',
      holder: s.titular,
      in_force: true,
      coverage_start: '2026-07-16T12:00:00Z',
      coverage_end: '2099-07-16T12:00:00Z',
      insured_amount: 250000000,
      premium: 68500,
      currency: 'COP',
      onerous_beneficiary: { partner_id: 'aliado-banco-1', name: 'Banco Aliado', basis: 'outstanding_balance' },
      endorsements: {
        count: aplicados.length,
        last: ultimo ? { endorsement_id: ultimo.endorsement_id, change_type: ultimo.change_type, applied_at: ultimo.at } : null,
      },
    },
    validations: s.estado === 'rejected' && !s.decision?.failed.length ? [] : validaciones(s),
    validations_source: conIntento ? 'attempt' : s.estado === 'rejected' ? 'none' : 'preview',
    decision: s.decision ? { ...s.decision, by: ANALISTA } : null,
  };
}

function pagina(g: Gateway, params: URLSearchParams) {
  const estado = params.get('status') ?? 'pending';
  const pendiente = (s: Solicitud) => s.estado === 'filed' || s.estado === 'in_review' || (s.estado === 'not_applied' && !s.devuelta);
  const items = g.solicitudes
    .filter((s) => (estado === 'all' ? true : estado === 'pending' ? pendiente(s) : s.estado === estado))
    .map((s) => ({ ...solicitudDto(s), holder: s.titular }));
  return {
    items,
    page: 1,
    page_size: 20,
    total_items: items.length,
    total_pages: items.length > 0 ? 1 : 0,
    indicators: {
      pending: { count: g.solicitudes.filter(pendiente).length, overdue: 1 },
      applied_today: { count: 3, mean_time_to_apply_seconds: 12000 },
      rejected_last_7_days: { count: 1, top_reason: 'identity_documents_valid' },
    },
  };
}

function largo(texto: unknown): number {
  return typeof texto === 'string' ? [...texto.trim()].length : 0;
}

/** Simula el gateway de los endosos y devuelve lo que el portal le envió. */
export async function simularEndosos(page: Page, guion: GuionEndosos = {}): Promise<TraficoEndosos> {
  const g = nuevoGateway();
  const fijas = [...(guion.aplicar ?? [])];
  const trafico: TraficoEndosos = { tomadas: [], aplicadas: [], cierres: [], consultas: [] };
  const responder = (ruta: Route, estado: number, cuerpo: unknown) =>
    ruta.fulfill({ status: estado, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(cuerpo) });
  const buscar = (id: string) => g.solicitudes.find((s) => s.id === id);
  const ahora = '2026-09-16T21:20:00Z';

  await page.route(
    (url) => url.pathname === '/v1/policies/endorsement-requests',
    (ruta) => {
      const params = new URL(ruta.request().url()).searchParams;
      trafico.consultas.push(params);
      return responder(ruta, 200, pagina(g, params));
    },
  );

  await page.route(
    (url) => /^\/v1\/policies\/endorsement-requests\/[^/]+(\/[a-z]+)?$/.test(url.pathname),
    async (ruta) => {
      const partes = new URL(ruta.request().url()).pathname.split('/');
      const accion = partes.length === 6 ? partes[5] : null;
      const id = decodeURIComponent(partes[4]);
      const s = buscar(id);
      if (!s) {
        return responder(ruta, 404, { error: 'change_request_not_found', message: 'not found' });
      }
      if (accion === null) {
        return responder(ruta, 200, detalleDto(g, s));
      }
      if (accion === 'review') {
        trafico.tomadas.push(id);
        if (s.estado === 'filed') {
          s.estado = 'in_review';
          s.cambioEstado = ahora;
        }
        return responder(ruta, 200, { request: solicitudDto(s) });
      }
      if (accion === 'application') {
        trafico.aplicadas.push(id);
        const fija = fijas.shift();
        if (fija) {
          return responder(ruta, fija.estado, fija.cuerpo);
        }
        const falla = s.poliza === POLIZA_DIEGO;
        s.estado = falla ? 'not_applied' : 'applied';
        s.cambioEstado = ahora;
        const endoso = falla ? null : 'END-2026-0102';
        s.decision = { outcome: s.estado, at: ahora, observations: null, endorsement_id: endoso, failed: falla ? ['identity_documents_valid'] : [] };
        (g.historial[s.poliza] ??= []).unshift({
          outcome: s.estado,
          at: ahora,
          endorsement_id: endoso,
          request_id: s.id,
          change_type: s.tipo,
          changes: cambios(s),
          premium: null,
          failed: s.decision.failed,
          by: ANALISTA,
        });
        return responder(ruta, 200, {
          outcome: s.estado,
          request: solicitudDto(s),
          endorsement: endoso ? { endorsement_id: endoso, version: 2, applied_at: ahora, by: ANALISTA } : null,
          attempt: falla ? { at: ahora, by: ANALISTA, failed: ['identity_documents_valid'] } : null,
          validations: validaciones(s),
        });
      }
      if (accion === 'rejection' || accion === 'return') {
        const cuerpo = ruta.request().postDataJSON() as { observations?: unknown };
        trafico.cierres.push({ solicitud: id, accion, cuerpo });
        if (largo(cuerpo.observations) < 10 || largo(cuerpo.observations) > 500) {
          return responder(ruta, 422, { error: 'observations_required', message: 'm' });
        }
        const observaciones = String(cuerpo.observations).trim();
        s.motivo = observaciones;
        s.cambioEstado = ahora;
        if (accion === 'rejection') {
          s.estado = 'rejected';
          s.decision = { outcome: 'rejected', at: ahora, observations: observaciones, endorsement_id: null, failed: [] };
        } else {
          s.devuelta = true;
          s.decision = { outcome: 'returned', at: ahora, observations: observaciones, endorsement_id: null, failed: s.decision?.failed ?? [] };
        }
        return responder(ruta, 200, { request: solicitudDto(s) });
      }
      return responder(ruta, 404, { error: 'change_request_not_found', message: 'not found' });
    },
  );

  await page.route(
    (url) => /^\/v1\/policies\/[^/]+\/endorsements$/.test(url.pathname),
    (ruta) => {
      const poliza = decodeURIComponent(new URL(ruta.request().url()).pathname.split('/')[3]);
      const entradas = g.historial[poliza];
      if (!entradas) {
        return responder(ruta, 404, { error: 'policy_not_found', message: 'not found' });
      }
      const titular = g.solicitudes.find((s) => s.poliza === poliza)?.titular ?? { full_name: 'Carolina Pérez Ruiz', document_id: '1020345678' };
      return responder(ruta, 200, { policy_id: poliza, holder: titular, entries: entradas });
    },
  );
  return trafico;
}
