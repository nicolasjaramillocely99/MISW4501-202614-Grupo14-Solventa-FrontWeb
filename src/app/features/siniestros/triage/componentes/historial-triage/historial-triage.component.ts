import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowRightLeft, LucideCircleCheck, LucideRefreshCw } from '@lucide/angular';

import { EntradaHistorialTriage } from '@core/api/siniestros/triage.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import {
  DescripcionHistorial,
  descripcionHistorial,
  etiquetaActor,
  etiquetaCausa,
  insigniaNivel,
} from '../../../modelos/presentacion-triage';

interface FilaHistorial {
  entrada: EntradaHistorialTriage;
  descripcion: DescripcionHistorial;
}

/**
 * Historial de la prioridad (O6; HU-W2.2-01, CA-3, S5): una fila por cálculo, del más reciente al más antiguo, con su
 * fecha y hora. «Triage 2 asignado · automático» (primer cálculo), «Prioridad recalculada: Triage 2 → Triage 1 ·
 * Cambió el monto estimado» o «Prioridad revisada: se mantiene Triage 1 · …». Cada fila lleva ícono **y** texto. Una
 * causa que el front no conoce se muestra cruda.
 */
@Component({
  selector: 'app-historial-triage',
  imports: [TranslocoDirective, FormatoFechaHoraPipe, LucideCircleCheck, LucideArrowRightLeft, LucideRefreshCw],
  templateUrl: './historial-triage.component.html',
  styleUrl: './historial-triage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialTriageComponent {
  readonly historial = input.required<readonly EntradaHistorialTriage[]>();

  protected readonly filas = computed<FilaHistorial[]>(() =>
    this.historial().map((entrada) => ({ entrada, descripcion: descripcionHistorial(entrada) })),
  );

  protected readonly etiquetaNivel = (t: Traductor, nivel: number) => t(insigniaNivel(nivel as 1 | 2 | 3).clave);

  protected causas(t: Traductor, fila: FilaHistorial): string {
    return fila.descripcion.causas.map((causa) => etiquetaCausa(t, causa)).join(', ');
  }

  protected actor(t: Traductor, fila: FilaHistorial): string {
    return etiquetaActor(t, fila.entrada.actor);
  }
}
