import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';

import { Prestador, SolicitudDisponibilidad } from '@core/api/siniestros/asignacion.modelos';

/** Lo que la página envía al guardar: el prestador y su nueva disponibilidad. */
export interface CambioDisponibilidad {
  prestador: Prestador;
  solicitud: SolicitudDisponibilidad;
}

/**
 * Cambio de disponibilidad de un prestador (HU-W2.3-01, F2 y D13): un `<dialog>` con «Disponible» o «No disponible»
 * y, para este último, la fecha «Hasta» opcional (hoy o después; es informativa). Marcar disponible a un prestador
 * ocupado en un caso lo libera para otros casos. El envío lo hace la página; mientras se envía no se puede cerrar.
 */
@Component({
  selector: 'app-disponibilidad-prestador',
  imports: [TranslocoDirective, LucideX],
  templateUrl: './disponibilidad-prestador.component.html',
  styleUrl: './disponibilidad-prestador.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisponibilidadPrestadorComponent {
  /** Fecha local `YYYY-MM-DD` de hoy: «Hasta» no puede ser anterior. */
  readonly hoy = input.required<string>();
  readonly guardando = input(false);
  /** El servidor rechazó el cambio. */
  readonly error = input(false);

  readonly guardar = output<CambioDisponibilidad>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly prestador = signal<Prestador | null>(null);
  protected readonly disponibilidad = signal<'available' | 'unavailable'>('available');
  protected readonly hasta = signal('');
  /** `YYYY-MM-DD` se compara como texto. */
  protected readonly fechaPasada = computed(
    () =>
      this.disponibilidad() === 'unavailable' && this.hasta() !== '' && this.hasta() < this.hoy(),
  );

  abrir(prestador: Prestador): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.prestador.set(prestador);
    // Liberar a uno ocupado es marcarlo disponible; si ya lo está, lo natural es marcarlo no disponible.
    this.disponibilidad.set(prestador.disponibilidad === 'available' ? 'unavailable' : 'available');
    this.hasta.set(prestador.noDisponibleHasta ?? '');
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected pedirCierre(): void {
    if (!this.guardando()) {
      this.cerrar();
    }
  }

  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  protected alCerrar(): void {
    this.prestador.set(null);
    this.origen?.focus();
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    const prestador = this.prestador();
    if (!prestador || this.guardando() || this.fechaPasada()) {
      return;
    }
    const solicitud: SolicitudDisponibilidad =
      this.disponibilidad() === 'unavailable' && this.hasta()
        ? { disponibilidad: 'unavailable', hasta: this.hasta() }
        : { disponibilidad: this.disponibilidad() };
    this.guardar.emit({ prestador, solicitud });
  }
}
