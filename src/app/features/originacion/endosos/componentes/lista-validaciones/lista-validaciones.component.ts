import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideCircleX } from '@lucide/angular';

import { ResultadoValidacion, Validacion } from '@core/api/originacion/endosos.modelos';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { formatoDe, textoValidacion } from '../../modelos/formato-endoso';

/** «Cumple», «No cumple» y «No verificable»: el texto siempre acompaña al color. */
const TONO_VALIDACION: Readonly<Record<ResultadoValidacion, TonoInsignia>> = {
  passed: 'exito',
  failed: 'error',
  unverifiable: 'advertencia',
};

/**
 * «Validaciones de negocio» de O3 y O3b (HU-W1.4-02, CA-2): cada validación con su ícono, su título, el detalle con los
 * valores del contrato y su resultado. Es presentacional: la página decide qué validaciones se muestran.
 */
@Component({
  selector: 'app-lista-validaciones',
  imports: [TranslocoDirective, InsigniaEstadoComponent, LucideCircleAlert, LucideCircleCheck, LucideCircleX],
  templateUrl: './lista-validaciones.component.html',
  styleUrl: './lista-validaciones.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaValidacionesComponent {
  private readonly transloco = inject(TranslocoService);

  readonly validaciones = input.required<readonly Validacion[]>();

  protected readonly tono = TONO_VALIDACION;

  protected texto(v: Validacion): { titulo: string; detalle: string } {
    return textoValidacion(formatoDe(this.transloco), v);
  }
}
