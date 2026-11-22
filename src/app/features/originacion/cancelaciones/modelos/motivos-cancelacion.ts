import { MOTIVOS_CANCELACION, MotivoCancelacion } from '@core/api/originacion/cancelacion.modelos';

/**
 * Los motivos de la cancelación a solicitud del asegurado (HU-W1.6-01, decisión D-9 a), en el orden de la pantalla A5,
 * con la clave de su texto en `originacion.cancelacion.motivos`.
 */
export const OPCIONES_MOTIVO: readonly { codigo: MotivoCancelacion; clave: string }[] = MOTIVOS_CANCELACION.map(
  (codigo) => ({ codigo, clave: `motivos.${codigo}` }),
);

/** Un día en milisegundos. */
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * El último día cubierto por un periodo `[inicio, fin)`: el día anterior al siguiente vencimiento («17/12/2026» para un
 * periodo que vence de nuevo el 18/12/2026).
 */
export function ultimoDiaDelPeriodo(fin: string): string {
  const fecha = new Date(fin);
  return Number.isNaN(fecha.getTime()) ? fin : new Date(fecha.getTime() - DIA_MS).toISOString();
}
