import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCheck } from '@lucide/angular';

import { EstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';

import { TraducirCodigoPipe } from '../../pipes/traducir-codigo.pipe';

/**
 * Historial de estados del consentimiento (O15 / O15c, HU-W4.2-02): una línea de tiempo con una entrada por cambio, con
 * la fecha y hora, la entidad (si es de una), el actor, el motivo y la referencia cuando existen. Desde HU-W4.2-01 muestra
 * también el canal: el del otorgamiento con su entidad («canal Banco Aliado (flujo embebido)») y el de la revocación. Cada
 * entrada lleva ícono y texto; los códigos que el diccionario no conoce se muestran crudos (F5, S7).
 */
@Component({
  selector: 'app-historial-consentimiento',
  imports: [TranslocoDirective, LucideCheck, FormatoFechaHoraPipe, TraducirCodigoPipe],
  templateUrl: './historial-consentimiento.component.html',
  styleUrl: './historial-consentimiento.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialConsentimientoComponent {
  readonly estado = input.required<EstadoRevocacion>();

  /** Cada entrada con el nombre de su entidad, buscado por código entre las del consentimiento y las de la revocación. */
  /** La entidad por la que se otorgó el consentimiento (hoy, el aliado). */
  protected readonly entidadOtorgamiento = computed(() => this.estado().entidades[0]?.nombre ?? null);

  protected readonly entradas = computed(() => {
    const estado = this.estado();
    const nombres = new Map<string, string>();
    for (const entidad of estado.entidades) {
      nombres.set(entidad.codigo, entidad.nombre);
    }
    for (const entidad of estado.revocacion?.entidades ?? []) {
      nombres.set(entidad.codigo, entidad.nombre);
    }
    return estado.historial.map((entrada, indice) => ({
      ...entrada,
      numero: indice + 1,
      actual: indice === estado.historial.length - 1,
      entidad: entrada.entidadCodigo ? (nombres.get(entrada.entidadCodigo) ?? entrada.entidadCodigo) : null,
    }));
  });
}
