import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Número con la API `Intl` en el idioma activo («0,82» / «0.82»), con hasta `decimales` cifras decimales
 * (2 por defecto). Se reevalúa al cambiar de idioma.
 */
@Pipe({ name: 'formatoNumero', pure: false })
export class FormatoNumeroPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(valor: number | null | undefined, decimales = 2): string {
    if (valor === null || valor === undefined || Number.isNaN(valor)) {
      return '';
    }
    return new Intl.NumberFormat(this.transloco.getActiveLang(), { maximumFractionDigits: decimales }).format(valor);
  }
}
