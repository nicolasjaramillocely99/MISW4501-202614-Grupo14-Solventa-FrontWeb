import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ResumenBandeja } from '@core/api/siniestros/asistencia.modelos';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import { formatearDuracion, superaObjetivo } from '../../modelos/presentacion-asistencia';

/**
 * Indicadores de la bandeja de asistencias (HU-W2.3-03, O9, S2): nuevas, despachadas hoy y tiempo medio de despacho con
 * su objetivo. Salen del `summary` de la bandeja y no dependen de los filtros. Que la media no cumple el objetivo se dice
 * en texto, no solo con color.
 */
@Component({
  selector: 'app-indicadores-asistencias',
  imports: [TranslocoDirective],
  templateUrl: './indicadores-asistencias.component.html',
  styleUrl: './indicadores-asistencias.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadoresAsistenciasComponent {
  readonly resumen = input.required<ResumenBandeja>();

  protected duracion(t: Traductor, segundos: number): string {
    return formatearDuracion(t, segundos);
  }

  protected supera(resumen: ResumenBandeja): boolean {
    return superaObjetivo(resumen.tiempoMedioDespachoSegundos, resumen.objetivoDespachoSegundos);
  }
}
