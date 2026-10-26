import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideLock } from '@lucide/angular';

import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

/**
 * Panel «Resumen» de E4: qué se va a cobrar hoy y bajo qué garantías.
 *
 * Vive aparte de la página porque solo lo usa la captura del medio de pago.
 * E4c no lo lleva: allí la pantalla habla del rechazo, no del precio, y el
 * frame del prototipo lo refleja así.
 */
@Component({
  selector: 'app-resumen-pago',
  standalone: true,
  imports: [TranslocoDirective, LucideLock, FormatoMonedaPipe],
  templateUrl: './resumen-pago.component.html',
  styleUrl: './resumen-pago.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenPagoComponent {
  readonly monto = input.required<number>();
  readonly moneda = input.required<string>();
}
