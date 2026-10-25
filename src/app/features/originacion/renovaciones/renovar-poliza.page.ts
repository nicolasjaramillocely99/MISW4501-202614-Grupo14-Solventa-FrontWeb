import { NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideTriangleAlert } from '@lucide/angular';
import { Subscription, switchMap, timer } from 'rxjs';

import { ErrorCobro, MedioDePago, MedioDePagoNuevo } from '@core/api/originacion/cobro.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CodigoErrorRenovacion,
  CondicionesRenovacion,
  ErrorRenovacion,
  Renovacion,
} from '@core/api/originacion/renovacion.modelos';
import { FormularioMedioPagoComponent } from '@features/embebido/pago/componentes/formulario-medio-pago/formulario-medio-pago.component';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

export type FaseRenovacion = 'cargando' | 'listo' | 'noEncontrada' | 'error';

/**
 * Qué muestra la pantalla: las **condiciones** antes de aceptar (A4); **fuera de la ventana** (no hay opción de
 * renovar); el pago en curso (`procesando`); esperando el medio de pago (`capturando`); el pago **rechazado** y
 * reintento con otro medio dentro del plazo; la excepción que revisa operaciones; **confirmada** (A4b) y **no
 * renovada**.
 */
export type VistaRenovacion =
  | 'condiciones'
  | 'fueraDeVentana'
  | 'procesando'
  | 'capturando'
  | 'rechazado'
  | 'excepcion'
  | 'confirmada'
  | 'noRenovada';

/** Cada cuánto se consulta la renovación mientras se cobra. */
export const INTERVALO_SEGUIMIENTO_MS = 2000;

/** Errores que resuelve el interceptor (sesión o rol): la pantalla no muestra aviso propio. */
const SIN_AVISO: readonly CodigoErrorRenovacion[] = ['unauthorized', 'forbidden'];

const TONO_POR_VISTA: Readonly<Record<VistaRenovacion, TonoInsignia>> = {
  condiciones: 'advertencia',
  fueraDeVentana: 'neutro',
  procesando: 'informacion',
  capturando: 'advertencia',
  rechazado: 'error',
  excepcion: 'error',
  confirmada: 'exito',
  noRenovada: 'error',
};

/** Meses completos entre dos instantes: el plazo de la renovación. */
function mesesEntre(desde: string, hasta: string): number {
  const a = new Date(desde);
  const b = new Date(hasta);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * A4 · Renovar póliza y A4b · Renovación confirmada (HU-W1.5-02), con sus estados en la misma página.
 *
 * Primero consulta la renovación del periodo: si ya hay una (aceptada, renovada o no renovada) muestra su estado;
 * si no, muestra las condiciones vigentes junto a las recotizadas **antes de aceptar** (criterio 1). Fuera de la
 * ventana de renovación la opción no existe (criterio 3). «Renovar y pagar» acepta y cobra con el medio con el que se
 * pagó la póliza; si el pago se rechaza la solicitud se conserva y el asegurado puede probar con otro medio hasta el
 * plazo, sin crear otra solicitud (criterios 4 y 6). Mientras se cobra, la pantalla sigue la renovación cada 2 s.
 *
 * Ruta: `/originacion/polizas/:id/renovar`. Exige la sesión del asegurado dueño de la póliza.
 */
@Component({
  selector: 'app-renovar-poliza-page',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    TitleCasePipe,
    TranslocoDirective,
    FormularioMedioPagoComponent,
    InsigniaEstadoComponent,
    FormatoFechaPipe,
    FormatoMonedaPipe,
    FormatoNumeroPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideInfo,
    LucideTriangleAlert,
  ],
  templateUrl: './renovar-poliza.page.html',
  styleUrl: './renovar-poliza.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenovarPolizaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly destruccion = inject(DestroyRef);
  private seguimiento: Subscription | null = null;

  protected readonly polizaId = this.ruta.snapshot.params['id'] as string;

  protected readonly fase = signal<FaseRenovacion>('cargando');
  protected readonly condiciones = signal<CondicionesRenovacion | null>(null);
  protected readonly renovacion = signal<Renovacion | null>(null);
  protected readonly fueraDeVentana = signal(false);
  protected readonly trabajando = signal(false);
  /** Clave bajo `originacion.renovacion.errores` del último error general, o `null`. */
  protected readonly error = signal<string | null>(null);
  protected readonly falta = signal(false);

  protected readonly acepto = new FormControl(false, { nonNullable: true });

  protected readonly vista = computed<VistaRenovacion>(() => {
    const r = this.renovacion();
    if (r) {
      if (r.resumen.estado === 'renewed') {
        return 'confirmada';
      }
      if (r.resumen.estado === 'not_renewed') {
        return 'noRenovada';
      }
      const cobro = r.cobro;
      if (cobro?.estado === 'failed') {
        return cobro.motivoFalla === 'payment_rejected' ? 'rechazado' : 'excepcion';
      }
      if (cobro?.estado === 'pending' && cobro.medioDePago === null) {
        return 'capturando';
      }
      return 'procesando';
    }
    return this.fueraDeVentana() ? 'fueraDeVentana' : 'condiciones';
  });

  protected readonly tono = computed(() => TONO_POR_VISTA[this.vista()]);

  /** Clave bajo `originacion.renovacion.estados` del aviso de la vista; «no renovada» cambia con el motivo. */
  protected readonly claveEstado = computed(() => {
    const vista = this.vista();
    if (vista !== 'noRenovada') {
      return vista;
    }
    return this.renovacion()?.resumen.motivo === 'payment_failed' ? 'noRenovadaPago' : 'noRenovadaSinRespuesta';
  });

  /** Descuento aplicado en puntos porcentuales (8), o 0. */
  protected readonly descuentoPorcentaje = computed(() => Math.round((this.condiciones()?.descuento ?? 0) * 100));

  /** Variación de la prima de la renovación contra la vigente, en %. */
  protected readonly variacionPrima = computed(() => {
    const c = this.condiciones();
    return c && c.vigente.prima > 0 ? ((c.renovada.prima - c.vigente.prima) / c.vigente.prima) * 100 : 0;
  });

  /** Las coberturas de la renovación son las mismas que las vigentes (el valor asegurado va en su propia fila). */
  protected readonly coberturasSinCambios = computed(() => {
    const c = this.condiciones();
    return !!c && c.vigente.coberturas.map((x) => x.codigo).join() === c.renovada.coberturas.map((x) => x.codigo).join();
  });

  protected readonly meses = computed(() => {
    const c = this.condiciones();
    return c ? mesesEntre(c.renovada.vigenciaDesde, c.renovada.vigenciaHasta) : 0;
  });

  /** Medio de pago que se muestra: el de las condiciones y, ya aceptada, el del cobro. */
  protected readonly medio = computed<MedioDePago | null>(
    () => this.renovacion()?.cobro?.medioDePago ?? this.condiciones()?.medioDePago ?? null,
  );

  ngOnInit(): void {
    this.destruccion.onDestroy(() => this.seguimiento?.unsubscribe());
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.error.set(null);
    this.api
      .consultarEstadoRenovacion(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (renovacion) => {
          this.renovacion.set(renovacion);
          this.fase.set('listo');
          this.seguir();
        },
        error: (error: unknown) => {
          if (error instanceof ErrorRenovacion && error.codigo === 'renewal_not_found') {
            this.cargarCondiciones();
          } else {
            this.fallarDeCarga(error);
          }
        },
      });
  }

  /** El periodo aún no tiene renovación: se muestran las condiciones, o que no hay opción de renovar. */
  private cargarCondiciones(): void {
    this.api
      .consultarCondicionesRenovacion(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (condiciones) => {
          this.condiciones.set(condiciones);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          if (error instanceof ErrorRenovacion && error.codigo === 'renewal_not_available') {
            this.fueraDeVentana.set(true);
            this.fase.set('listo');
          } else {
            this.fallarDeCarga(error);
          }
        },
      });
  }

  private fallarDeCarga(error: unknown): void {
    this.fase.set(error instanceof ErrorRenovacion && error.codigo === 'policy_not_found' ? 'noEncontrada' : 'error');
  }

  /** «Renovar y pagar»: acepta las condiciones mostradas y arranca el cobro. Pide antes la casilla de consentimiento. */
  protected renovar(): void {
    if (this.trabajando()) {
      return;
    }
    this.falta.set(!this.acepto.value);
    if (!this.acepto.value) {
      return;
    }
    this.error.set(null);
    this.trabajando.set(true);
    this.api
      .renovarPoliza(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ renovacion }) => {
          this.trabajando.set(false);
          this.renovacion.set(renovacion);
          this.seguir();
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  /** Entrega otro medio de pago al cobro de la renovación (E4c): misma solicitud, nueva llave de idempotencia. */
  protected entregarMedio(medio: MedioDePagoNuevo): void {
    const cobroId = this.renovacion()?.resumen.cobroId;
    if (!cobroId || this.trabajando()) {
      return;
    }
    this.error.set(null);
    this.trabajando.set(true);
    this.api
      .entregarMedioDePago(cobroId, medio)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (cobro) => {
          this.trabajando.set(false);
          this.renovacion.update((r) => (r ? { ...r, cobro } : r));
          this.seguir();
        },
        error: (error: unknown) => {
          this.trabajando.set(false);
          if (error instanceof ErrorCobro && (error.codigo === 'unauthorized' || error.codigo === 'forbidden')) {
            return;
          }
          // Venció el plazo o el cobro ya no admite otro medio: se muestra el estado real de la renovación.
          this.error.set(error instanceof ErrorCobro && error.codigo === 'charge_not_payable' ? 'plazoVencido' : 'renewal_unavailable');
          this.refrescar();
        },
      });
  }

  private fallar(error: unknown): void {
    this.trabajando.set(false);
    const codigo = error instanceof ErrorRenovacion ? error.codigo : 'renewal_unavailable';
    if (codigo === 'renewal_not_available') {
      // La ventana cerró mientras el asegurado leía: ya no hay opción de renovar.
      this.condiciones.set(null);
      this.fueraDeVentana.set(true);
      return;
    }
    if (codigo === 'renewal_closed') {
      this.cargar();
      return;
    }
    this.error.set(SIN_AVISO.includes(codigo) ? null : codigo);
  }

  /** Vuelve a leer la renovación sin pasar por la pantalla de carga. */
  private refrescar(): void {
    this.api
      .consultarEstadoRenovacion(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (renovacion) => {
          this.renovacion.set(renovacion);
          this.seguir();
        },
        error: () => undefined,
      });
  }

  /** Mientras la renovación se cobra, la consulta cada `INTERVALO_SEGUIMIENTO_MS` hasta que tiene un resultado. */
  private seguir(): void {
    this.seguimiento?.unsubscribe();
    this.seguimiento = null;
    if (this.vista() !== 'procesando') {
      return;
    }
    this.seguimiento = timer(INTERVALO_SEGUIMIENTO_MS)
      .pipe(switchMap(() => this.api.consultarEstadoRenovacion(this.polizaId)))
      .subscribe({
        next: (renovacion) => {
          this.renovacion.set(renovacion);
          this.seguir();
        },
        // El cobro sigue su curso en el backend: se vuelve a preguntar.
        error: () => this.seguir(),
      });
  }
}
