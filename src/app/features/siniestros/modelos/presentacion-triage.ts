import {
  EntradaHistorialTriage,
  NivelTriage,
  ObjetivoTriage,
  PoliticaTriage,
} from '@core/api/siniestros/triage.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from './catalogo-siniestros';

/**
 * Presentación de la prioridad automática del siniestro (HU-W2.2-01): funciones puras, sin Angular, que usan `triage/` y
 * `seguimiento/`. El front **no calcula** el nivel: solo traduce por código lo que el backend decidió. Un código que no
 * conoce (una causa nueva, una severidad futura) se muestra tal cual en vez de romper la pantalla (F6).
 */

/** Máximo de ids por lectura por lote (`GET /v1/claims/triage`). */
export const MAX_IDS_LOTE = 50;

/** `ClaimID` del `openapi.yaml`: un UUID versión 4. */
const ID_CASO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SEVERIDADES: readonly string[] = ['high', 'medium', 'low'];
const BANDAS: readonly string[] = ['high', 'medium', 'low', 'unknown'];
const CAUSAS: readonly string[] = [
  'entered_evaluation',
  'estimated_amount_changed',
  'incident_type_changed',
  'coverage_changed',
  'provider_report_received',
  'policy_updated',
];
const ESTADOS: readonly string[] = ['pending', 'assessed', 'not_applicable', 'not_found'];

/** Tono de la insignia del nivel: 1 → error, 2 → advertencia, 3 → información (el texto siempre dice el nivel). */
const TONO_NIVEL: Readonly<Record<NivelTriage, TonoInsignia>> = { 1: 'error', 2: 'advertencia', 3: 'informacion' };

/** Insignia del nivel: la clave va bajo `siniestros` («Triage 1») y el tono refuerza, sin reemplazar, el texto. */
export function insigniaNivel(nivel: NivelTriage): { clave: string; tono: TonoInsignia } {
  return { clave: `triage.niveles.${nivel}`, tono: TONO_NIVEL[nivel] ?? 'neutro' };
}

function traducirConRespaldo(t: Traductor, grupo: string, codigos: readonly string[], codigo: string): string {
  return codigos.includes(codigo) ? t(`triage.${grupo}.${codigo}`) : codigo;
}

/** «alta» / «media» / «baja»; un código desconocido se muestra crudo. */
export function etiquetaSeveridad(t: Traductor, codigo: string): string {
  return traducirConRespaldo(t, 'severidades', SEVERIDADES, codigo);
}

/** «monto alto» / «monto medio» / «monto bajo» / «sin monto declarado»; un código desconocido se muestra crudo. */
export function etiquetaBanda(t: Traductor, codigo: string): string {
  return traducirConRespaldo(t, 'bandas', BANDAS, codigo);
}

/** Causa del recálculo («Cambió el monto estimado»); una causa nueva se muestra cruda. */
export function etiquetaCausa(t: Traductor, codigo: string): string {
  return traducirConRespaldo(t, 'causas', CAUSAS, codigo);
}

/** Quién calculó la prioridad: hoy siempre «automático»; un actor nuevo se muestra crudo. */
export function etiquetaActor(t: Traductor, codigo: string): string {
  return codigo === 'system' ? t('triage.historial.actores.system') : codigo;
}

/** Estado del triage («Calculando prioridad…»); un estado desconocido se muestra crudo. */
export function etiquetaEstado(t: Traductor, codigo: string): string {
  return traducirConRespaldo(t, 'estados', ESTADOS, codigo);
}

/** «1 día hábil» / «5 días hábiles». */
export function etiquetaDiasHabiles(t: Traductor, dias: number): string {
  return dias === 1 ? t('triage.diasHabilesUno') : t('triage.diasHabiles', { dias });
}

/** Objetivo de atención de la cola: «Atención inmediata» o «Objetivo: 5 días hábiles». */
export function etiquetaObjetivo(t: Traductor, objetivo: ObjetivoTriage): string {
  if (objetivo.tipo === 'immediate') {
    return t('triage.objetivos.inmediato');
  }
  if (objetivo.tipo === 'business_days' && objetivo.diasHabiles !== null) {
    return t('triage.objetivos.diasHabiles', { dias: etiquetaDiasHabiles(t, objetivo.diasHabiles) });
  }
  return objetivo.tipo;
}

/** Tiempo estimado de resolución que ve el asegurado: «Tiempo estimado de resolución: 5 días hábiles». */
export function etiquetaResolucion(t: Traductor, dias: number): string {
  return t('triage.resolucion', { dias: etiquetaDiasHabiles(t, dias) });
}

/** Cómo se cuenta una fila del historial (S5). */
export interface DescripcionHistorial {
  /** `asignado`: primer cálculo; `recalculado`: cambió el nivel; `revisado`: cambió la información, no el nivel. */
  tipo: 'asignado' | 'recalculado' | 'revisado';
  nivelAnterior: NivelTriage | null;
  nivel: NivelTriage;
  causas: string[];
}

export function descripcionHistorial(entrada: EntradaHistorialTriage): DescripcionHistorial {
  const tipo =
    entrada.nivelAnterior === null ? 'asignado' : entrada.nivelAnterior === entrada.nivel ? 'revisado' : 'recalculado';
  return { tipo, nivelAnterior: entrada.nivelAnterior, nivel: entrada.nivel, causas: entrada.causas };
}

/** Resultado de leer el campo de búsqueda de la cola (S6). */
export interface IdsBusqueda {
  /** Ids válidos, en minúsculas, sin repetir y en el orden en que se escribieron. */
  ids: string[];
  /** Textos que no tienen la forma de un id de caso. */
  invalidos: string[];
  /** Ids que venían más de una vez (se cuentan una sola vez). */
  repetidos: string[];
  /** Hay más de 50 ids válidos: el backend respondería `400`. */
  excedeMaximo: boolean;
}

/** Ids separados por comas, espacios o saltos de línea. */
export function parsearIdsBusqueda(texto: string): IdsBusqueda {
  const ids: string[] = [];
  const invalidos: string[] = [];
  const repetidos: string[] = [];
  for (const crudo of texto.split(/[\s,;]+/)) {
    const id = crudo.trim().toLowerCase();
    if (!id) {
      continue;
    }
    if (!ID_CASO.test(id)) {
      if (!invalidos.includes(crudo.trim())) {
        invalidos.push(crudo.trim());
      }
    } else if (ids.includes(id)) {
      if (!repetidos.includes(id)) {
        repetidos.push(id);
      }
    } else {
      ids.push(id);
    }
  }
  return { ids, invalidos, repetidos, excedeMaximo: ids.length > MAX_IDS_LOTE };
}

/** Centavos → pesos (los montos del contrato van en centavos de COP). */
export function montoEnPesos(minor: number): number {
  return minor / 100;
}

/** Umbrales de la política en pesos, para explicar la regla en el encabezado de la cola (S8). */
export function umbralesEnPesos(politica: PoliticaTriage): { bajo: number; alto: number } {
  return {
    bajo: montoEnPesos(politica.umbrales.bajoMenorQueMinor),
    alto: montoEnPesos(politica.umbrales.altoMayorQueMinor),
  };
}
