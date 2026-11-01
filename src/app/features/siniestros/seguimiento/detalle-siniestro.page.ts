import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideInfo } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { DetalleSiniestro, ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { TriageAsegurado } from '@core/api/siniestros/triage.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../modelos/catalogo-siniestros';
import { montoEnPesos } from '../modelos/presentacion-triage';
import { sondearMientrasPendiente } from '../modelos/sondeo-triage';
import { PrioridadAseguradoComponent } from './componentes/prioridad-asegurado/prioridad-asegurado.component';

type Fase = 'cargando' | 'listo' | 'noEncontrado' | 'error';
/** Estado del bloque de prioridad, independiente del caso: si falla, el caso se sigue mostrando. */
type EstadoPrioridad = 'cargando' | 'listo' | 'error' | 'detenido';

/**
 * A8 mínima · Detalle del siniestro del asegurado (HU-W2.2-01, F3, CA-4): encabezado del caso
 * (`GET /v1/claims/{id}`), datos reportados con el monto estimado y la etapa «En evaluación» con «Prioridad Triage N ·
 * Tiempo estimado de resolución: N días hábiles» (`GET /v1/claims/{id}/triage`, vista `insured`), con sondeo mientras
 * esté `pending` (S1). Las dos lecturas van en paralelo; si falla solo la de la prioridad, el caso se muestra y el
 * bloque dice «No pudimos consultar la prioridad» con «Reintentar». HU-W2.1-02 completa A8 (todas las etapas, acciones
 * y devoluciones).
 *
 * Ruta `/siniestros/:id`, rol asegurado. Un caso ajeno (`403`) lo lleva el interceptor a «acceso no autorizado».
 */
// Provisional (HU-W2.2-01 F3): HU-W2.1-02 completa A8 (etapas, acciones y devoluciones)
@Component({
  selector: 'app-detalle-siniestro-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    IndicadorPasosComponent,
    InsigniaEstadoComponent,
    PrioridadAseguradoComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideInfo,
  ],
  templateUrl: './detalle-siniestro.page.html',
  styleUrl: './detalle-siniestro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleSiniestroPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);
  private lecturaPrioridad: Subscription | null = null;

  private readonly id = this.ruta.snapshot.paramMap.get('id') ?? '';

  protected readonly fase = signal<Fase>('cargando');
  protected readonly caso = signal<DetalleSiniestro | null>(null);
  protected readonly triage = signal<TriageAsegurado | null>(null);
  protected readonly estadoPrioridad = signal<EstadoPrioridad>('cargando');

  protected readonly montoPesos = computed(() => {
    const minor = this.caso()?.montoEstimadoMinor;
    return minor === null || minor === undefined ? null : montoEnPesos(minor);
  });

  /** Sin prioridad (`not_applicable`) el caso sigue en «Radicado»; con ella, está «En evaluación». */
  protected readonly etapas = computed<readonly PasoFlujo[]>(() => {
    const enEvaluacion = this.triage() !== null && this.triage()?.estado !== 'not_applicable';
    return [
      { etiqueta: 'siniestros.confirmacion.etapas.radicado', estado: enEvaluacion ? 'completado' : 'actual' },
      { etiqueta: 'siniestros.confirmacion.etapas.evaluacion', estado: enEvaluacion ? 'actual' : 'pendiente' },
      { etiqueta: 'siniestros.confirmacion.etapas.aprobado', estado: 'pendiente' },
      { etiqueta: 'siniestros.confirmacion.etapas.pagado', estado: 'pendiente' },
    ];
  });

  ngOnInit(): void {
    this.cargarCaso();
    this.cargarPrioridad();
  }

  protected cargarCaso(): void {
    this.fase.set('cargando');
    this.api
      .consultarSiniestro(this.id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (caso) => {
          this.caso.set(caso);
          this.fase.set('listo');
        },
        error: (error: unknown) =>
          this.fase.set(error instanceof ErrorSiniestro && error.codigo === 'claim_not_found' ? 'noEncontrado' : 'error'),
      });
  }

  /** Lee la prioridad y, mientras esté `pending`, la vuelve a pedir cada 5 s. También es «Reintentar» y «Actualizar». */
  protected cargarPrioridad(): void {
    this.lecturaPrioridad?.unsubscribe();
    this.estadoPrioridad.set('cargando');
    this.lecturaPrioridad = sondearMientrasPendiente(
      () => this.api.consultarTriage(this.id),
      (triage) => triage.estado === 'pending',
    )
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ valor, actualizacion }) => {
          // El asegurado recibe la vista reducida; la completa (severidad, monto, historial) no debe llegar aquí.
          if (valor.vista !== 'insured') {
            this.estadoPrioridad.set('error');
            return;
          }
          this.triage.set(valor);
          this.estadoPrioridad.set(actualizacion === 'detenido' ? 'detenido' : 'listo');
        },
        error: () => this.estadoPrioridad.set('error'),
      });
  }

  /** «Autos · AU-2025-118204 · KJT-482», o solo el número de la póliza si el caso no guardó su ramo. */
  protected poliza(t: Traductor, caso: DetalleSiniestro): string {
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    return [ramo, caso.poliza.id, caso.poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }

  protected tipo(t: Traductor, caso: DetalleSiniestro): string {
    return nombreTipo(t, caso.tipoSiniestro);
  }
}
