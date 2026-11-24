import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { BusquedaPrestador, IntentoBusqueda } from '@core/api/siniestros/asignacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';

/**
 * «Registro de intentos» de O7b (HU-W2.3-01, CA-4): una línea por radio intentado en la última búsqueda, con su hora y
 * cuántos prestadores elegibles encontró, y quién la lanzó (el analista o el reintento automático del caso pendiente).
 */
@Component({
  selector: 'app-registro-intentos',
  imports: [TranslocoDirective, FormatoFechaHoraPipe],
  templateUrl: './registro-intentos.component.html',
  styleUrl: './registro-intentos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroIntentosComponent {
  readonly busqueda = input.required<BusquedaPrestador>();
  /** El radio máximo de la política, para rotular «(máximo)»; sin política, `null`. */
  readonly radioMaximoKm = input<number | null>(null);

  /** Clave bajo `siniestros.asignacion.intentos` del resultado de un intento. */
  protected resultado(intento: IntentoBusqueda): 'ninguno' | 'uno' | 'varios' {
    if (intento.elegibles === 0) {
      return 'ninguno';
    }
    return intento.elegibles === 1 ? 'uno' : 'varios';
  }
}
