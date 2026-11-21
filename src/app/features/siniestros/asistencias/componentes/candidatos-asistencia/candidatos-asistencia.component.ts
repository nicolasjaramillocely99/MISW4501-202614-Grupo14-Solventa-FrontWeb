import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideTriangleAlert } from '@lucide/angular';

import { CandidatoAsistencia, Sugerencia } from '@core/api/siniestros/asistencia.modelos';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import {
  aFechaLocal,
  etiquetaDisponibilidad,
  nombresEspecialidades,
} from '../../modelos/presentacion-asignacion';
import { candidatosSeparados, tonoLlegada } from '../../modelos/presentacion-asistencia';

/**
 * «Prestadores cercanos» del detalle O9b (HU-W2.3-03, S14, CA-2) según el estado de la sugerencia, que el backend calcula
 * en cada lectura con el mecanismo de HU-W2.3-01 (D8):
 *
 * - `found`: la tabla de los `eligible` con la distancia y la llegada estimada (insignia por umbral provisional), el
 *   sugerido resaltado **y** con el texto «Sugerido», y «Despachar»; debajo, plegados, los demás prestadores con la
 *   especialidad (el contrato los trae todos, también a cientos de km), sin acción.
 * - `exhausted`: el aviso con las búsquedas hechas, «Buscar de nuevo» y «Cerrar como “Sin prestador disponible”».
 * - `need_missing` / `location_missing`: qué falta para ver la sugerencia.
 *
 * La confirmación y el envío los hace la página.
 */
@Component({
  selector: 'app-candidatos-asistencia',
  imports: [
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoNumeroPipe,
    FormatoFechaPipe,
    LucideTriangleAlert,
  ],
  templateUrl: './candidatos-asistencia.component.html',
  styleUrl: './candidatos-asistencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidatosAsistenciaComponent {
  readonly sugerencia = input.required<Sugerencia>();
  /** Fecha local `YYYY-MM-DD` de hoy, para «Disponible mañana». */
  readonly hoy = input.required<string>();
  /** Radio máximo de la política, para el texto de `exhausted`; sin política, el último intento. */
  readonly radioMaximoKm = input<number | null>(null);
  /** «Despachar» solo con la llamada en curso. */
  readonly despachable = input(true);
  /** Otra escritura en curso. */
  readonly deshabilitado = input(false);

  readonly despachar = output<CandidatoAsistencia>();
  readonly buscarDeNuevo = output<void>();
  readonly cerrarSinPrestador = output<void>();

  protected readonly separados = computed(() =>
    candidatosSeparados(this.sugerencia(), this.radioMaximoKm()),
  );
  protected readonly radioAgotado = computed(
    () => this.radioMaximoKm() ?? this.sugerencia().radioKm ?? 0,
  );

  protected readonly tonoLlegada = tonoLlegada;
  protected readonly aFechaLocal = aFechaLocal;

  protected disponibilidad(candidato: CandidatoAsistencia) {
    return etiquetaDisponibilidad(candidato, this.hoy());
  }

  protected especialidades(t: Traductor, codigos: readonly string[]): string {
    return nombresEspecialidades(t, codigos);
  }

  protected despachosHoy(t: Traductor, cantidad: number): string {
    if (cantidad === 0) {
      return t('asistencias.detalle.candidatos.despachosHoy.ninguno');
    }
    return cantidad === 1
      ? t('asistencias.detalle.candidatos.despachosHoy.uno')
      : t('asistencias.detalle.candidatos.despachosHoy.varios', { cantidad });
  }
}
