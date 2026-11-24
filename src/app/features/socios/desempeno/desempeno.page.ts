import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideOctagonX, LucideTriangleAlert } from '@lucide/angular';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';

import {
  DesempenoApi,
  ErrorDesempeno,
  EstadoApi,
  IncidenteApi,
  PERIODOS_DESEMPENO,
  PERIODO_INICIAL,
  PeriodoDesempeno,
} from '@core/api/socios/desempeno.modelos';
import { SociosApiService } from '@core/api/socios/socios-api.service';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { claveDuracion, fechaHoraColombia, horaColombia, partesDuracion } from './modelos/presentacion-desempeno';

/** Fase de la pantalla: consultando, con el desempeño o con una falla al leerlo. */
export type FaseDesempeno = 'cargando' | 'listo' | 'error';

type Resultado = { tipo: 'desempeno'; desempeno: DesempenoApi } | { tipo: 'error'; error: ErrorDesempeno };

/** Tono de la tarjeta de estado: el texto y el ícono siempre acompañan al color (CA-2). */
const TONO_ESTADO: Readonly<Record<EstadoApi, TonoInsignia>> = {
  operational: 'exito',
  degraded: 'advertencia',
  unavailable: 'error',
  desconocido: 'neutro',
};

/**
 * B3 · Desempeño técnico de la API (HU-W3.2-03): el selector de periodo (hoy, últimos 7 días, últimos 30 días), el estado
 * actual de la API de socios con su tarjeta resaltada cuando está degradada o no disponible (CA-1, CA-2), la
 * disponibilidad frente al objetivo y el p95 frente al presupuesto del periodo (CA-1), y los incidentes del periodo con
 * su fecha, hora de inicio, duración y estado (CA-3), o el aviso de que la integración operó sin interrupciones (CA-4).
 * Todo sale de las alarmas del SLO en CloudWatch, con las mismas definiciones del SLO (CA-5). Un 503 muestra
 * «Reintentar»; 401 y 403 los resuelve el interceptor.
 *
 * El tiempo de respuesta promedio, la gráfica de p95 por hora y «Reportar a Solventa» del prototipo no son de esta
 * historia (la revisión INVEST dejó solo el p95, alineado al SLO).
 *
 * Ruta: `/socios/tablero/desempeno` (solo el socio comercial).
 */
@Component({
  selector: 'app-desempeno-page',
  imports: [
    TranslocoDirective,
    FormatoNumeroPipe,
    InsigniaEstadoComponent,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideOctagonX,
    LucideTriangleAlert,
  ],
  templateUrl: './desempeno.page.html',
  styleUrl: './desempeno.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesempenoPage implements OnInit {
  private readonly api = inject(SociosApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly consultas = new Subject<PeriodoDesempeno>();

  protected readonly periodos = PERIODOS_DESEMPENO;
  protected readonly periodo = signal<PeriodoDesempeno>(PERIODO_INICIAL);
  protected readonly fase = signal<FaseDesempeno>('cargando');
  /** El último desempeño recibido: la pantalla lo conserva mientras consulta otro periodo. */
  protected readonly desempeno = signal<DesempenoApi | null>(null);

  /** Incidente abierto más reciente, para la tarjeta de estado. */
  protected readonly abierto = computed(() => this.desempeno()?.incidentes.find((i) => !i.resuelto) ?? null);
  protected readonly disponibilidadCumple = computed(() => {
    const d = this.desempeno();
    return d ? d.disponibilidad.porcentaje >= d.disponibilidad.objetivo : true;
  });
  protected readonly latenciaCumple = computed(() => {
    const d = this.desempeno();
    return !d || d.latencia.p95Ms === null || d.latencia.p95Ms <= d.latencia.presupuestoMs;
  });

  ngOnInit(): void {
    this.consultas
      .pipe(
        switchMap((periodo) => this.consultar(periodo)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe((resultado) => this.mostrar(resultado));
    this.elegir(PERIODO_INICIAL);
  }

  /** Un botón del selector de periodo. */
  protected elegir(periodo: PeriodoDesempeno): void {
    this.periodo.set(periodo);
    this.fase.set('cargando');
    this.consultas.next(periodo);
  }

  /** «Reintentar» del error. */
  protected reintentar(): void {
    this.elegir(this.periodo());
  }

  protected tono(estado: EstadoApi): TonoInsignia {
    return TONO_ESTADO[estado];
  }

  protected inicio(incidente: IncidenteApi): string {
    return fechaHoraColombia(incidente.inicio, this.transloco.getActiveLang());
  }

  /** «actualizado a las 22:30»: la hora de la medición en Colombia. */
  protected medidoA(desempeno: DesempenoApi): string {
    return horaColombia(desempeno.hasta, this.transloco.getActiveLang());
  }

  /** «14 min», «2 h 5 min», «1 d 2 h». */
  protected duracion(incidente: IncidenteApi): string {
    const partes = partesDuracion(incidente.duracionSegundos);
    return this.transloco.translate(`socios.desempeno.incidentes.duracion.${claveDuracion(partes)}`, partes);
  }

  private consultar(periodo: PeriodoDesempeno): Observable<Resultado> {
    return this.api.consultarDesempeno(periodo).pipe(
      map((desempeno): Resultado => ({ tipo: 'desempeno', desempeno })),
      catchError((error: unknown) =>
        of<Resultado>({
          tipo: 'error',
          error: error instanceof ErrorDesempeno ? error : new ErrorDesempeno('telemetry_unavailable'),
        }),
      ),
    );
  }

  private mostrar(resultado: Resultado): void {
    if (resultado.tipo === 'desempeno') {
      this.desempeno.set(resultado.desempeno);
      this.fase.set('listo');
      return;
    }
    this.fase.set('error');
  }
}
