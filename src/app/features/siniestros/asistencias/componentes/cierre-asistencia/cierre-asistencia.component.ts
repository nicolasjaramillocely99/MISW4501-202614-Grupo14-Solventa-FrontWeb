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

import { CampoInvalido } from '@core/api/siniestros/asignacion.modelos';
import { SolicitudCierre } from '@core/api/siniestros/asistencia.modelos';

import { Traductor } from '../../../modelos/catalogo-siniestros';
import {
  FormularioCierre,
  MOTIVO_CON_NOTA,
  NOTA_CIERRE_MAXIMA,
  ProblemaCierre,
  nombreMotivoCierre,
  validarCierre,
} from '../../modelos/presentacion-asistencia';

/** El `id` del formulario: «Cerrar solicitud» del encabezado lo envía con `form="cierre-asistencia"` (S16). */
export const ID_FORMULARIO_CIERRE = 'cierre-asistencia';

type Campo = keyof FormularioCierre;

/** Campo del contrato (`validation_failed.fields[].field`) → campo del formulario. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, Campo>> = { reason: 'motivo', note: 'nota' };

/**
 * «Cerrar por otro medio» del detalle O9b (HU-W2.3-03, S16, CA-4), un formulario en la página como el mockup: motivo de
 * la resolución (obligatorio, empieza vacío para que no haya cierres accidentales) y nota (obligatoria con «Otro»,
 * 3–500 caracteres sin caracteres de control). No tiene botón propio: lo envía «Cerrar solicitud» del encabezado. Sin
 * motivo, marca el campo y le lleva el foco. El `422` del servidor se marca en el campo. El envío lo hace la página.
 */
@Component({
  selector: 'app-cierre-asistencia',
  imports: [TranslocoDirective],
  templateUrl: './cierre-asistencia.component.html',
  styleUrl: './cierre-asistencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CierreAsistenciaComponent {
  /** Los motivos de la política, en su orden. */
  readonly motivos = input.required<readonly string[]>();
  readonly enviando = input(false);
  /** Otra escritura en curso. */
  readonly deshabilitado = input(false);
  /** Campos que rechazó el servidor (`validation_failed`). */
  readonly erroresServidor = input<readonly CampoInvalido[]>([]);

  readonly cerrar = output<SolicitudCierre>();

  protected readonly id = ID_FORMULARIO_CIERRE;
  protected readonly maximo = NOTA_CIERRE_MAXIMA;
  protected readonly formulario = signal<FormularioCierre>({ motivo: '', nota: '' });
  private readonly tocados = signal<ReadonlySet<Campo>>(new Set());
  private readonly intentado = signal(false);
  private readonly selector = viewChild<ElementRef<HTMLSelectElement>>('selector');
  private readonly nota = viewChild<ElementRef<HTMLTextAreaElement>>('nota');

  private readonly validacion = computed(() => validarCierre(this.formulario()));

  protected readonly notaObligatoria = computed(() => this.formulario().motivo === MOTIVO_CON_NOTA);
  protected readonly largoNota = computed(() => [...this.formulario().nota].length);

  /** Problema visible por campo: el del cliente tras tocarlo o intentar cerrar, o el del servidor. */
  protected readonly problemas = computed(() => {
    const visibles: Partial<Record<Campo, ProblemaCierre>> = {};
    for (const error of this.erroresServidor()) {
      const campo = CAMPO_DEL_CONTRATO[error.campo];
      if (campo) {
        visibles[campo] =
          error.codigo === 'required'
            ? 'requerido'
            : error.codigo === 'out_of_range'
              ? 'longitud'
              : 'formato';
      }
    }
    const cliente = this.validacion().problemas;
    for (const campo of ['motivo', 'nota'] as const) {
      if (cliente[campo] && (this.intentado() || this.tocados().has(campo))) {
        visibles[campo] = cliente[campo];
      }
    }
    return visibles;
  });

  /** Elige un motivo y lleva el foco al formulario («Cerrar como “Sin prestador disponible”», S14). */
  elegirMotivo(motivo: string): void {
    this.formulario.update((f) => ({ ...f, motivo }));
    this.selector()?.nativeElement.focus();
  }

  protected nombreMotivo(t: Traductor, codigo: string): string {
    return nombreMotivoCierre(t, codigo);
  }

  protected escribir(campo: Campo, valor: string): void {
    this.formulario.update((f) => ({ ...f, [campo]: valor }));
  }

  protected tocar(campo: Campo): void {
    this.tocados.update((tocados) => new Set([...tocados, campo]));
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    if (this.enviando() || this.deshabilitado()) {
      return;
    }
    this.intentado.set(true);
    const { problemas, solicitud } = this.validacion();
    if (solicitud) {
      this.cerrar.emit(solicitud);
      return;
    }
    (problemas.motivo ? this.selector() : this.nota())?.nativeElement.focus();
  }
}
