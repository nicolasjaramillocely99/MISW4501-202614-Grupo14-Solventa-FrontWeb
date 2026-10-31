import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight, LucideSearch } from '@lucide/angular';

import { PaginaConsentimientos, ResumenConsentimiento } from '@core/api/auditoria/listado-consentimientos.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { DescripcionFiltro, rangoRegistros } from '../../modelos/filtro-listado';

/** Tono de la insignia por estado: el texto siempre acompaña al color. */
const TONO: Readonly<Record<ResumenConsentimiento['estado'], TonoInsignia>> = {
  active: 'exito',
  revoked: 'neutro',
  partially_revoked: 'error',
  expired: 'advertencia',
};

/**
 * Tabla del listado O14 / O14b (HU-W4.2-01, CA-1 y CA-3): cliente (nombre, documento enmascarado e identificador),
 * otorgado, vence, estado y alcance, con «Ver» hacia el detalle. Sin filas muestra «Sin consentimientos para el filtro
 * aplicado» con el filtro descrito y «Limpiar filtros». El pie dice el rango, la página y que el filtro se conserva; los
 * botones se deshabilitan en los extremos.
 */
@Component({
  selector: 'app-tabla-consentimientos',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    FormatoNumeroPipe,
    LucideChevronLeft,
    LucideChevronRight,
    LucideSearch,
  ],
  templateUrl: './tabla-consentimientos.component.html',
  styleUrl: './tabla-consentimientos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaConsentimientosComponent {
  private readonly transloco = inject(TranslocoService);

  readonly pagina = input.required<PaginaConsentimientos>();
  /** El filtro aplicado, para el mensaje sin resultados. */
  readonly filtro = input.required<DescripcionFiltro>();
  readonly anterior = output<void>();
  readonly siguiente = output<void>();
  readonly limpiar = output<void>();

  protected readonly rango = computed(() => rangoRegistros(this.pagina()));
  protected readonly hayAnterior = computed(() => this.pagina().pagina > 1 && this.pagina().totalRegistros > 0);
  protected readonly haySiguiente = computed(() => this.pagina().pagina < this.pagina().totalPaginas);

  protected tono(fila: ResumenConsentimiento): TonoInsignia {
    return TONO[fila.estado];
  }

  /** «13/09»: el día y el mes, en el idioma y la zona horaria del usuario. */
  protected diaMes(iso: string): string {
    return this.formatear(iso, { day: '2-digit', month: '2-digit' });
  }

  /** «16/09/2027»: la fecha sin la hora. */
  protected fecha(iso: string): string {
    return this.formatear(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** Las categorías de datos autorizadas y las entidades: «productos de crédito · saldos · … · Banco Aliado». */
  protected alcance(fila: ResumenConsentimiento): string {
    const categorias = fila.alcance
      .flatMap((fuente) => fuente.categoriasDatos)
      .map((codigo) => this.traducir(`auditoria.consentimientos.categorias.${codigo}`, codigo));
    const entidades = fila.entidades.map((e) => e.nombre).join(', ');
    return [...categorias, ...(entidades ? [entidades] : [])].join(' · ');
  }

  /** Con `Intl` y el orden del idioma, pero siempre con día y mes de dos cifras («10/09», como el frame). */
  private formatear(iso: string, opciones: Intl.DateTimeFormatOptions): string {
    const valor = new Date(iso);
    if (Number.isNaN(valor.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), opciones)
      .formatToParts(valor)
      .map((parte) => (parte.type === 'day' || parte.type === 'month' ? parte.value.padStart(2, '0') : parte.value))
      .join('');
  }

  private traducir(clave: string, respaldo: string): string {
    const texto = this.transloco.translate(clave);
    return texto === clave ? respaldo : texto;
  }
}
