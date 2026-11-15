import { RangoResumen } from '@core/api/originacion/resumen-socio.modelos';

/**
 * Rangos del tablero del socio (HU-W3.2-01, CA-2). Los días son los civiles de Colombia, como los del backend: «hoy» es
 * el día de Bogotá aunque el navegador esté en otra zona horaria. Todos los rangos incluyen su primer y su último día.
 */

/** Opciones del selector: hoy, últimos 7 días, últimos 30 días o un rango personalizado. */
export type OpcionRango = 'hoy' | 'ultimos7' | 'ultimos30' | 'personalizado';

export const OPCIONES_RANGO: readonly OpcionRango[] = ['hoy', 'ultimos7', 'ultimos30', 'personalizado'];

/** El tablero abre con los últimos 30 días, como el prototipo (B1). */
export const OPCION_INICIAL: OpcionRango = 'ultimos30';

/** Máximo de días de un rango (incluidos los dos extremos), el mismo límite del backend. */
export const MAXIMO_DIAS_RANGO = 366;

const ZONA_COLOMBIA = 'America/Bogota';
const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** El día civil de Colombia de un instante, `AAAA-MM-DD`. */
export function diaEnColombia(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** Suma (o resta) días a un día civil `AAAA-MM-DD`, sin pasar por la zona horaria. */
export function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Días que cubre el rango, los dos extremos incluidos. */
export function diasDelRango(rango: RangoResumen): number {
  return Math.round((Date.parse(`${rango.hasta}T00:00:00Z`) - Date.parse(`${rango.desde}T00:00:00Z`)) / MS_POR_DIA) + 1;
}

/** El rango de una opción fija contado hasta `hoy` (incluido): hoy, los últimos 7 o los últimos 30 días. */
export function rangoDeOpcion(opcion: Exclude<OpcionRango, 'personalizado'>, hoy: string): RangoResumen {
  const dias = { hoy: 1, ultimos7: 7, ultimos30: 30 }[opcion];
  return { desde: sumarDias(hoy, -(dias - 1)), hasta: hoy };
}

/** Por qué un rango personalizado no se puede consultar, o `null` si se puede. */
export type ProblemaRango = 'incompleto' | 'invertido' | 'muyLargo';

/**
 * Valida el rango personalizado antes de consultar (CA-2): los dos días, la fecha inicial no posterior a la final y como
 * máximo `MAXIMO_DIAS_RANGO` días.
 */
export function problemaDelRango(desde: string, hasta: string): ProblemaRango | null {
  if (!DIA_CIVIL.test(desde) || !DIA_CIVIL.test(hasta)) {
    return 'incompleto';
  }
  if (desde > hasta) {
    return 'invertido';
  }
  if (diasDelRango({ desde, hasta }) > MAXIMO_DIAS_RANGO) {
    return 'muyLargo';
  }
  return null;
}

/** La opción fija más amplia que la actual, para el estado sin datos («Ver últimos 7 días»); `null` si no hay. */
export function opcionMasAmplia(opcion: OpcionRango): 'ultimos7' | 'ultimos30' | null {
  switch (opcion) {
    case 'hoy':
      return 'ultimos7';
    case 'ultimos7':
      return 'ultimos30';
    default:
      return null;
  }
}
