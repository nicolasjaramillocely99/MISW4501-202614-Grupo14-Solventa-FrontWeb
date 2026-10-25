import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { EstadoEntidad, EstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { etiquetaEstado } from '../../modelos/presentacion-revocacion';

/** Tono de la insignia de cada estado del aviso a una entidad; el texto siempre acompaña al color. */
const TONO_ENTIDAD: Readonly<Record<EstadoEntidad, TonoInsignia>> = {
  pending: 'advertencia',
  confirmed: 'exito',
  not_confirmed: 'error',
};

/**
 * Entidades financieras autorizadas (O15 / O15c, HU-W4.2-02). Sin revocación muestra el estado del consentimiento en
 * cada entidad; con revocación, el avance del aviso: «Pendiente · plazo hasta HH:mm», «Revocado» con la hora en que
 * confirmó o «Sin confirmación» con la hora en que se agotó el plazo (S6). No pinta el NIT, la última consulta ni los
 * datos autorizados por entidad: el contrato no los trae (F4).
 */
@Component({
  selector: 'app-entidades-revocacion',
  imports: [TranslocoDirective, InsigniaEstadoComponent, FormatoFechaHoraPipe],
  templateUrl: './entidades-revocacion.component.html',
  styleUrl: './entidades-revocacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntidadesRevocacionComponent {
  readonly estado = input.required<EstadoRevocacion>();

  protected readonly consentimiento = computed(() => etiquetaEstado(this.estado()));

  protected tonoDe(estado: EstadoEntidad): TonoInsignia {
    return TONO_ENTIDAD[estado];
  }
}
