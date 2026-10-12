import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** Fecha larga corta con la API `Intl` en el idioma activo («11 de octubre de 2026»). Acepta ISO 8601. */
@Pipe({ name: 'formatoFecha', pure: false })
export class FormatoFechaPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(valor: string | Date | null | undefined): string {
    if (!valor) {
      return '';
    }
    const fecha = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fecha);
  }
}
