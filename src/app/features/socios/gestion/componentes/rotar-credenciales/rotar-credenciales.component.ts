import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';

import { HORAS_TRANSICION_MAXIMO, HORAS_TRANSICION_MINIMO, validarHorasTransicion } from '../../modelos/presentacion-socios';

/**
 * Confirmación de «Rotar credenciales» (HU-W3.1-01 CA-5): un `<dialog>` modal que explica que se emite un par nuevo y que
 * el anterior sigue funcionando durante el periodo de transición, y pide ese periodo en horas (1–168; por defecto el del
 * servicio). El envío lo hace la página; mientras se envía no se puede cerrar.
 */
@Component({
  selector: 'app-rotar-credenciales',
  imports: [TranslocoDirective, LucideX],
  templateUrl: './rotar-credenciales.component.html',
  styleUrl: './rotar-credenciales.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotarCredencialesComponent {
  readonly horasPorDefecto = input.required<number>();
  readonly enviando = input(false);
  /** Clave i18n (`socios.errores.*`) del último error del servidor, o `null`. */
  readonly error = input<string | null>(null);

  readonly confirmar = output<number>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly minimo = HORAS_TRANSICION_MINIMO;
  protected readonly maximo = HORAS_TRANSICION_MAXIMO;
  protected readonly abierto = signal(false);
  protected readonly horas = signal<number | null>(24);
  protected readonly tocado = signal(false);
  protected readonly errorHoras = computed(() => (this.tocado() ? validarHorasTransicion(this.horas()) : null));

  abrir(): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.horas.set(this.horasPorDefecto());
    this.tocado.set(false);
    this.abierto.set(true);
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected pedirCierre(): void {
    if (!this.enviando()) {
      this.cerrar();
    }
  }

  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  protected alCerrar(): void {
    this.abierto.set(false);
    this.origen?.focus();
  }

  protected cambiarHoras(valor: string): void {
    this.tocado.set(true);
    this.horas.set(valor.trim() === '' ? null : Number(valor));
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    this.tocado.set(true);
    const horas = this.horas();
    if (this.enviando() || validarHorasTransicion(horas) !== null || horas === null) {
      return;
    }
    this.confirmar.emit(horas);
  }
}
