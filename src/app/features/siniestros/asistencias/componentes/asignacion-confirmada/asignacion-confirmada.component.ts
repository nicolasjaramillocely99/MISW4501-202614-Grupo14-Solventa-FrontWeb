import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleCheck, LucideInfo } from '@lucide/angular';

import { Asignacion } from '@core/api/siniestros/asignacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import { formatearCoordenadas } from '../../modelos/presentacion-asignacion';

/**
 * «Prestador asignado» (HU-W2.3-01, CA-5): el prestador con su contacto, la distancia, quién y cuándo asignó, la
 * ubicación que se le compartió y el estado del correo que le avisa. La página sigue el aviso mientras está
 * `pending`; si deja de seguirlo (`avisoDetenido`), se ofrece «Actualizar». Reasignar o cancelar es de HU-W2.3-02.
 */
@Component({
  selector: 'app-asignacion-confirmada',
  imports: [
    TranslocoDirective,
    FormatoFechaHoraPipe,
    FormatoNumeroPipe,
    LucideCircleCheck,
    LucideInfo,
  ],
  templateUrl: './asignacion-confirmada.component.html',
  styleUrl: './asignacion-confirmada.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsignacionConfirmadaComponent {
  readonly asignacion = input.required<Asignacion>();
  readonly avisoDetenido = input(false);

  readonly actualizar = output<void>();

  private readonly transloco = inject(TranslocoService);

  protected coordenadas(t: Traductor, latitud: number, longitud: number): string {
    return formatearCoordenadas(t, latitud, longitud, this.transloco.getActiveLang());
  }
}
