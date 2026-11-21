import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';

import { CandidatoAsistencia, UbicacionSolicitud } from '@core/api/siniestros/asistencia.modelos';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import { formatearCoordenadas } from '../../modelos/presentacion-asignacion';
import { coordenadasDe, nombreNecesidad } from '../../modelos/presentacion-asistencia';

/**
 * Confirmación del despacho (HU-W2.3-03, S15, CA-3): un `<dialog>` modal con el prestador, su distancia y llegada
 * estimada, la necesidad y la ubicación que se le compartirá (la del teléfono con su precisión, o la dirección indicada
 * por voz). El despacho no se deshace. El envío lo hace la página; mientras se envía no se puede cerrar. El foco vuelve
 * al botón que lo abrió. Mismo patrón que la confirmación de la asignación (HU-W2.3-01).
 */
@Component({
  selector: 'app-confirmar-despacho',
  imports: [TranslocoDirective, FormatoNumeroPipe, LucideX],
  templateUrl: './confirmar-despacho.component.html',
  styleUrl: './confirmar-despacho.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmarDespachoComponent {
  /** El código de la necesidad registrada. */
  readonly necesidad = input<string | null>(null);
  readonly ubicacion = input<UbicacionSolicitud | null>(null);
  readonly despachando = input(false);

  readonly confirmar = output<CandidatoAsistencia>();

  private readonly transloco = inject(TranslocoService);
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly candidato = signal<CandidatoAsistencia | null>(null);

  abrir(candidato: CandidatoAsistencia): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.candidato.set(candidato);
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected nombreNecesidad(t: Traductor, codigo: string | null): string {
    return codigo ? nombreNecesidad(t, codigo) : '—';
  }

  /** «4,7712 N · 74,0452 O · precisión 8 m» o «Vía Cali–Palmira km 4 · 3,4921 N · 76,4203 O (indicada por voz)». */
  protected ubicacionCompartida(t: Traductor): string {
    const u = this.ubicacion();
    const punto = u ? coordenadasDe(u) : null;
    if (!u || !punto) {
      return '—';
    }
    const coordenadas = formatearCoordenadas(
      t,
      punto.latitud,
      punto.longitud,
      this.transloco.getActiveLang(),
    );
    if (u.estado !== 'sent' && u.voz) {
      return t('asistencias.detalle.confirmarDespacho.ubicacionVoz', {
        direccion: u.voz.direccion,
        coordenadas,
      });
    }
    return u.precisionM === null
      ? coordenadas
      : t('asistencias.detalle.confirmarDespacho.ubicacionPrecision', {
          coordenadas,
          precision: u.precisionM,
        });
  }

  protected pedirCierre(): void {
    if (!this.despachando()) {
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
    if (candidato && !this.despachando()) {
      this.confirmar.emit(candidato);
    }
  }
}
