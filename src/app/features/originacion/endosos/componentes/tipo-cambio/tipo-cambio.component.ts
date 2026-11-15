import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideBanknote, LucideUser, LucideUsers } from '@lucide/angular';

import { SolicitudAbierta, TIPOS_CAMBIO, TipoCambio } from '@core/api/originacion/solicitud-modificacion.modelos';

/**
 * «Tipo de cambio» de A3 (HU-W1.4-01, CA-1): beneficiarios, sumas aseguradas o datos personales, como tarjetas de opción
 * única. Un tipo con una solicitud abierta queda deshabilitado con «Ya tienes la solicitud … en curso · Ver solicitud»
 * (decisión D-6 a, frame derivado de A3 «tipo con solicitud abierta»).
 */
@Component({
  selector: 'app-tipo-cambio',
  imports: [RouterLink, TranslocoDirective, LucideBanknote, LucideUser, LucideUsers],
  templateUrl: './tipo-cambio.component.html',
  styleUrl: './tipo-cambio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipoCambioComponent {
  /** El tipo elegido, enlazado con la página. */
  readonly seleccionado = model<TipoCambio | null>(null);
  /** Las solicitudes abiertas de la póliza (una por tipo como máximo). */
  readonly abiertas = input<readonly SolicitudAbierta[]>([]);
  /** Mientras se radica no se cambia el tipo. */
  readonly deshabilitado = input(false);

  protected readonly tipos = TIPOS_CAMBIO;

  protected abiertaDe(tipo: TipoCambio): SolicitudAbierta | undefined {
    return this.abiertas().find((a) => a.tipo === tipo);
  }

  protected elegir(tipo: TipoCambio): void {
    this.seleccionado.set(tipo);
  }
}
