import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { EstadoSolicitud } from '@core/api/originacion/solicitud-modificacion.modelos';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';
import { PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';

const TONO: Readonly<Record<EstadoSolicitud, TonoInsignia>> = {
  radicada: 'informacion',
  enRevision: 'informacion',
  aplicada: 'exito',
  rechazada: 'error',
  desconocido: 'neutro',
};

const PASOS = 'originacion.solicitudes.detalle.pasos';

/**
 * Los pasos de una solicitud para `app-indicador-pasos` (A3b): Radicada → En revisión → Aplicada, o Rechazada como último
 * paso cuando el analista la rechazó o la devolvió con motivo (ajuste A-1).
 */
export function pasosDeSolicitud(estado: EstadoSolicitud): PasoFlujo[] {
  switch (estado) {
    case 'enRevision':
      return [
        { etiqueta: `${PASOS}.radicada`, estado: 'completado' },
        { etiqueta: `${PASOS}.enRevision`, estado: 'actual' },
        { etiqueta: `${PASOS}.aplicada`, estado: 'pendiente' },
      ];
    case 'aplicada':
      return [
        { etiqueta: `${PASOS}.radicada`, estado: 'completado' },
        { etiqueta: `${PASOS}.enRevision`, estado: 'completado' },
        { etiqueta: `${PASOS}.aplicada`, estado: 'completado' },
      ];
    case 'rechazada':
      return [
        { etiqueta: `${PASOS}.radicada`, estado: 'completado' },
        { etiqueta: `${PASOS}.enRevision`, estado: 'completado' },
        { etiqueta: `${PASOS}.rechazada`, estado: 'actual' },
      ];
    default:
      return [
        { etiqueta: `${PASOS}.radicada`, estado: 'actual' },
        { etiqueta: `${PASOS}.enRevision`, estado: 'pendiente' },
        { etiqueta: `${PASOS}.aplicada`, estado: 'pendiente' },
      ];
  }
}

/**
 * Insignia del estado de una solicitud de modificación como la ve el asegurado (A3b y A11, HU-W1.4-01): el texto siempre
 * acompaña al color. HU-W1.4-02 puede reutilizarla.
 */
@Component({
  selector: 'app-estado-solicitud',
  imports: [TranslocoDirective, InsigniaEstadoComponent],
  template: `<app-insignia-estado [tono]="tono()" *transloco="let t">{{ t('originacion.solicitudes.estados.' + estado()) }}</app-insignia-estado>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoSolicitudComponent {
  readonly estado = input.required<EstadoSolicitud>();

  protected readonly tono = computed(() => TONO[this.estado()]);
}
