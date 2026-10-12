import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCheck } from '@lucide/angular';

export type EstadoPaso = 'completado' | 'actual' | 'pendiente';

export interface PasoFlujo {
  /** Clave i18n de la etiqueta. */
  etiqueta: string;
  estado: EstadoPaso;
}

/**
 * Indicador de pasos del flujo embebido (sistema de diseño §5, «Paso de flujo»): círculo de 32 px
 * (completado azul/700 con check, actual con borde de 2 px, pendiente con borde base) y línea de
 * conexión lima/500 hacia los pasos ya alcanzados. El estado se anuncia con texto, no solo con color.
 */
@Component({
  selector: 'app-indicador-pasos',
  imports: [TranslocoDirective, LucideCheck],
  templateUrl: './indicador-pasos.component.html',
  styleUrl: './indicador-pasos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadorPasosComponent {
  readonly pasos = input.required<readonly PasoFlujo[]>();
  /** Clave i18n del nombre accesible de la lista de pasos. */
  readonly etiqueta = input.required<string>();
}
