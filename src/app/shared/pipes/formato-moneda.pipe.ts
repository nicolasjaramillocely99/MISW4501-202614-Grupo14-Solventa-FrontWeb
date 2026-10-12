import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Monto con la API `Intl` en el idioma activo y la moneda indicada (COP, MXN, CLP, PEN…), seguido del
 * código de la moneda como en el prototipo («$ 250.000.000 COP»). Se reevalúa al cambiar de idioma.
 */
@Pipe({ name: 'formatoMoneda', pure: false })
export class FormatoMonedaPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(valor: number | null | undefined, moneda: string): string {
    if (valor === null || valor === undefined) {
      return '';
    }
    const formato = new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: moneda,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    });
    return `${formato.format(valor)} ${moneda}`;
  }
}
