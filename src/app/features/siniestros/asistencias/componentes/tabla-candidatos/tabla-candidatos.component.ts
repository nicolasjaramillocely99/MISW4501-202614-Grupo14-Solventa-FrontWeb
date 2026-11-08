import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { BusquedaPrestador, Candidato } from '@core/api/siniestros/asignacion.modelos';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import {
  aFechaLocal,
  etiquetaDisponibilidad,
  nombreEspecialidad,
  nombresEspecialidades,
} from '../../modelos/presentacion-asignacion';

/**
 * «Prestadores con la especialidad requerida» de O7 y O7b (HU-W2.3-01, CA-2, CA-3 y CA-6): los candidatos de la última
 * búsqueda, del más cercano al más lejano, con su distancia y su disponibilidad. El sugerido va resaltado **y** con la
 * insignia «Sugerido». «Asignar» se habilita solo para los `eligible`: ni «Disponible mañana» ni «Fuera del radio» se
 * asignan (P8 y P9 del backend), aunque el mockup los muestre habilitados. La confirmación la hace la página.
 */
@Component({
  selector: 'app-tabla-candidatos',
  imports: [TranslocoDirective, InsigniaEstadoComponent, FormatoNumeroPipe, FormatoFechaPipe],
  templateUrl: './tabla-candidatos.component.html',
  styleUrl: './tabla-candidatos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaCandidatosComponent {
  readonly busqueda = input.required<BusquedaPrestador>();
  /** Fecha local `YYYY-MM-DD` de hoy, para «Disponible mañana». */
  readonly hoy = input.required<string>();
  /** Mientras la página busca o asigna, ningún «Asignar» responde. */
  readonly deshabilitado = input(false);

  readonly asignar = output<Candidato>();

  protected readonly aFechaLocal = aFechaLocal;

  protected disponibilidad(candidato: Candidato) {
    return etiquetaDisponibilidad(candidato, this.hoy());
  }

  protected especialidad(t: Traductor, codigo: string): string {
    return nombreEspecialidad(t, codigo).toLowerCase();
  }

  protected especialidades(t: Traductor, codigos: readonly string[]): string {
    return nombresEspecialidades(t, codigos);
  }
}
