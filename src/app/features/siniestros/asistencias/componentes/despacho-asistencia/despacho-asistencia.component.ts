import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleCheck, LucideInfo } from '@lucide/angular';

import { Despacho } from '@core/api/siniestros/asistencia.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import { formatearCoordenadas } from '../../modelos/presentacion-asignacion';
import { nombreNecesidad } from '../../modelos/presentacion-asistencia';

/**
 * «Prestador despachado» del detalle O9b (HU-W2.3-03, S17, CA-3): el prestador con su contacto, la distancia y la
 * llegada estimada, la necesidad, quién y cuándo despachó, la ubicación que se le compartió, si era el sugerido y el
 * estado del correo que le avisa. La página sigue el aviso mientras está `pending`; si deja de seguirlo
 * (`avisoDetenido`), se ofrece «Actualizar». No hay seguimiento después del despacho (fuera de alcance).
 */
@Component({
  selector: 'app-despacho-asistencia',
  imports: [
    TranslocoDirective,
    FormatoFechaHoraPipe,
    FormatoNumeroPipe,
    LucideCircleCheck,
    LucideInfo,
  ],
  templateUrl: './despacho-asistencia.component.html',
  styleUrl: './despacho-asistencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DespachoAsistenciaComponent {
  readonly despacho = input.required<Despacho>();
  /** El nombre del prestador que sugería el sistema, si no es el despachado; sin él, su id. */
  readonly nombreSugerido = input<string | null>(null);
  readonly avisoDetenido = input(false);

  readonly actualizar = output<void>();

  private readonly transloco = inject(TranslocoService);

  protected coordenadas(t: Traductor, latitud: number, longitud: number): string {
    return formatearCoordenadas(t, latitud, longitud, this.transloco.getActiveLang());
  }

  protected necesidad(t: Traductor, codigo: string): string {
    return nombreNecesidad(t, codigo);
  }
}
