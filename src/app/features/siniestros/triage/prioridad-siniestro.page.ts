import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideInfo } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { TriageOperaciones } from '@core/api/siniestros/triage.modelos';

import { sondearMientrasPendiente } from '../modelos/sondeo-triage';
import { HistorialTriageComponent } from './componentes/historial-triage/historial-triage.component';
import { PrioridadTriageComponent } from './componentes/prioridad-triage/prioridad-triage.component';

type Fase = 'cargando' | 'listo' | 'noEncontrado' | 'error' | 'detenido';

/**
 * O6 reducida · Prioridad del siniestro (HU-W2.2-01, F2, CA-1 a CA-4): se arma **solo** con
 * `GET /v1/claims/{id}/triage` (vista `operations`), porque `operations` no puede leer `GET /v1/claims/{id}`. Muestra la
 * tarjeta «Prioridad» (nivel, severidad, rango de monto, tipo, cobertura, objetivo, fecha y hora del cálculo) y el
 * historial («Triage N asignado · automático», recálculos con su causa). Sin número de radicado, asegurado, soportes ni
 * las acciones de O6 (aprobar, rechazar, pagar): son de HU-W2.2-03, que incrusta `PrioridadTriageComponent` e
 * `HistorialTriageComponent` en `/siniestros/:id/evaluar` sin tocar esta carpeta.
 *
 * Ruta `/siniestros/cola/:id`, rol operaciones. Con `pending` sondea cada 5 s (S1); a los 3 fallos seguidos o 90 s
 * se detiene y ofrece «Actualizar». Las migas conservan `?casos=` si se llegó desde una búsqueda de la cola.
 */
// Provisional (HU-W2.2-01 F2): HU-W2.2-03 incrusta estos componentes en O6 (/siniestros/:id/evaluar)
@Component({
  selector: 'app-prioridad-siniestro-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    PrioridadTriageComponent,
    HistorialTriageComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideInfo,
  ],
  templateUrl: './prioridad-siniestro.page.html',
  styleUrl: './prioridad-siniestro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrioridadSiniestroPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);
  private lectura: Subscription | null = null;

  protected readonly id = this.ruta.snapshot.paramMap.get('id') ?? '';
  /** Búsqueda de la cola de la que se vino, para que las migas vuelvan a ella. */
  protected readonly parametrosCola = this.ruta.snapshot.queryParamMap.get('casos')
    ? { casos: this.ruta.snapshot.queryParamMap.get('casos') }
    : null;

  protected readonly fase = signal<Fase>('cargando');
  protected readonly triage = signal<TriageOperaciones | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  /** Lee la prioridad y, mientras esté `pending`, la vuelve a pedir cada 5 s. También es «Reintentar» y «Actualizar». */
  protected cargar(): void {
    this.lectura?.unsubscribe();
    this.fase.set('cargando');
    this.lectura = sondearMientrasPendiente(
      () => this.api.consultarTriage(this.id),
      (triage) => triage.estado === 'pending',
    )
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ valor, actualizacion }) => {
          // El rol `operations` recibe la vista completa; la reducida no debería llegar y no sirve a esta pantalla.
          if (valor.vista !== 'operations') {
            this.fase.set('error');
            return;
          }
          this.triage.set(valor);
          this.fase.set(actualizacion === 'detenido' ? 'detenido' : 'listo');
        },
        error: (error: unknown) =>
          this.fase.set(error instanceof ErrorSiniestro && error.codigo === 'claim_not_found' ? 'noEncontrado' : 'error'),
      });
  }
}
