import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { EstadoSolicitudRevision, SolicitudRevision } from '@core/api/originacion/revision.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { claveMotivo } from '../../modelos/motivos';

/**
 * Tabla de la bandeja (S4): solicitud, solicitante, oferta, motivo del enrutamiento, llegada y «Revisar» (CA-1). En
 * «Decididas» agrega la decisión, el asesor y la fecha (CA-4). Es presentacional: la página entrega las filas ya
 * filtradas y ordenadas por el backend.
 */
@Component({
  selector: 'app-tabla-solicitudes',
  imports: [RouterLink, TranslocoDirective, FormatoFechaHoraPipe, FormatoMonedaPipe],
  templateUrl: './tabla-solicitudes.component.html',
  styleUrl: './tabla-solicitudes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaSolicitudesComponent {
  readonly solicitudes = input.required<readonly SolicitudRevision[]>();
  readonly estado = input.required<EstadoSolicitudRevision>();

  protected readonly claveMotivo = claveMotivo;
}
