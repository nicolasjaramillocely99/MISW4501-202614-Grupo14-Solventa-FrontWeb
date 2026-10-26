import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideTriangleAlert } from '@lucide/angular';

import { CotizacionAsistida, ErrorCotizacionAsistida } from '@core/api/originacion/cotizacion-asistida.modelos';
import {
  CampoFormalizacion,
  CodigoErrorFormalizacion,
  ConfirmacionEnviada,
  ErrorFormalizacion,
  Formalizacion,
  METODOS_ACEPTACION,
  MAX_REFERENCIA,
  MetodoAceptacion,
  SolicitudFormalizacion,
} from '@core/api/originacion/formalizacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

export type FaseFormalizacion = 'cargando' | 'listo' | 'noEncontrada' | 'error';

/** Paso del recorrido: registrar la aceptación del cliente (S3) o compra formalizada y emisión iniciada (S3c). */
export type PasoFormalizacion = 'formulario' | 'formalizada';

/** Campo del formulario que puede traer error: los del contrato y la casilla de confirmación. */
type CampoConError = CampoFormalizacion | 'confirmo';

/** Errores que resuelve el interceptor (sesión o rol): la pantalla no muestra aviso propio. */
const SIN_AVISO: readonly CodigoErrorFormalizacion[] = ['unauthorized', 'forbidden'];

const PATRON_CODIGO = /^[0-9]{6}$/;

/** El cliente no puede haber aceptado en el futuro; el backend tolera 5 minutos de diferencia de reloj. */
const TOLERANCIA_RELOJ_MS = 5 * 60_000;

/** Valor de un `<input type="datetime-local">` para el instante dado, en hora local. */
export function aFechaHoraLocal(instante: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${instante.getFullYear()}-${dos(instante.getMonth() + 1)}-${dos(instante.getDate())}T${dos(instante.getHours())}:${dos(instante.getMinutes())}`;
}

/**
 * S3 · Formalizar compra (HU-W1.1-03), con sus estados: **registro de la aceptación del cliente** (S3: medio,
 * fecha y hora, referencia y confirmación), **cotización vencida** (no se formaliza y se ofrece generar una
 * nueva) y **compra formalizada y emisión iniciada** (S3c). Los pasos viven en la misma página.
 *
 * El consentimiento del cliente (CA-5) es la llamada grabada o la firma remota, identificadas por su
 * referencia, o un código que el servicio le envía por correo y que el asesor digita; el código nunca vuelve
 * al asesor. Ruta: `/originacion/cotizaciones/:id/formalizar`.
 */
@Component({
  selector: 'app-formalizar-compra-page',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoMonedaPipe,
    FormatoFechaHoraPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideTriangleAlert,
  ],
  templateUrl: './formalizar-compra.page.html',
  styleUrl: './formalizar-compra.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormalizarCompraPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly metodos = METODOS_ACEPTACION;
  protected readonly maxReferencia = MAX_REFERENCIA;
  protected readonly pasos = [1, 2, 3, 4] as const;

  protected readonly fase = signal<FaseFormalizacion>('cargando');
  protected readonly paso = signal<PasoFormalizacion>('formulario');
  protected readonly cotizacion = signal<CotizacionAsistida | null>(null);
  protected readonly envio = signal<ConfirmacionEnviada | null>(null);
  protected readonly formalizacion = signal<Formalizacion | null>(null);
  protected readonly trabajando = signal(false);
  /** Clave bajo `originacion.formalizacion.errores` del último error general, o `null`. */
  protected readonly error = signal<string | null>(null);
  /** Clave bajo `originacion.formalizacion.errores.campos` de cada campo inválido. */
  protected readonly errores = signal<Partial<Record<CampoConError, string>>>({});

  protected readonly formulario = new FormGroup({
    metodo: new FormControl<MetodoAceptacion>('recorded_call', { nonNullable: true }),
    fecha: new FormControl(aFechaHoraLocal(new Date()), { nonNullable: true }),
    referencia: new FormControl('', { nonNullable: true }),
    codigo: new FormControl('', { nonNullable: true }),
    confirmo: new FormControl(false, { nonNullable: true }),
  });

  private readonly metodoElegido = toSignal(this.formulario.controls.metodo.valueChanges, {
    initialValue: this.formulario.controls.metodo.value,
  });
  protected readonly conCodigo = computed(() => this.metodoElegido() === 'confirmation_code');
  protected readonly vencida = computed(() => this.cotizacion()?.estado === 'expired');

  /** Vigencia de la póliza en años cuando el plazo es de años completos, y en meses si no. */
  protected readonly plazo = computed<{ clave: string; n: number }>(() => {
    const meses = this.cotizacion()?.plazoMeses ?? 0;
    if (meses > 0 && meses % 12 === 0) {
      return { clave: meses === 12 ? 'plazoAnio' : 'plazoAnios', n: meses / 12 };
    }
    return { clave: 'plazoMeses', n: meses };
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const { id } = this.ruta.snapshot.params;
    this.fase.set('cargando');
    this.api
      .consultarCotizacionAsistida(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacion.set(cotizacion);
          this.fase.set('listo');
          this.buscarFormalizacion(id);
        },
        error: (error: unknown) =>
          this.fase.set(
            error instanceof ErrorCotizacionAsistida && error.codigo === 'quote_not_found' ? 'noEncontrada' : 'error',
          ),
      });
  }

  /** Si la compra ya se formalizó (otra visita, otro asesor), se muestra el resultado en lugar del formulario. */
  private buscarFormalizacion(cotizacionId: string): void {
    this.api
      .consultarFormalizacion(cotizacionId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (formalizacion) => {
          this.formalizacion.set(formalizacion);
          this.paso.set('formalizada');
        },
        error: () => undefined,
      });
  }

  /** Envía al cliente el código de confirmación (también para reenviarlo). Solo con el medio «código». */
  protected enviarCodigo(): void {
    const cotizacion = this.cotizacion();
    if (!cotizacion || this.trabajando()) {
      return;
    }
    this.error.set(null);
    this.trabajando.set(true);
    this.api
      .solicitarConfirmacion(cotizacion.cotizacionId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (envio) => {
          this.trabajando.set(false);
          this.envio.set(envio);
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  protected formalizar(): void {
    const cotizacion = this.cotizacion();
    if (!cotizacion || this.trabajando()) {
      return;
    }
    const solicitud = this.validar();
    if (!solicitud) {
      return;
    }
    this.error.set(null);
    this.trabajando.set(true);
    this.api
      .formalizarCompra(cotizacion.cotizacionId, solicitud)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ formalizacion }) => {
          this.trabajando.set(false);
          this.formalizacion.set(formalizacion);
          this.paso.set('formalizada');
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  /** Revisa el formulario campo por campo; con errores los deja a la vista y no hay solicitud. */
  private validar(): SolicitudFormalizacion | null {
    const { metodo, fecha, referencia, codigo, confirmo } = this.formulario.getRawValue();
    const errores: Partial<Record<CampoConError, string>> = {};

    const instante = new Date(fecha);
    if (!fecha) {
      errores.fecha = 'required';
    } else if (Number.isNaN(instante.getTime())) {
      errores.fecha = 'invalid_format';
    } else if (instante.getTime() > Date.now() + TOLERANCIA_RELOJ_MS) {
      errores.fecha = 'out_of_range';
    }
    if (metodo === 'confirmation_code') {
      if (!PATRON_CODIGO.test(codigo)) {
        errores.codigo = codigo ? 'invalid_format' : 'required';
      }
    } else if (!referencia.trim()) {
      errores.referencia = 'required';
    }
    if (referencia.trim().length > MAX_REFERENCIA) {
      errores.referencia = 'invalid_format';
    }
    if (!confirmo) {
      errores.confirmo = 'required';
    }

    this.errores.set(errores);
    if (Object.keys(errores).length > 0) {
      return null;
    }
    return { metodo, aceptadaEn: instante.toISOString(), referencia, codigo };
  }

  private fallar(error: unknown): void {
    this.trabajando.set(false);
    const falla = error instanceof ErrorFormalizacion ? error : new ErrorFormalizacion('formalization_unavailable');
    const codigo = falla.codigo;
    if (codigo === 'quote_expired') {
      // Venció mientras el asesor trabajaba: se pasa al estado de vencida sin volver a consultar.
      this.cotizacion.update((c) => (c ? { ...c, estado: 'expired', puedeFormalizar: false, motivoBloqueo: 'quote_expired' } : c));
      return;
    }
    if (codigo === 'validation_failed') {
      this.errores.set(Object.fromEntries(falla.campos.map((c) => [c.campo, c.codigo])));
      return;
    }
    if (codigo === 'already_formalized') {
      this.buscarFormalizacion(this.cotizacion()?.cotizacionId ?? '');
    }
    this.error.set(SIN_AVISO.includes(codigo) ? null : codigo);
  }
}
