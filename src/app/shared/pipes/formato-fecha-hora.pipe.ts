import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** `fechaHora`: «16/09/2026, 14:05»; `hora`: «14:05». */
export type ModoFechaHora = 'fechaHora' | 'hora';

const OPCIONES: Readonly<Record<ModoFechaHora, Intl.DateTimeFormatOptions>> = {
  fechaHora: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  },
  hora: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
};

/**
 * Fecha y hora numéricas con la API `Intl` en el idioma activo y la zona horaria del usuario, como en el
 * prototipo («16/09/2026, 14:05» / «09/16/2026, 14:05»). Acepta RFC 3339 con fracción de segundo de
 * cualquier longitud. Se reevalúa al cambiar de idioma.
 */
@Pipe({ name: 'formatoFechaHora', pure: false })
export class FormatoFechaHoraPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(valor: string | Date | null | undefined, modo: ModoFechaHora = 'fechaHora'): string {
    if (!valor) {
      return '';
    }
    const fecha = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), OPCIONES[modo]).format(fecha);
  }
}
