import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Tonos de la insignia de estado (sistema de diseño §5). */
export type TonoInsignia = 'exito' | 'advertencia' | 'error' | 'informacion' | 'neutro';

/**
 * Insignia de estado: alto 24, radio 6, fondo 100, texto 600 y punto de 6 px en 500. El texto va como
 * contenido (minúscula inicial: «Listo», «En curso»); el estado nunca se comunica solo con color.
 */
@Component({
  selector: 'app-insignia-estado',
  template: `<span class="insignia__punto" aria-hidden="true"></span><ng-content />`,
  styleUrl: './insignia-estado.component.scss',
  host: { '[class]': '"insignia insignia--" + tono()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsigniaEstadoComponent {
  readonly tono = input<TonoInsignia>('neutro');
}
