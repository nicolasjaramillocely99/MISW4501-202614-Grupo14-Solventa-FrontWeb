import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ResumenSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../../../modelos/catalogo-siniestros';

/**
 * Tabla de «Mis siniestros» (A7 mínima; HU-W2.1-01, F1): radicado, póliza y tipo, fecha del hecho, etapa y fecha de
 * radicación. Los casos de la app móvil no traen la foto de la póliza: se muestra el tipo y «Radicado desde la app».
 * HU-W2.2-01 agrega «Ver detalle» por fila hacia `/siniestros/:id` (A8 mínima); «Corregir» y el resto de las acciones son
 * de HU-W2.1-02.
 */
@Component({
  selector: 'app-tabla-siniestros',
  imports: [RouterLink, TranslocoDirective, FormatoFechaHoraPipe, InsigniaEstadoComponent],
  templateUrl: './tabla-siniestros.component.html',
  styleUrl: './tabla-siniestros.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaSiniestrosComponent {
  readonly casos = input.required<readonly ResumenSiniestro[]>();

  /** «Autos · Colisión», o solo el tipo si el caso no guardó el ramo. */
  protected polizaYTipo(t: Traductor, caso: ResumenSiniestro): string {
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    const tipo = nombreTipo(t, caso.tipoSiniestro, undefined, 'corto');
    return ramo ? `${ramo} · ${tipo}` : tipo;
  }

  /** «AU-2025-118204 · KJT-482». */
  protected detallePoliza(caso: ResumenSiniestro): string {
    return [caso.poliza.id, caso.poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }
}
