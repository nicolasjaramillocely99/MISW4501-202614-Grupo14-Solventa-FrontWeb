import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { TriageOperaciones } from '@core/api/siniestros/triage.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { nombreTipo } from '../../../modelos/catalogo-siniestros';
import {
  etiquetaBanda,
  etiquetaObjetivo,
  etiquetaSeveridad,
  insigniaNivel,
  montoEnPesos,
} from '../../../modelos/presentacion-triage';

/**
 * Tarjeta «Prioridad» de un caso (O6; HU-W2.2-01, CA-1 a CA-4, F2): «Triage 2 · severidad media · monto bajo», monto
 * estimado, tipo, cobertura, objetivo de atención, fecha y hora del cálculo y versión de la política. Con `pending`
 * dice «Calculando prioridad…» y con `not_applicable` «Sin prioridad». Solo pinta lo que el backend calculó: nunca
 * sugiere un nivel. Diseñada para que HU-W2.2-03 la incruste en O6 (`/siniestros/:id/evaluar`) con la lectura
 * `GET /v1/claims/{id}/triage` del analista.
 */
@Component({
  selector: 'app-prioridad-triage',
  imports: [TranslocoDirective, FormatoFechaHoraPipe, FormatoMonedaPipe, InsigniaEstadoComponent],
  templateUrl: './prioridad-triage.component.html',
  styleUrl: './prioridad-triage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrioridadTriageComponent {
  readonly triage = input.required<TriageOperaciones>();

  protected readonly actual = computed(() => this.triage().actual);
  /** Pesos del monto estimado, o `null` si el caso no declaró monto. */
  protected readonly montoPesos = computed(() => {
    const minor = this.actual()?.montoEstimadoMinor;
    return minor === null || minor === undefined ? null : montoEnPesos(minor);
  });

  protected readonly insigniaNivel = insigniaNivel;
  protected readonly etiquetaSeveridad = etiquetaSeveridad;
  protected readonly etiquetaBanda = etiquetaBanda;
  protected readonly etiquetaObjetivo = etiquetaObjetivo;
  protected readonly nombreTipo = nombreTipo;
}
