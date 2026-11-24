import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideInfo } from '@lucide/angular';

import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';

/** Quién afirmó el consentimiento y cuándo, para la vista de solo lectura (S7b). */
export interface AfirmacionConsentimiento {
  asesor: string;
  fecha: string;
}

/**
 * Casilla de consentimiento del asesor (HU-W1.5-03, decisión D-13 c), solo para las pólizas vendidas en el canal
 * asistido: `audit` no guarda su consentimiento, así que el asesor afirma que el cliente autorizó consultar sus
 * datos financieros. Sin marcarla, «Recotizar» queda deshabilitado (lo decide la página) y, si el servicio responde
 * 422 en el campo `consent_affirmed`, se muestra el error. En S7b se muestra en solo lectura.
 */
@Component({
  selector: 'app-consentimiento-asesor',
  imports: [TranslocoDirective, FormatoFechaHoraPipe, LucideCircleAlert, LucideInfo],
  templateUrl: './consentimiento-asesor.component.html',
  styleUrl: './consentimiento-asesor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentimientoAsesorComponent {
  /** La casilla, enlazada con la página. */
  readonly afirmado = model(false);
  /** El servicio respondió 422 en `consent_affirmed`. */
  readonly conError = input(false);
  /** Mientras se recotiza no se cambia la casilla. */
  readonly deshabilitado = input(false);
  /** Afirmación ya registrada (S7b): se muestra en solo lectura. */
  readonly soloLectura = input<AfirmacionConsentimiento | null>(null);

  protected cambiar(evento: Event): void {
    this.afirmado.set((evento.target as HTMLInputElement).checked);
  }
}
