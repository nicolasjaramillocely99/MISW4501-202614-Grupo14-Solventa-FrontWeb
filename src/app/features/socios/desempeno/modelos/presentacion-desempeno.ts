/**
 * Presentación del desempeño técnico de la API (HU-W3.2-03): la duración de un incidente en partes legibles y la fecha y
 * hora de su inicio en Colombia, la misma zona de los periodos del backend.
 */

/** Partes de una duración: días, horas y minutos (al menos un minuto, para no mostrar «0 min» en un incidente). */
export interface PartesDuracion {
  dias: number;
  horas: number;
  minutos: number;
}

export function partesDuracion(segundos: number): PartesDuracion {
  const minutosTotales = Math.max(1, Math.round(segundos / 60));
  return {
    dias: Math.floor(minutosTotales / 1440),
    horas: Math.floor((minutosTotales % 1440) / 60),
    minutos: minutosTotales % 60,
  };
}

/** Clave de i18n de la duración según sus partes: solo minutos, horas y minutos, o días y horas. */
export function claveDuracion(p: PartesDuracion): 'minutos' | 'horas' | 'dias' {
  if (p.dias > 0) {
    return 'dias';
  }
  return p.horas > 0 ? 'horas' : 'minutos';
}

const ZONA_COLOMBIA = 'America/Bogota';

/** «16/09/2026 16:20»: fecha y hora de un instante en Colombia, en el orden del idioma. */
export function fechaHoraColombia(iso: string, idioma: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  const dia = new Intl.DateTimeFormat(idioma, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONA_COLOMBIA,
  }).format(fecha);
  return `${dia} ${horaColombia(iso, idioma)}`;
}

/** «16:20»: la hora de un instante en Colombia, en formato de 24 horas. */
export function horaColombia(iso: string, idioma: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(idioma, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA_COLOMBIA,
  }).format(fecha);
}
