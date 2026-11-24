import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { FilaCambio } from '../../modelos/formato-endoso';

/**
 * «Cambio solicitado» de O3 y O3b (HU-W1.4-02): campo, valor anterior y valor nuevo; el nuevo se resalta cuando cambia
 * («Sin cambio» no). Es presentacional: la página arma las filas con `filasCambio`.
 */
@Component({
  selector: 'app-tabla-cambios',
  imports: [TranslocoDirective],
  templateUrl: './tabla-cambios.component.html',
  styleUrl: './tabla-cambios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaCambiosComponent {
  readonly filas = input.required<readonly FilaCambio[]>();
}
