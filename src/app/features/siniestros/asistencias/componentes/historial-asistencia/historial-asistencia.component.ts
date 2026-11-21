import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AccionHistorial, Despacho } from '@core/api/siniestros/asistencia.modelos';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import { horaSolicitud, textoAccionHistorial } from '../../modelos/presentacion-asistencia';

/**
 * «Historial» del detalle O9b (HU-W2.3-03, S18, CA-5): cada decisión con su analista y su hora, de la más antigua a la
 * más reciente, tal como la registró el backend. El prestador despachado se nombra con el despacho; un `provider_id`
 * que no coincide se muestra crudo.
 */
@Component({
  selector: 'app-historial-asistencia',
  imports: [TranslocoDirective],
  templateUrl: './historial-asistencia.component.html',
  styleUrl: './historial-asistencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialAsistenciaComponent {
  readonly historial = input.required<readonly AccionHistorial[]>();
  readonly despacho = input<Despacho | null>(null);

  private readonly transloco = inject(TranslocoService);

  protected texto(t: Traductor, accion: AccionHistorial): string {
    const despacho = this.despacho();
    return textoAccionHistorial(t, accion, (id) =>
      despacho?.prestador.id === id ? despacho.prestador.nombre : id,
    );
  }

  protected hora(instante: string): string {
    return horaSolicitud(instante, new Date(), this.transloco.getActiveLang());
  }
}
