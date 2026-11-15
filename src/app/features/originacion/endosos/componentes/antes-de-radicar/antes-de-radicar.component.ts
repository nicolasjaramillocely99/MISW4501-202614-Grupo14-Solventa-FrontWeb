import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck } from '@lucide/angular';

import { TipoCambio } from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

/**
 * «Antes de radicar» de A3 (HU-W1.4-01): solo el titular puede pedir cambios (CA-4), recibirá un identificador y podrá
 * seguir el estado (CA-2), y la regla del tipo elegido, en advertencia mientras haya errores (CA-3).
 */
@Component({
  selector: 'app-antes-de-radicar',
  imports: [TranslocoDirective, FormatoMonedaPipe, LucideCircleAlert, LucideCircleCheck],
  template: `
    <section class="tarjeta antes" aria-labelledby="titulo-antes-de-radicar" *transloco="let t; prefix: 'originacion.solicitudes.antes'">
      <h2 id="titulo-antes-de-radicar" class="antes__titulo">{{ t('titulo') }}</h2>
      <ul class="antes__lista">
        <li><svg lucideCircleCheck [size]="18" aria-hidden="true" class="antes__ok"></svg>{{ t('titular') }}</li>
        <li><svg lucideCircleCheck [size]="18" aria-hidden="true" class="antes__ok"></svg>{{ t('seguimiento') }}</li>
        <li [class.antes__aviso]="conErrores()">
          @if (conErrores()) {
            <svg lucideCircleAlert [size]="18" aria-hidden="true" class="antes__alerta"></svg>
          } @else {
            <svg lucideCircleCheck [size]="18" aria-hidden="true" class="antes__ok"></svg>
          }
          {{ t('reglas.' + tipo(), { min: (limites().valorMinimo | formatoMoneda: 'COP'), max: (limites().valorMaximo | formatoMoneda: 'COP') }) }}
        </li>
      </ul>
    </section>
  `,
  styles: `
    .antes__titulo {
      margin: 0 0 var(--espacio-12);
      font-size: 1.25rem;
      font-weight: 600;
    }
    .antes__lista {
      display: flex;
      flex-direction: column;
      gap: var(--espacio-12);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
    }
    li {
      display: flex;
      gap: var(--espacio-8);
      align-items: flex-start;
    }
    svg {
      flex-shrink: 0;
    }
    .antes__ok {
      color: var(--color-exito-600);
    }
    .antes__alerta {
      color: var(--color-advertencia-600);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AntesDeRadicarComponent {
  readonly tipo = input.required<TipoCambio>();
  readonly limites = input<{ valorMinimo: number; valorMaximo: number }>({ valorMinimo: 0, valorMaximo: 0 });
  /** La captura tiene errores: la regla del tipo se marca como advertencia. */
  readonly conErrores = input(false);
}
