import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { TriageAsegurado } from '@core/api/siniestros/triage.modelos';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { etiquetaResolucion, insigniaNivel } from '../../../modelos/presentacion-triage';

/**
 * Prioridad que ve el asegurado en la etapa «En evaluación» de su siniestro (A8 mínima; HU-W2.2-01, CA-4, S9):
 * «Prioridad Triage 2 · Tiempo estimado de resolución: 5 días hábiles». Con `pending` dice «Calculando prioridad…» y
 * con `not_applicable` no pinta nada. **Sin** severidad, rango de monto ni historial: la vista `insured` del backend no
 * los trae y esta pantalla tampoco los pide.
 */
@Component({
  selector: 'app-prioridad-asegurado',
  imports: [TranslocoDirective, InsigniaEstadoComponent],
  templateUrl: './prioridad-asegurado.component.html',
  styleUrl: './prioridad-asegurado.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrioridadAseguradoComponent {
  readonly triage = input.required<TriageAsegurado>();

  protected readonly insigniaNivel = insigniaNivel;
  protected readonly etiquetaResolucion = etiquetaResolucion;
}
