import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { SolicitudCredito } from '../../servicios/flujo-embebido.service';

/** Tarjeta «Tu crédito» de 352 px del canal embebido (frames E2 a E7): banco, monto, plazo y cuota. */
@Component({
  selector: 'app-tarjeta-credito',
  imports: [TranslocoDirective, FormatoMonedaPipe],
  template: `
    <section class="tarjeta credito" aria-labelledby="titulo-credito" *transloco="let t; prefix: 'embebido.credito'">
      <h2 id="titulo-credito" class="credito__titulo">{{ t('titulo') }}</h2>
      <dl class="credito__datos">
        <div>
          <dt>{{ t('banco') }}</dt>
          <dd>{{ solicitud().banco }}</dd>
        </div>
        <div>
          <dt>{{ t('montoAprobado') }}</dt>
          <dd class="credito__monto">{{ solicitud().montoAprobado | formatoMoneda: solicitud().moneda }}</dd>
        </div>
        <div>
          <dt>{{ t('plazo') }}</dt>
          <dd>{{ t('plazoAnios', { anios: solicitud().plazoAnios }) }}</dd>
        </div>
        <div>
          <dt>{{ t('cuotaEstimada') }}</dt>
          <dd>{{ t('cuotaMensual', { valor: solicitud().cuotaEstimada | formatoMoneda: solicitud().moneda }) }}</dd>
        </div>
      </dl>
    </section>
  `,
  styleUrl: './tarjeta-credito.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaCreditoComponent {
  readonly solicitud = input.required<SolicitudCredito>();
}
