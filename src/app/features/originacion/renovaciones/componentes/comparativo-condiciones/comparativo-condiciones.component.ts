import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { RecotizacionRenovacion } from '@core/api/originacion/renovacion-asistida.modelos';
import { CondicionesPoliza } from '@core/api/originacion/renovacion.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { diaColombia, mismasCoberturas, porcentajeLegible, variacionLegible } from '../../modelos/presentacion-renovacion';

/**
 * Comparativo de S7 y S7b (HU-W1.5-03): las condiciones de la vigencia actual junto a las recotizadas —prima mensual
 * con su variación, vigencia, valor asegurado, descuento por buena experiencia y coberturas («Sin cambios» si
 * coinciden)—. Sin recotización, la columna recotizada muestra «—».
 */
@Component({
  selector: 'app-comparativo-condiciones',
  imports: [TranslocoDirective, FormatoMonedaPipe],
  templateUrl: './comparativo-condiciones.component.html',
  styleUrl: './comparativo-condiciones.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparativoCondicionesComponent {
  private readonly transloco = inject(TranslocoService);

  readonly vigente = input.required<CondicionesPoliza>();
  readonly recotizacion = input<RecotizacionRenovacion | null>(null);

  protected readonly renovada = computed(() => this.recotizacion()?.renovada ?? null);
  protected readonly sinCambiosEnCoberturas = computed(() => {
    const renovada = this.renovada();
    return renovada !== null && mismasCoberturas(this.vigente(), renovada);
  });

  protected dia(iso: string): string {
    return diaColombia(iso, this.transloco.getActiveLang());
  }

  protected variacion(fraccion: number): string {
    return variacionLegible(fraccion, this.transloco.getActiveLang());
  }

  /** Las coberturas con su nombre, separadas por comas. */
  protected coberturas(condiciones: CondicionesPoliza): string {
    return condiciones.coberturas
      .map((c) => this.transloco.translate(`originacion.renovacionAsistida.comparativo.cobertura.${c.codigo}`))
      .join(', ');
  }

  protected porcentaje(fraccion: number): string {
    return porcentajeLegible(fraccion, this.transloco.getActiveLang());
  }
}
