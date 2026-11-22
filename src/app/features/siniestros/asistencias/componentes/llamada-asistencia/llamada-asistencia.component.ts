import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePhoneCall, LucidePhoneIncoming } from '@lucide/angular';

import { Actor } from '@core/api/siniestros/asignacion.modelos';
import { EstadoAsistencia } from '@core/api/siniestros/asistencia.modelos';

import { formatoCronometro } from '../../modelos/presentacion-asistencia';

/** Cada cuánto avanza el cronómetro. */
export const TIC_CRONOMETRO_MS = 1000;

/**
 * Tarjeta de la llamada del detalle O9b (HU-W2.3-03, S9). Con `in_call`, «Llamada en curso» con un cronómetro que el
 * portal calcula desde `inicio` (la última atención o toma del historial) con el reloj del navegador, y quién la
 * atiende; el cronómetro es un `timer` sin anuncios continuos para los lectores de pantalla. Con `new`, «Llamada
 * entrante». En los estados finales no se muestra. La línea de atención del mockup no está en el contrato (F6).
 */
@Component({
  selector: 'app-llamada-asistencia',
  imports: [TranslocoDirective, LucidePhoneCall, LucidePhoneIncoming],
  templateUrl: './llamada-asistencia.component.html',
  styleUrl: './llamada-asistencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlamadaAsistenciaComponent {
  readonly estado = input.required<EstadoAsistencia>();
  /** Instante RFC 3339 en que empezó la llamada en curso. */
  readonly inicio = input<string | null>(null);
  readonly atendidaPor = input<Actor | null>(null);

  private readonly ahora = signal(Date.now());
  private tic: ReturnType<typeof setInterval> | null = null;

  protected readonly cronometro = computed(() => {
    const inicio = this.inicio();
    return inicio ? formatoCronometro((this.ahora() - Date.parse(inicio)) / 1000) : null;
  });

  constructor() {
    // El reloj solo corre con la llamada en curso.
    effect(() => {
      const corriendo = this.estado() === 'in_call' && this.inicio() !== null;
      this.detener();
      if (corriendo) {
        this.ahora.set(Date.now());
        this.tic = setInterval(() => this.ahora.set(Date.now()), TIC_CRONOMETRO_MS);
      }
    });
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  private detener(): void {
    if (this.tic !== null) {
      clearInterval(this.tic);
      this.tic = null;
    }
  }
}
