import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideMail } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';

import { CodigoErrorEvaluacion, Decision, DestinoPago, ErrorEvaluacion, Evaluacion } from '@core/api/siniestros/evaluacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreSoporte, nombreTipo } from '../modelos/catalogo-siniestros';
import { tonoEstado, tonoPrioridad } from '../modelos/estado-siniestro';
import { HistorialTriageComponent } from '../triage/componentes/historial-triage/historial-triage.component';
import { PrioridadTriageComponent } from '../triage/componentes/prioridad-triage/prioridad-triage.component';
import { DecisionSiniestroComponent, ErroresServidorDecision } from './componentes/decision-siniestro/decision-siniestro.component';
import { PagoIndemnizacionComponent } from './componentes/pago-indemnizacion/pago-indemnizacion.component';

export type FaseEvaluacion = 'cargando' | 'listo' | 'noEncontrado' | 'error';

/** Cada cuánto se vuelve a leer el caso mientras el pago está en curso, y cuántas veces como máximo. */
export const INTERVALO_SEGUIMIENTO_MS = 2000;
export const MAXIMO_SEGUIMIENTOS = 15;

/** Evento del historial del caso (columna lateral de O6). */
interface EventoHistorial {
  clave: string;
  fecha: string;
  parametros?: Record<string, unknown>;
}

/**
 * O6 · Evaluación, aprobación y pago del siniestro y O6b · Pago de la indemnización fallido (HU-W2.2-03).
 *
 * - **CA-1:** el caso (hechos, monto estimado, prioridad, cobertura aplicable), los soportes y la evidencia con su
 *   lectura firmada, la póliza vigente y el asegurado con su medio de pago **enmascarado**. La prioridad y su historial
 *   los pintan los componentes del triage de HU-W2.2-01 con el triage que trae la evaluación.
 * - **CA-2 y CA-3:** el bloque «Decisión»: aprobar el costo bruto (con el desglose del deducible y el monto aprobado
 *   neto) o rechazar con motivo. Si el núcleo de pólizas no respondió, el caso se ve pero no se puede decidir.
 * - **CA-4:** al aprobar, la página sigue el pago hasta que queda «Pagado» o en «Excepción de pago»; en la excepción
 *   (O6b) muestra el motivo de la pasarela, los intentos agotados y deja corregir la cuenta y reintentar.
 * - **CA-5:** la decisión queda con su analista, fecha y monto o motivo, también en el historial.
 *
 * El bloque «Resultado de la intervención del prestador» del prototipo depende de HU-W2.3-02 y aún no se muestra.
 * Ruta: `/siniestros/:id/evaluar` (solo operaciones).
 */
@Component({
  selector: 'app-evaluacion-siniestro-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    DecisionSiniestroComponent,
    PagoIndemnizacionComponent,
    PrioridadTriageComponent,
    HistorialTriageComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideInfo,
    LucideMail,
  ],
  templateUrl: './evaluacion-siniestro.page.html',
  styleUrl: './evaluacion-siniestro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvaluacionSiniestroPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(SiniestrosApiService);
  private readonly destruccion = inject(DestroyRef);
  private seguimiento: ReturnType<typeof setTimeout> | null = null;
  private seguimientos = 0;

  protected readonly id = signal('');
  protected readonly fase = signal<FaseEvaluacion>('cargando');
  protected readonly evaluacion = signal<Evaluacion | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroresServidor = signal<ErroresServidorDecision>({});
  /** Falla al decidir o reintentar que no es de un campo. */
  protected readonly errorAccion = signal<CodigoErrorEvaluacion | null>(null);

  protected readonly tonoEstado = tonoEstado;
  protected readonly tonoPrioridad = tonoPrioridad;

  protected readonly decision = computed(() => this.evaluacion()?.decision ?? null);
  /** Un caso en evaluación se decide aquí; uno decidido se ve en solo lectura. */
  protected readonly decidible = computed(() => {
    const estado = this.evaluacion()?.siniestro.estado;
    return !this.decision() && (estado === 'active' || estado === 'in_evaluation');
  });
  protected readonly sinTerminos = computed(() => {
    const e = this.evaluacion();
    return !!e && (e.polizaNoDisponible || !e.cobertura);
  });

  protected readonly historial = computed<EventoHistorial[]>(() => {
    const e = this.evaluacion();
    if (!e) {
      return [];
    }
    // Los cálculos del triage tienen su propio historial (HistorialTriageComponent, HU-W2.2-01); aquí van los del caso.
    const eventos: EventoHistorial[] = [{ clave: 'radicado', fecha: e.siniestro.radicadoEn }];
    const d = e.decision;
    if (d) {
      eventos.push({ clave: d.resultado === 'approved' ? 'aprobado' : 'rechazado', fecha: d.decididaEn, parametros: { por: d.decididaPor } });
      if (d.rechazo?.notificadoEn) {
        eventos.push({ clave: 'notificado', fecha: d.rechazo.notificadoEn });
      }
      if (d.pago?.estado === 'failed' && d.pago.ultimaFallaEn) {
        eventos.push({ clave: 'excepcion', fecha: d.pago.ultimaFallaEn });
      }
      if (d.pago?.ultimoReintentoEn) {
        eventos.push({ clave: 'reintento', fecha: d.pago.ultimoReintentoEn, parametros: { por: d.pago.ultimoReintentoPor } });
      }
      if (d.pago?.pagadoEn) {
        eventos.push({ clave: 'pagado', fecha: d.pago.pagadoEn });
      }
    }
    return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  constructor() {
    this.destruccion.onDestroy(() => this.detenerSeguimiento());
  }

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.cargar();
  }

  protected cargar(): void {
    this.detenerSeguimiento();
    this.seguimientos = 0;
    this.fase.set(this.evaluacion() ? this.fase() : 'cargando');
    this.leer();
  }

  protected aprobar(bruto: number): void {
    this.accion(this.api.aprobar(this.id(), bruto));
  }

  protected rechazar(motivo: string): void {
    this.accion(this.api.rechazar(this.id(), motivo));
  }

  protected reintentar(destino: DestinoPago | undefined): void {
    this.accion(this.api.reintentarPago(this.id(), destino));
  }

  protected limpiarErrorServidor(campo: 'bruto' | 'motivo'): void {
    if (this.erroresServidor()[campo]) {
      this.erroresServidor.update((errores) => ({ ...errores, [campo]: undefined }));
    }
  }

  protected resumen(t: Traductor, e: Evaluacion): string {
    const s = e.siniestro;
    const partes = [
      nombreRamo(t, s.poliza.ramo, s.poliza.producto),
      s.poliza.id,
      nombreTipo(t, s.tipoSiniestro, undefined, 'corto'),
      e.asegurado?.nombreCompleto ?? '',
    ];
    return partes.filter((p) => p !== '').join(' · ');
  }

  protected tipo(t: Traductor, codigo: string): string {
    return nombreTipo(t, codigo, undefined, 'corto');
  }

  protected soporte(t: Traductor, codigo: string, nombreArchivo: string): string {
    return nombreSoporte(t, codigo, nombreArchivo);
  }

  /** Motivo de la excepción de pago para el aviso de O6b. */
  protected claveFalla(d: Decision): string {
    const p = d.pago;
    if (p?.falla === 'retries_exhausted') {
      return 'sinRespuesta';
    }
    return p?.codigoPasarela === 'invalid_destination_account' ? 'cuentaInvalida' : 'rechazado';
  }

  private accion(peticion: Observable<Decision>): void {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.errorAccion.set(null);
    this.erroresServidor.set({});
    peticion
      .pipe(
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: () => this.cargar(),
        error: (error: unknown) => this.alFallarAccion(codigoDe(error)),
      });
  }

  private alFallarAccion(codigo: CodigoErrorEvaluacion): void {
    switch (codigo) {
      case 'amount_exceeds_insured_value':
      case 'amount_out_of_range':
      case 'nothing_to_pay':
        this.erroresServidor.set({ bruto: codigo });
        break;
      case 'reason_required':
      case 'reason_too_long':
        this.erroresServidor.set({ motivo: codigo });
        break;
      case 'claim_not_decidable':
      case 'payout_not_retryable':
        // Otro analista se adelantó: se muestra lo que hay ahora con el aviso.
        this.errorAccion.set(codigo);
        this.cargar();
        break;
      case 'unauthorized':
      case 'forbidden':
        break;
      default:
        this.errorAccion.set(codigo);
    }
  }

  private leer(): void {
    this.api
      .consultarEvaluacion(this.id())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (evaluacion) => {
          this.evaluacion.set(evaluacion);
          this.fase.set('listo');
          this.seguirPagoEnCurso(evaluacion);
        },
        error: (error: unknown) => {
          const codigo = codigoDe(error);
          if (codigo === 'claim_not_found') {
            this.fase.set('noEncontrado');
          } else if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
            this.fase.set(this.evaluacion() ? 'listo' : 'error');
          }
        },
      });
  }

  /** Mientras el pago está pendiente o en curso, vuelve a leer el caso hasta que quede pagado o en excepción. */
  private seguirPagoEnCurso(evaluacion: Evaluacion): void {
    const estado = evaluacion.decision?.pago?.estado;
    if ((estado === 'pending' || estado === 'in_progress') && this.seguimientos < MAXIMO_SEGUIMIENTOS) {
      this.seguimientos++;
      this.seguimiento = setTimeout(() => this.leer(), INTERVALO_SEGUIMIENTO_MS);
    }
  }

  private detenerSeguimiento(): void {
    if (this.seguimiento !== null) {
      clearTimeout(this.seguimiento);
      this.seguimiento = null;
    }
  }
}

function codigoDe(error: unknown): CodigoErrorEvaluacion {
  return error instanceof ErrorEvaluacion ? error.codigo : 'claims_unavailable';
}
