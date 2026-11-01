import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { IndicadoresConsentimientos } from '@core/api/auditoria/listado-consentimientos.modelos';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

/**
 * Las cuatro tarjetas del listado O14 (HU-W4.2-01, decisión D-5 a): activos, revocados en 30 días por canal, vencidos y
 * revocaciones fuera de plazo. Cuentan todos los consentimientos, sin el filtro (frame `877:9304`). Números con `Intl`.
 */
@Component({
  selector: 'app-indicadores-consentimientos',
  imports: [TranslocoDirective, FormatoNumeroPipe],
  templateUrl: './indicadores-consentimientos.component.html',
  styleUrl: './indicadores-consentimientos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadoresConsentimientosComponent {
  readonly indicadores = input.required<IndicadoresConsentimientos>();
}
