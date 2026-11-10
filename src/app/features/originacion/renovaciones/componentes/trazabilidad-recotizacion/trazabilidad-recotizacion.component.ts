import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleCheck, LucideCircleX, LucideInfo } from '@lucide/angular';

import { FuenteRecotizacion, RecotizacionRenovacion } from '@core/api/originacion/renovacion-asistida.modelos';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { diaColombia } from '../../modelos/presentacion-renovacion';

/**
 * Por qué todavía no hay recotización: falta la casilla del asesor, el cliente no tiene consentimiento o no se pudo
 * verificar.
 */
export type MotivoPendiente = 'autorizacion' | 'sinAutorizacion' | 'sinVerificar';

/** Fuentes que consulta la recotización, en el orden en que se muestran mientras no hay una. */
const FUENTES_PENDIENTES: readonly string[] = ['open_finance', 'open_data', 'kyc'];

/**
 * Panel «Recotización» de S7 y «Trazabilidad de la recotización» de S7b (HU-W1.5-03): cada fuente consultada con su
 * estado y su latencia («No disponible» si no respondió), el motor de rating con su versión y sus factores, y la
 * nota del perfil usado: el último perfil en caché con su fecha o el actuarial base (CA-5, decisión D-7). El estado
 * nunca se comunica solo con color: cada fila lleva texto e ícono.
 */
@Component({
  selector: 'app-trazabilidad-recotizacion',
  imports: [TranslocoDirective, InsigniaEstadoComponent, FormatoNumeroPipe, LucideCircleCheck, LucideCircleX, LucideInfo],
  templateUrl: './trazabilidad-recotizacion.component.html',
  styleUrl: './trazabilidad-recotizacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrazabilidadRecotizacionComponent {
  private readonly transloco = inject(TranslocoService);

  readonly recotizacion = input<RecotizacionRenovacion | null>(null);
  /** S7b la titula «Trazabilidad de la recotización». */
  readonly trazabilidad = input(false);
  /** Sin recotización: por qué está pendiente. */
  readonly pendiente = input<MotivoPendiente | null>(null);

  protected readonly fuentesPendientes = FUENTES_PENDIENTES;
  protected readonly fuentes = computed(() => this.recotizacion()?.fuentes ?? []);

  protected disponible(fuente: FuenteRecotizacion): boolean {
    return fuente.estado === 'ok';
  }

  protected dia(iso: string | null): string {
    return diaColombia(iso, this.transloco.getActiveLang());
  }
}
