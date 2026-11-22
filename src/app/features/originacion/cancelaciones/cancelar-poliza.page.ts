import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCircleAlert,
  LucideCircleX,
  LucideInfo,
  LucidePencil,
  LucideTriangleAlert,
} from '@lucide/angular';

import {
  CotizacionCancelacion,
  ErrorCancelacion,
  MAX_COMENTARIOS_CANCELACION,
  MotivoCancelacion,
} from '@core/api/originacion/cancelacion.modelos';
import { DetallePoliza, ErrorPoliza } from '@core/api/originacion/detalle-poliza.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

import { fechaCorta } from '../endosos/modelos/fecha-corta';
import { OPCIONES_MOTIVO, ultimoDiaDelPeriodo } from './modelos/motivos-cancelacion';

/**
 * `cargando`: la póliza y el cálculo; `listo`: se puede confirmar; `confirmando`: el `POST` va en camino;
 * `renovacion`: la renovación del periodo está en curso (D-6 a); `noVigente`: la póliza venció o aún no empieza;
 * `noEncontrada`: no existe o no es del asegurado; `error`: no se pudo calcular (con «Reintentar»).
 */
type Fase = 'cargando' | 'listo' | 'confirmando' | 'renovacion' | 'noVigente' | 'noEncontrada' | 'error';

/** El aviso de la confirmación: el monto cambió (409), se está cobrando la cuota (409) o falló. */
type Aviso = 'montoCambio' | 'cobroEnCurso' | 'errorConfirmar';

/**
 * A5 · Cancelar póliza (HU-W1.6-01): antes de confirmar, el cálculo del reembolso prorrateado (CA-1) —lo pagado del
 * mes en curso, los días no utilizados, el prorrateo, el método y la fecha efectiva— y el monto a reembolsar; el motivo
 * de la lista, comentarios opcionales y la casilla de cancelación definitiva habilitan «Confirmar cancelación». Al
 * confirmar (CA-2) la póliza queda cancelada con su reembolso registrado y la página vuelve al detalle, que muestra A5b.
 * «Conservar mi póliza» vuelve al detalle sin cambios. Los estados del prototipo viven aquí: reembolso 0 (cuota en
 * gracia), bloqueada por renovación, monto cambiado, cobro de la cuota en curso y error al cargar. Ruta:
 * `/originacion/polizas/:id/cancelar`. Exige la sesión del asegurado.
 */
@Component({
  selector: 'app-cancelar-poliza-page',
  imports: [
    RouterLink,
    TitleCasePipe,
    TranslocoDirective,
    FormatoMonedaPipe,
    FormatoNumeroPipe,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideCircleX,
    LucideInfo,
    LucidePencil,
    LucideTriangleAlert,
  ],
  templateUrl: './cancelar-poliza.page.html',
  styleUrl: './cancelar-poliza.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelarPolizaPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruccion = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly motivos = OPCIONES_MOTIVO;
  protected readonly maxComentarios = MAX_COMENTARIOS_CANCELACION;

  protected readonly polizaId = signal('');
  protected readonly fase = signal<Fase>('cargando');
  protected readonly poliza = signal<DetallePoliza | null>(null);
  protected readonly cotizacion = signal<CotizacionCancelacion | null>(null);
  protected readonly aviso = signal<Aviso | null>(null);

  protected readonly motivo = signal<MotivoCancelacion | ''>('');
  protected readonly comentarios = signal('');
  protected readonly acepta = signal(false);

  /** Sin prima pagada sin usar (la cuota del mes está en gracia): el reembolso es 0 y no aplica. */
  protected readonly sinReembolso = computed(() => (this.cotizacion()?.montoReembolso ?? 0) === 0);
  /** Con la cotización a la vista: el cálculo, el monto y el formulario. */
  protected readonly conCalculo = computed(
    () => this.cotizacion() !== null && (this.fase() === 'listo' || this.fase() === 'confirmando'),
  );
  protected readonly puedeConfirmar = computed(
    () => this.fase() === 'listo' && this.motivo() !== '' && this.acepta() && this.cotizacion() !== null,
  );

  ngOnInit(): void {
    this.polizaId.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.cargar();
  }

  /** La póliza (encabezado) y luego el cálculo del reembolso. */
  protected cargar(): void {
    this.fase.set('cargando');
    this.aviso.set(null);
    this.api
      .consultarPoliza(this.polizaId())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (poliza) => {
          this.poliza.set(poliza);
          if (poliza.cancelacion) {
            this.irAlDetalle();
            return;
          }
          this.cotizar();
        },
        error: (error: unknown) =>
          this.fase.set(
            error instanceof ErrorPoliza && error.codigo === 'policy_not_found' ? 'noEncontrada' : 'error',
          ),
      });
  }

  /** El cálculo del reembolso si el asegurado cancelara hoy (CA-1). */
  protected cotizar(): void {
    this.fase.set('cargando');
    this.api
      .cotizarCancelacion(this.polizaId())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacion.set(cotizacion);
          this.fase.set('listo');
        },
        error: (error: unknown) => this.alFallar(error),
      });
  }

  protected elegirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLSelectElement).value as MotivoCancelacion | '');
  }

  protected escribirComentarios(evento: Event): void {
    this.comentarios.set((evento.target as HTMLInputElement).value);
  }

  protected marcar(evento: Event): void {
    this.acepta.set((evento.target as HTMLInputElement).checked);
  }

  /** CA-2: cancela con el monto que vio el asegurado; con `201` vuelve al detalle, que muestra A5b. */
  protected confirmar(): void {
    const cotizacion = this.cotizacion();
    const motivo = this.motivo();
    if (!this.puedeConfirmar() || !cotizacion || motivo === '') {
      return;
    }
    this.fase.set('confirmando');
    this.aviso.set(null);
    this.api
      .cancelarPoliza(this.polizaId(), {
        motivo,
        comentarios: this.comentarios(),
        montoReembolso: cotizacion.montoReembolso,
      })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: () => this.irAlDetalle(),
        error: (error: unknown) => this.alFallar(error),
      });
  }

  private alFallar(error: unknown): void {
    const codigo = error instanceof ErrorCancelacion ? error.codigo : 'cancellation_unavailable';
    const confirmando = this.fase() === 'confirmando';
    switch (codigo) {
      case 'refund_changed':
        // El monto que se registra es el que ve el asegurado: se muestra el nuevo y debe aceptarlo otra vez.
        if (error instanceof ErrorCancelacion && error.cotizacion) {
          this.cotizacion.set(error.cotizacion);
        }
        this.acepta.set(false);
        this.aviso.set('montoCambio');
        this.fase.set('listo');
        return;
      case 'payment_in_progress':
        this.aviso.set('cobroEnCurso');
        this.fase.set('listo');
        return;
      case 'policy_already_cancelled':
        this.irAlDetalle();
        return;
      case 'renewal_in_progress':
        this.fase.set('renovacion');
        return;
      case 'policy_not_in_force':
        this.fase.set('noVigente');
        return;
      case 'policy_not_found':
        this.fase.set('noEncontrada');
        return;
      default:
        if (confirmando) {
          this.aviso.set('errorConfirmar');
          this.fase.set('listo');
          return;
        }
        this.fase.set('error');
    }
  }

  private irAlDetalle(): void {
    void this.router.navigate(['/originacion/polizas', this.polizaId()]);
  }

  /** «16/09/2026» en el idioma activo. */
  protected fecha(iso: string): string {
    return fechaCorta(iso, this.transloco.getActiveLang());
  }

  /** El último día cubierto por el periodo pagado. */
  protected fin(c: CotizacionCancelacion): string {
    return this.fecha(ultimoDiaDelPeriodo(c.periodoPagado.fin));
  }
}
