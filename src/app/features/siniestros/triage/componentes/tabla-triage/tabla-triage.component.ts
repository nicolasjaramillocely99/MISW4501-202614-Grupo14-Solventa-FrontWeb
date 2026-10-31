import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ResumenTriage } from '@core/api/siniestros/triage.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import {
  etiquetaBanda,
  etiquetaEstado,
  etiquetaObjetivo,
  etiquetaSeveridad,
  insigniaNivel,
} from '../../../modelos/presentacion-triage';

/**
 * Tabla de la cola (O5; HU-W2.2-01, CA-4 y CA-5, S7): una fila por caso con su nivel, severidad, rango de monto,
 * objetivo de atención y fecha del cálculo. **No sabe de dónde salen los ids** (F1): recibe las filas ya leídas, así que
 * el listado de HU-W2.2-03 o la cola de HU-W2.2-02 la reutilizan sin cambiarla. `pending` se pinta «Calculando
 * prioridad…», `not_applicable` «Sin prioridad» y `not_found` no tiene fila.
 */
@Component({
  selector: 'app-tabla-triage',
  imports: [RouterLink, TranslocoDirective, FormatoFechaHoraPipe, InsigniaEstadoComponent],
  templateUrl: './tabla-triage.component.html',
  styleUrl: './tabla-triage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaTriageComponent {
  readonly filas = input.required<readonly ResumenTriage[]>();
  /** Parámetros que acompañan el enlace «Ver prioridad» (p. ej. la búsqueda, para que las migas vuelvan a ella). */
  readonly parametrosEnlace = input<Params | null>(null);

  protected readonly visibles = computed(() => this.filas().filter((fila) => fila.estado !== 'not_found'));

  protected readonly insigniaNivel = insigniaNivel;
  protected readonly etiquetaSeveridad = etiquetaSeveridad;
  protected readonly etiquetaBanda = etiquetaBanda;
  protected readonly etiquetaObjetivo = etiquetaObjetivo;
  protected readonly etiquetaEstado = etiquetaEstado;
}
