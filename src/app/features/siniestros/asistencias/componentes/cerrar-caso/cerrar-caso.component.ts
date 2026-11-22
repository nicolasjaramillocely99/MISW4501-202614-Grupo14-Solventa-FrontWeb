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
import { LucideTriangleAlert, LucideX } from '@lucide/angular';

import { CampoInvalido } from '@core/api/siniestros/asignacion.modelos';
import {
  PasoIntervencion,
  RESULTADOS_CIERRE,
  ResultadoCierre,
  SolicitudCierreCaso,
} from '@core/api/siniestros/intervencion.modelos';

import { aFechaHoraLocal, desdeFechaHoraLocal } from '../../modelos/fecha-local';

type Campo = 'result' | 'closed_at' | 'notes' | 'confirmacion';

const MAX_OBSERVACIONES = 1000;

/**
 * Cerrar el caso (HU-W2.3-02, CA-3 a CA-5): un `<dialog>` modal con el resultado obligatorio, la fecha y hora de cierre
 * (por omisión, ahora), las observaciones y una confirmación de que el cierre no decide la indemnización. Si la
 * intervención no ha terminado, muestra qué pasos faltan y no deja enviar (CA-4); el backend lo vuelve a comprobar.
 * El envío lo hace la página. El foco vuelve al botón que lo abrió.
 */
@Component({
  selector: 'app-cerrar-caso',
  imports: [TranslocoDirective, LucideTriangleAlert, LucideX],
  templateUrl: './cerrar-caso.component.html',
  styleUrl: './cerrar-caso.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CerrarCasoComponent {
  readonly radicado = input('');
  readonly cerrando = input(false);
  /** Los pasos que faltan para poder cerrar; vacío si la intervención terminó. */
  readonly faltantes = input<readonly PasoIntervencion[]>([]);
  readonly erroresServidor = input<readonly CampoInvalido[]>([]);

  readonly cerrarCaso = output<SolicitudCierreCaso>();

  private readonly transloco = inject(TranslocoService);
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly abierto = signal(false);
  protected readonly ahora = signal('');
  protected readonly resultado = signal<ResultadoCierre | ''>('');
  protected readonly fecha = signal('');
  protected readonly observaciones = signal('');
  protected readonly confirmado = signal(false);
  protected readonly enviado = signal(false);
  private readonly editados = signal<ReadonlySet<Campo>>(new Set());

  protected readonly resultados = RESULTADOS_CIERRE;
  protected readonly maxObservaciones = MAX_OBSERVACIONES;

  abrir(): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ahora = aFechaHoraLocal(new Date());
    this.ahora.set(ahora);
    this.fecha.set(ahora);
    this.resultado.set('');
    this.observaciones.set('');
    this.confirmado.set(false);
    this.enviado.set(false);
    this.editados.set(new Set());
    this.abierto.set(true);
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected pedirCierre(): void {
    if (!this.cerrando()) {
      this.cerrar();
    }
  }

  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  protected alCerrar(): void {
    // El evento `close` llega en otra tarea: si el diálogo ya se volvió a abrir, ese cierre es viejo.
    if (this.dialogo()?.nativeElement.open) {
      return;
    }
    this.abierto.set(false);
    this.origen?.focus();
  }

  protected elegir(valor: string): void {
    this.resultado.set(
      RESULTADOS_CIERRE.includes(valor as ResultadoCierre) ? (valor as ResultadoCierre) : '',
    );
    this.marcar('result');
  }

  protected cambiarFecha(valor: string): void {
    this.fecha.set(valor);
    this.marcar('closed_at');
  }

  protected cambiarObservaciones(valor: string): void {
    this.observaciones.set(valor);
    this.marcar('notes');
  }

  protected confirmar(valor: boolean): void {
    this.confirmado.set(valor);
    this.marcar('confirmacion');
  }

  /** Código del error del campo (clave bajo `siniestros.intervencion.campos`), o `null`. */
  protected errorDe(campo: Campo): string | null {
    const servidor = this.erroresServidor().find((e) => e.campo === campo);
    if (servidor && !this.editados().has(campo)) {
      return campo === 'closed_at' && servidor.codigo === 'out_of_range'
        ? 'fecha'
        : servidor.codigo;
    }
    return this.enviado() ? this.errorLocal(campo) : null;
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    if (this.cerrando() || this.faltantes().length > 0) {
      return;
    }
    this.enviado.set(true);
    this.editados.set(new Set());
    const resultado = this.resultado();
    const cerradoEn = desdeFechaHoraLocal(this.fecha());
    const campos: Campo[] = ['result', 'closed_at', 'notes', 'confirmacion'];
    if (campos.some((c) => this.errorLocal(c) !== null) || !resultado || !cerradoEn) {
      return;
    }
    this.cerrarCaso.emit({ resultado, cerradoEn, observaciones: this.observaciones() });
  }

  /** «la reparación autorizada y la reparación ejecutada», en el idioma activo. */
  protected listaFaltantes(t: (clave: string) => string): string {
    const lista = new Intl.ListFormat(this.transloco.getActiveLang(), { type: 'conjunction' });
    return lista.format(this.faltantes().map((p) => t('linea.pasos.' + p).toLowerCase()));
  }

  private marcar(campo: Campo): void {
    this.editados.update((e) => new Set([...e, campo]));
  }

  private errorLocal(campo: Campo): string | null {
    switch (campo) {
      case 'result':
        return this.resultado() ? null : 'required';
      case 'closed_at':
        if (!desdeFechaHoraLocal(this.fecha())) {
          return 'required';
        }
        return this.fecha() > this.ahora() ? 'fecha' : null;
      case 'notes':
        return this.observaciones().trim().length > MAX_OBSERVACIONES ? 'out_of_range' : null;
      case 'confirmacion':
        return this.confirmado() ? null : 'confirmacion';
    }
  }
}
