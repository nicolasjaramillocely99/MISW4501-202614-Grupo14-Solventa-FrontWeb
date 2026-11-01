import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { PoliticaTriage } from '@core/api/siniestros/triage.modelos';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { etiquetaObjetivo, insigniaNivel } from '../../../modelos/presentacion-triage';

export type EstadoIndicadores = 'cargando' | 'listo' | 'error';

/**
 * Indicadores por nivel de la cola (O5; HU-W2.2-01, CA-5, S8): una tarjeta por objetivo de la política vigente
 * («Triage 1 · Atención inmediata», «Triage 2 · Objetivo: 5 días hábiles»…). Los plazos salen de
 * `GET /v1/claims/triage-policy`: el front no los fija. Sin conteo por nivel (F5): lo trae el listado de HU-W2.2-03.
 * Si la política falla, muestra su propio error con «Reintentar» y el resto de la cola sigue funcionando.
 */
@Component({
  selector: 'app-indicadores-triage',
  imports: [TranslocoDirective, InsigniaEstadoComponent],
  templateUrl: './indicadores-triage.component.html',
  styleUrl: './indicadores-triage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadoresTriageComponent {
  readonly estado = input.required<EstadoIndicadores>();
  readonly politica = input<PoliticaTriage | null>(null);
  readonly reintentar = output<void>();

  protected readonly insigniaNivel = insigniaNivel;
  protected readonly etiquetaObjetivo = etiquetaObjetivo;
}
