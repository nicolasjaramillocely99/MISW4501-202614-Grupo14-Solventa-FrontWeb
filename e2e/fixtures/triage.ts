import { Page, Route } from '@playwright/test';

/**
 * Datos y simulacro del gateway de la prioridad automática del siniestro (HU-W2.2-01), con la forma del contrato del
 * backend (`docs/contratos/HU-W2.2-01-api.md`, política `triage-policy-v1`). Los plazos de la política son los del
 * contrato; el nivel lo decide el backend, aquí solo se sirve lo que respondería.
 */

export { ID_CASO } from './siniestros';

/** Daño por agua radicado con $ 4.800.000 al que luego se le subió el monto: Triage 1. */
export const ID_CASO_ALTO = 'c6dd0d52-73b3-495e-8fb2-291f8bf6214e';
/** Hurto sin monto declarado: Triage 1 solo por su severidad. */
export const ID_CASO_HURTO = 'c762e410-b71c-4536-8951-f130504290fe';
/** Caso que acaba de entrar a evaluación: todavía `pending`. */
export const ID_CASO_PENDIENTE = 'c3ada1e6-6394-43c7-a678-ae7a86f41898';
/** Un id con forma de caso que no existe. */
export const ID_CASO_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

const OBJETIVO_INMEDIATO = { kind: 'immediate', business_days: null, resolution_business_days: 2 };

export const POLITICA_V1 = {
  version: 'triage-policy-v1',
  currency: 'COP',
  amount_thresholds: { low_below_minor: 500000000, high_above_minor: 3000000000 },
  severity: [
    { line: 'auto', incident_type: 'collision', severity: 'medium' },
    { line: 'auto', incident_type: 'theft', severity: 'high' },
    { line: 'home', incident_type: 'water_damage', severity: 'medium' },
  ],
  targets: [
    { level: 1, target: OBJETIVO_INMEDIATO },
    { level: 2, target: { kind: 'business_days', business_days: 5, resolution_business_days: 5 } },
    { level: 3, target: { kind: 'business_days', business_days: 10, resolution_business_days: 10 } },
  ],
};

/** Vista `operations`: Triage 2 asignado al entrar a evaluación y recalculado a Triage 1 al cambiar el monto. */
export function triageOperaciones(claimId = ID_CASO_ALTO) {
  return {
    view: 'operations',
    claim_id: claimId,
    state: 'assessed',
    current: {
      level: 1,
      severity: 'medium',
      amount_band: 'high',
      estimated_amount_minor: 4000000000,
      currency: 'COP',
      incident_type: 'water_damage',
      coverage: 'water_damage',
      policy_version: 'triage-policy-v1',
      target: OBJETIVO_INMEDIATO,
      assessed_at: '2026-10-31T04:20:38.278329Z',
    },
    history: [
      {
        level: 1,
        previous_level: 2,
        severity: 'medium',
        amount_band: 'high',
        estimated_amount_minor: 4000000000,
        incident_type: 'water_damage',
        causes: ['estimated_amount_changed'],
        actor: 'system',
        policy_version: 'triage-policy-v1',
        assessed_at: '2026-10-31T04:20:38.278329Z',
      },
      {
        level: 2,
        previous_level: null,
        severity: 'medium',
        amount_band: 'low',
        estimated_amount_minor: 480000000,
        incident_type: 'water_damage',
        causes: ['entered_evaluation'],
        actor: 'system',
        policy_version: 'triage-policy-v1',
        assessed_at: '2026-10-31T04:20:28.282377Z',
      },
    ],
  };
}

export function triageOperacionesSinNivel(state: 'pending' | 'not_applicable', claimId = ID_CASO_PENDIENTE) {
  return { view: 'operations', claim_id: claimId, state, current: null, history: [] };
}

/** Vista `insured`: Triage 2, 5 días hábiles. */
export function triageAsegurado(claimId: string) {
  return {
    view: 'insured',
    claim_id: claimId,
    state: 'assessed',
    level: 2,
    estimated_resolution_business_days: 5,
    assessed_at: '2026-10-31T04:20:36.276289Z',
  };
}

export function triageAseguradoSinNivel(claimId: string, state: 'pending' | 'not_applicable' = 'pending') {
  return { view: 'insured', claim_id: claimId, state, level: null, estimated_resolution_business_days: null, assessed_at: null };
}

/** Una fila del lote con nivel. */
export function filaLote(claimId: string, level: 1 | 2 | 3, severity: string, band: string) {
  const target =
    level === 1
      ? OBJETIVO_INMEDIATO
      : { kind: 'business_days', business_days: level === 2 ? 5 : 10, resolution_business_days: level === 2 ? 5 : 10 };
  return { claim_id: claimId, state: 'assessed', level, severity, amount_band: band, target, assessed_at: '2026-10-31T04:20:38.278329Z' };
}

export function filaLoteSinNivel(claimId: string, state: 'pending' | 'not_found' | 'not_applicable') {
  return { claim_id: claimId, state, level: null, severity: null, amount_band: null, target: null, assessed_at: null };
}

/** Lote de tres ids: uno con Triage 1, uno `pending` y uno que no existe. */
export const LOTE_TRES = [
  filaLote(ID_CASO_ALTO, 1, 'medium', 'high'),
  filaLoteSinNivel(ID_CASO_PENDIENTE, 'pending'),
  filaLoteSinNivel(ID_CASO_INEXISTENTE, 'not_found'),
];

/** Respuesta simulada del API Gateway. */
export interface RespuestaTriage {
  estado: number;
  cuerpo: unknown;
}

/** Cada clave admite una respuesta o una **secuencia** (la última se repite): así se simula el sondeo de `pending`. */
export interface GuionTriage {
  politica?: RespuestaTriage | RespuestaTriage[];
  /** Respuesta por lote; si es una función recibe los `claim_id` pedidos. */
  lote?: RespuestaTriage | RespuestaTriage[] | ((ids: string[]) => RespuestaTriage);
  /** Respuesta de `GET /v1/claims/{id}/triage`; si es una función recibe el id. */
  triage?: RespuestaTriage | RespuestaTriage[] | ((id: string) => RespuestaTriage);
}

export interface LlamadasTriage {
  politica: number;
  /** Los `claim_id` de cada lectura por lote, en el orden en que viajaron. */
  lotes: string[][];
  /** El id de cada `GET /v1/claims/{id}/triage`. */
  triages: string[];
}

/** Un ayudante que sirve respuestas en orden y repite la última. */
function siguiente<T>(respuestas: T | T[]): () => T {
  const lista = Array.isArray(respuestas) ? respuestas : [respuestas];
  let indice = 0;
  return () => lista[Math.min(indice++, lista.length - 1)];
}

/**
 * Simula las tres lecturas del triage. Se registra **después** del guion de la radicación (si se usa en la misma
 * prueba): Playwright da prioridad a la ruta registrada al final, así que estas rutas ganan a la lectura genérica
 * `GET /v1/claims/{id}` de ese guion.
 */
export async function simularTriage(page: Page, guion: GuionTriage = {}): Promise<LlamadasTriage> {
  const llamadas: LlamadasTriage = { politica: 0, lotes: [], triages: [] };
  const politica = siguiente(guion.politica ?? { estado: 200, cuerpo: POLITICA_V1 });
  const lote = typeof guion.lote === 'function' ? guion.lote : (siguiente(guion.lote ?? { estado: 200, cuerpo: { items: LOTE_TRES } }) as () => RespuestaTriage);
  const triage =
    typeof guion.triage === 'function'
      ? guion.triage
      : (siguiente(guion.triage ?? { estado: 200, cuerpo: triageOperaciones() }) as () => RespuestaTriage);
  const responder = (ruta: Route, respuesta: RespuestaTriage) =>
    ruta.fulfill({
      status: respuesta.estado,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(respuesta.cuerpo),
    });

  await page.route('**/v1/claims/**', async (ruta) => {
    const peticion = ruta.request();
    const { pathname, searchParams } = new URL(peticion.url());
    if (peticion.method() !== 'GET') {
      await ruta.fallback();
    } else if (pathname === '/v1/claims/triage-policy') {
      llamadas.politica++;
      await responder(ruta, politica());
    } else if (pathname === '/v1/claims/triage') {
      const ids = searchParams.getAll('claim_id');
      llamadas.lotes.push(ids);
      await responder(ruta, (lote as (ids: string[]) => RespuestaTriage)(ids));
    } else if (/^\/v1\/claims\/[^/]+\/triage$/.test(pathname)) {
      const id = pathname.split('/')[3];
      llamadas.triages.push(id);
      await responder(ruta, (triage as (id: string) => RespuestaTriage)(id));
    } else {
      await ruta.fallback();
    }
  });
  return llamadas;
}
