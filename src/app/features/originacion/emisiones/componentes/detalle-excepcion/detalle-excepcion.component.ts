import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective, TranslocoPipe } from '@jsverse/transloco';
import { LucideCircleAlert, LucideX } from '@lucide/angular';

import {
  AccionEmision,
  CodigoErrorEmision,
  Emision,
  ErrorEmision,
  ultimoPaso,
} from '@core/api/originacion/emision-monitor.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

/** Largo máximo de la nota del reintento, el del contrato (1 a 500 caracteres). */
export const MAX_NOTA = 500;

type FaseHistorial = 'cargando' | 'listo' | 'error';

/**
 * O1b · Detalle de la emisión (HU-W1.3-04). Muestra dónde está la emisión y el historial de lo que los analistas ya
 * hicieron (autor, nota y fecha). Si es una excepción explica por qué falló y permite reintentar el paso fallido
 * desde la aceptación registrada, con una nota obligatoria; una emisión sin excepción solo se consulta, porque no
 * pide ninguna acción. Es un diálogo modal: toma el foco al abrir, lo mantiene dentro y se cierra con Escape.
 *
 * El reintento es idempotente en el backend: si otro analista o el proceso automático ya reintentó lo que falló,
 * responde `issuance_not_retryable`, el diálogo lo explica y la lista se refresca; no hay doble cobro ni doble aviso.
 */
@Component({
  selector: 'app-detalle-excepcion',
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    TranslocoPipe,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideCircleAlert,
    LucideX,
  ],
  templateUrl: './detalle-excepcion.component.html',
  styleUrl: './detalle-excepcion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown)': 'alTeclear($event)' },
})
export class DetalleExcepcionComponent implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destruir = inject(DestroyRef);

  readonly emision = input.required<Emision>();
  /** El analista cerró el diálogo sin reintentar. */
  readonly cerrar = output<void>();
  /** Se reintentó, o ya no había nada fallido: la lista debe refrescarse. Lleva la aceptación. */
  readonly reintentada = output<string>();

  protected readonly maxNota = MAX_NOTA;
  protected readonly paso = ultimoPaso;
  protected readonly nota = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(MAX_NOTA), (c) => (String(c.value).trim() ? null : { required: true })],
  });
  protected readonly intentado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<CodigoErrorEmision | null>(null);
  protected readonly fase = signal<FaseHistorial>('cargando');
  protected readonly acciones = signal<readonly AccionEmision[]>([]);

  constructor() {
    afterNextRender(() => this.elemento.nativeElement.querySelector<HTMLElement>('#detalle-titulo')?.focus());
  }

  ngOnInit(): void {
    const consulta = this.api.listarAccionesEmision(this.emision().aceptacionId).subscribe({
      next: (lista) => {
        this.acciones.set(lista);
        this.fase.set('listo');
      },
      error: () => this.fase.set('error'),
    });
    this.destruir.onDestroy(() => consulta.unsubscribe());
  }

  /** Clave del error de la nota, o `null` si es válida o aún no se intentó enviar. */
  protected errorNota(): 'requerida' | 'larga' | null {
    if (!this.intentado()) {
      return null;
    }
    const errores = this.nota.errors;
    if (errores?.['maxlength']) {
      return 'larga';
    }
    return errores ? 'requerida' : null;
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    this.intentado.set(true);
    this.errorEnvio.set(null);
    if (this.nota.invalid || this.enviando()) {
      this.elemento.nativeElement.querySelector<HTMLElement>('#nota-reintento')?.focus();
      return;
    }
    this.enviando.set(true);
    const id = this.emision().aceptacionId;
    this.api.reintentarEmision(id, this.nota.value.trim()).subscribe({
      next: () => this.reintentada.emit(id),
      error: (error: unknown) => {
        this.enviando.set(false);
        const codigo = error instanceof ErrorEmision ? error.codigo : 'charge_unavailable';
        // Ya no hay nada fallido: alguien lo reintentó antes. La lista debe reflejarlo, así que no es un error a reintentar.
        if (codigo === 'issuance_not_retryable') {
          this.errorEnvio.set(codigo);
          return;
        }
        // 401 y 403 los resuelve el interceptor.
        if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
          this.errorEnvio.set(codigo);
        }
      },
    });
  }

  /** Escape cierra; Tab queda dentro del diálogo (modal). */
  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cerrar.emit();
      return;
    }
    if (evento.key !== 'Tab') {
      return;
    }
    const enfocables = Array.from(
      this.elemento.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, [tabindex="0"]'),
    );
    if (enfocables.length === 0) {
      return;
    }
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || activo === this.elemento.nativeElement.querySelector('#detalle-titulo'))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
