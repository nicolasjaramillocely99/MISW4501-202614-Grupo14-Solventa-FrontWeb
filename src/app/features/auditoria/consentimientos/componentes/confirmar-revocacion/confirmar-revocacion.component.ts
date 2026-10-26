import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideBan, LucideCircleAlert, LucideX } from '@lucide/angular';
import { Observable, startWith } from 'rxjs';

import {
  CampoRevocacion,
  ErrorRevocacion,
  EstadoRevocacion,
  SolicitudRevocacion,
} from '@core/api/auditoria/revocacion.modelos';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import {
  FormularioRevocacion,
  REFERENCIA_MAXIMO,
  errorReferencia,
  faltantes,
  normalizarReferencia,
} from '../../modelos/presentacion-revocacion';
import { TraducirCodigoPipe } from '../../pipes/traducir-codigo.pipe';

/** Códigos del error de un campo (`auditoria.consentimientos.revocar.errores.campos.<campo>.<código>`). */
type CodigoCampo = 'required' | 'invalid_format' | 'out_of_range' | 'must_be_true';

/** Errores del servidor que tienen su propio texto dentro del modal; cualquier otro usa el genérico. */
const ERRORES_CON_TEXTO: readonly string[] = ['service_unavailable', 'idempotency_key_reused', 'invalid_request'];

/**
 * O15b · Confirmación de la revocación (HU-W4.2-02): un `<dialog>` nativo abierto con `showModal()`, que ya atrapa el
 * foco, cierra con `Escape` e inertiza el fondo (F3). Muestra a quién se revoca, qué alcance y qué entidades, y pide el
 * motivo, la referencia del ticket u orden y la casilla del rol (S2). «Revocar ahora» queda deshabilitado mientras falte
 * algo y el aviso dice exactamente qué. No cierra mientras se envía; un fallo del servidor deja lo diligenciado intacto
 * para reintentar con la misma `Idempotency-Key`. El envío lo hace la página: este componente solo emite la solicitud.
 */
@Component({
  selector: 'app-confirmar-revocacion',
  imports: [ReactiveFormsModule, TranslocoDirective, InsigniaEstadoComponent, TraducirCodigoPipe, LucideBan, LucideCircleAlert, LucideX],
  templateUrl: './confirmar-revocacion.component.html',
  styleUrl: './confirmar-revocacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmarRevocacionComponent {
  readonly estado = input.required<EstadoRevocacion>();
  /** La revocación se está enviando: no se puede cerrar ni volver a enviar. */
  readonly enviando = input(false);
  /** Último error del servidor al enviar; `validation_failed` marca los campos que nombra. */
  readonly error = input<ErrorRevocacion | null>(null);

  readonly confirmar = output<SolicitudRevocacion>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  /** Elemento que tenía el foco al abrir (el botón «Revocar consentimiento»), para devolvérselo al cerrar. */
  private origen: HTMLElement | null = null;

  protected readonly abierto = signal(false);
  protected readonly longitudReferencia = REFERENCIA_MAXIMO;
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    motivo: '' as FormularioRevocacion['motivo'],
    referencia: '',
    rolConfirmado: false,
  });
  private readonly valor = toSignal(this.formulario.valueChanges.pipe(startWith(this.formulario.getRawValue())), {
    requireSync: true,
  });
  /** Lo que falta o no es válido, en el orden del modal (S2). */
  protected readonly pendientes = computed(() => faltantes(this.valor() as FormularioRevocacion));
  protected readonly puedeEnviar = computed(() => this.pendientes().length === 0 && !this.enviando());

  /** Campos con un error del servidor que el analista aún no corrigió. */
  private readonly corregidos = signal<ReadonlySet<CampoRevocacion>>(new Set());
  private readonly camposTocados = signal<ReadonlySet<CampoRevocacion>>(new Set());

  /** Error de un campo: el del servidor (`validation_failed`) o, ya tocado el campo, el de la validación local. */
  protected readonly erroresDeCampo = computed(() => {
    const errores = new Map<CampoRevocacion, CodigoCampo>();
    const valor = this.valor() as FormularioRevocacion;
    const tocados = this.camposTocados();
    if (tocados.has('referencia')) {
      const local = errorReferencia(valor.referencia);
      if (local) {
        errores.set('referencia', local);
      }
    }
    const servidor = this.error();
    if (servidor?.codigo === 'validation_failed') {
      for (const { campo, codigo } of servidor.campos) {
        if (!this.corregidos().has(campo)) {
          errores.set(campo, codigo);
        }
      }
    }
    return errores;
  });

  /** Error del servidor que no es de un campo (p. ej. 503), con la clave de su texto. */
  protected readonly errorGeneral = computed(() => {
    const error = this.error();
    if (!error || error.codigo === 'validation_failed') {
      return null;
    }
    return ERRORES_CON_TEXTO.includes(error.codigo) ? error.codigo : 'generico';
  });

  constructor() {
    // Cada respuesta nueva del servidor vuelve a marcar los campos que nombra.
    effect(() => {
      this.error();
      this.corregidos.set(new Set());
    });
    const cambios: [CampoRevocacion, Observable<unknown>][] = [
      ['motivo', this.formulario.controls.motivo.valueChanges],
      ['referencia', this.formulario.controls.referencia.valueChanges],
      ['rolConfirmado', this.formulario.controls.rolConfirmado.valueChanges],
    ];
    for (const [campo, valueChanges] of cambios) {
      valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        this.corregidos.update((actuales) => new Set(actuales).add(campo));
      });
    }
  }

  /** Abre el modal con el formulario vacío. La página genera antes la `Idempotency-Key` de este modal. */
  abrir(): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.formulario.reset();
    this.camposTocados.set(new Set());
    this.abierto.set(true);
    this.dialogo()?.nativeElement.showModal();
  }

  /** Cierra el modal (tras revocar, por una carrera con el titular o porque el analista canceló). */
  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  /** Cancelar, la X o Escape; con el envío en curso no cierran. */
  protected pedirCierre(): void {
    if (!this.enviando()) {
      this.cerrar();
    }
  }

  /** Escape: el navegador cerraría solo; se frena para respetar un envío en curso y se cierra por `pedirCierre`. */
  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  /** El `<dialog>` ya se cerró: se limpia y se devuelve el foco al botón que lo abrió. */
  protected alCerrar(): void {
    this.abierto.set(false);
    this.origen?.focus();
  }

  protected tocar(campo: CampoRevocacion): void {
    this.camposTocados.update((actuales) => new Set(actuales).add(campo));
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      return;
    }
    const { motivo, referencia } = this.formulario.getRawValue();
    if (motivo === '') {
      return;
    }
    this.confirmar.emit({ motivo, referencia: normalizarReferencia(referencia), rolConfirmado: true });
  }
}
