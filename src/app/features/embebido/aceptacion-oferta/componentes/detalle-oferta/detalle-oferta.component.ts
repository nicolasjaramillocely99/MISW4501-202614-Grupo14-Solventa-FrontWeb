import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleCheck, LucideInfo } from '@lucide/angular';

import { PerfilRiesgo } from '@core/api/originacion/perfil-riesgo.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { DetalleOferta } from '../../modelos/detalle-oferta';

/**
 * Resumen de la oferta del paso 3 (frame E3): prima mensual, valor asegurado, vigencia, beneficiario,
 * perfil aplicado y coberturas. Es presentacional; el perfil aplicado solo se muestra si el paso 2 lo
 * dejó en el flujo.
 */
@Component({
  selector: 'app-detalle-oferta',
  imports: [TranslocoDirective, FormatoMonedaPipe, FormatoFechaHoraPipe, LucideCircleCheck, LucideInfo],
  templateUrl: './detalle-oferta.component.html',
  styleUrl: './detalle-oferta.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleOfertaComponent {
  readonly detalle = input.required<DetalleOferta>();
  readonly perfil = input<PerfilRiesgo | null>(null);
}
