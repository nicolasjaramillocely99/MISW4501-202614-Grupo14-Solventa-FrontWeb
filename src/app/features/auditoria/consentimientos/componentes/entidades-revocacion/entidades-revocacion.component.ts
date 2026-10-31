import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { EstadoEntidad, EstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { etiquetaEstado } from '../../modelos/presentacion-revocacion';
import { TraducirCodigoPipe } from '../../pipes/traducir-codigo.pipe';

/** Tono de la insignia de cada estado del aviso a una entidad; el texto siempre acompaña al color. */
const TONO_ENTIDAD: Readonly<Record<EstadoEntidad, TonoInsignia>> = {
  pending: 'advertencia',
  confirmed: 'exito',
  not_confirmed: 'error',
};

/**
 * Entidades financieras autorizadas (O15 / O15c, HU-W4.2-02). Sin revocación muestra el estado del consentimiento en
 * cada entidad y, desde HU-W4.2-01, los datos autorizados (las categorías del alcance); con revocación, el avance del
 * aviso: «Pendiente · plazo hasta HH:mm», «Revocado» con la hora en que confirmó o «Sin confirmación» con la hora en que
 * se agotó el plazo (S6). No pinta el NIT ni la última consulta: el contrato no los trae (F4).
 */
@Component({
  selector: 'app-entidades-revocacion',
  imports: [TranslocoDirective, InsigniaEstadoComponent, FormatoFechaHoraPipe, TraducirCodigoPipe],
  templateUrl: './entidades-revocacion.component.html',
  styleUrl: './entidades-revocacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntidadesRevocacionComponent {
  readonly estado = input.required<EstadoRevocacion>();

  protected readonly consentimiento = computed(() => etiquetaEstado(this.estado()));
  /** Las categorías de datos del alcance, sin repetir (HU-W4.2-01). */
  protected readonly categorias = computed(() => [...new Set(this.estado().alcance.flatMap((fuente) => fuente.categoriasDatos))]);

  protected tonoDe(estado: EstadoEntidad): TonoInsignia {
    return TONO_ENTIDAD[estado];
  }
}
