import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';

import { Candidato } from '@core/api/siniestros/asignacion.modelos';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

/**
 * Confirmación de la asignación (HU-W2.3-01, CA-5 «cuando se confirma»): un `<dialog>` modal con el prestador y su
 * distancia. El envío lo hace la página con la búsqueda que el analista tiene en pantalla; mientras se envía no se
 * puede cerrar. El foco vuelve al botón que lo abrió.
 */
@Component({
  selector: 'app-confirmar-asignacion',
  imports: [TranslocoDirective, FormatoNumeroPipe, LucideX],
  templateUrl: './confirmar-asignacion.component.html',
  styleUrl: './confirmar-asignacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmarAsignacionComponent {
  readonly asignando = input(false);

  readonly confirmar = output<Candidato>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly candidato = signal<Candidato | null>(null);

  abrir(candidato: Candidato): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.candidato.set(candidato);
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected pedirCierre(): void {
    if (!this.asignando()) {
      this.cerrar();
    }
  }

  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  protected alCerrar(): void {
    this.candidato.set(null);
    this.origen?.focus();
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    const candidato = this.candidato();
    if (candidato && !this.asignando()) {
      this.confirmar.emit(candidato);
    }
  }
}
