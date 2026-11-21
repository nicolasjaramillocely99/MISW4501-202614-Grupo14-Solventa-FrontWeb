import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import {
  EstadoAsistencia,
  NecesidadRegistrada,
  PoliticaAsistencia,
} from '@core/api/siniestros/asistencia.modelos';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import { horaSolicitud, nombreNecesidad } from '../../modelos/presentacion-asistencia';

/**
 * «Necesidad reportada» del detalle O9b (HU-W2.3-03, S13, D1 del backend): el analista la elige durante la llamada entre
 * las de la política para la línea de la póliza, y define la especialidad que se busca. Registrada, muestra quién y
 * cuándo, y mientras la llamada siga en curso se puede cambiar. Sin necesidades para la línea (Viaje), la solicitud se
 * cierra con un motivo. Si la política no cargó, ofrece reintentar sin bloquear lo demás. El envío lo hace la página.
 */
@Component({
  selector: 'app-necesidad-asistencia',
  imports: [TranslocoDirective],
  templateUrl: './necesidad-asistencia.component.html',
  styleUrl: './necesidad-asistencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NecesidadAsistenciaComponent {
  readonly estado = input.required<EstadoAsistencia>();
  readonly necesidad = input<NecesidadRegistrada | null>(null);
  /** Las necesidades de la línea de la póliza; `null` mientras la política no está. */
  readonly opciones = input<PoliticaAsistencia['necesidades'] | null>(null);
  /** La política no cargó. */
  readonly politicaFallida = input(false);
  readonly registrando = input(false);
  /** Otra escritura en curso. */
  readonly deshabilitado = input(false);

  readonly registrar = output<string>();
  readonly reintentar = output<void>();

  private readonly transloco = inject(TranslocoService);
  private readonly selector = viewChild<ElementRef<HTMLSelectElement>>('selector');

  protected readonly cambiando = signal(false);
  protected readonly elegida = signal('');
  protected readonly sinElegir = signal(false);

  constructor() {
    // Una necesidad nueva (registrada aquí o por otro analista) cierra el cambio en curso.
    effect(() => {
      this.necesidad();
      untracked(() => {
        this.cambiando.set(false);
        this.sinElegir.set(false);
      });
    });
  }

  protected nombre(t: Traductor, codigo: string): string {
    return nombreNecesidad(t, codigo);
  }

  protected hora(instante: string): string {
    return horaSolicitud(instante, new Date(), this.transloco.getActiveLang());
  }

  protected cambiar(): void {
    this.elegida.set(this.necesidad()?.codigo ?? '');
    this.sinElegir.set(false);
    this.cambiando.set(true);
  }

  protected elegir(codigo: string): void {
    this.elegida.set(codigo);
    this.sinElegir.set(false);
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    const codigo = this.elegida();
    if (!codigo) {
      this.sinElegir.set(true);
      this.selector()?.nativeElement.focus();
      return;
    }
    if (codigo === this.necesidad()?.codigo) {
      this.cambiando.set(false);
      return;
    }
    if (!this.registrando() && !this.deshabilitado()) {
      this.registrar.emit(codigo);
    }
  }
}
