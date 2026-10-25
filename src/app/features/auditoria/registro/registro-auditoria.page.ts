import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideLock } from '@lucide/angular';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { ErrorDecision, RegistroDecision, ResultadoDecision } from '@core/api/auditoria/decision.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { RegistroConsultadoService } from './servicios/registro-consultado.service';

export type FaseRegistro = 'cargando' | 'listo' | 'noEncontrado' | 'error';

/** Tono de la insignia de cada decisión; el texto siempre acompaña al color. */
const TONO_DECISION: Readonly<Record<ResultadoDecision, TonoInsignia>> = {
  accepted: 'exito',
  rejected: 'error',
  deferred: 'advertencia',
};

/**
 * O13 · Registro de auditoría de la suscripción (HU-W4.1-01). Reconstruye cómo se decidió una oferta: la fecha y hora de
 * la solicitud con su zona horaria, la versión del motor de rating, las fuentes consultadas (cuándo, con qué latencia y el
 * valor que devolvió cada una), el perfil resultante, las reglas de rating en su orden de ejecución con la salida de cada
 * una, la prima y la decisión (aceptada, rechazada o diferida con su motivo). Es de solo lectura (CA-4): no hay ningún
 * campo editable. Quedan fuera lo que la historia no pide: exportar (HU-W4.1-02), las consultas recientes y la integridad.
 *
 * Ruta: `/auditoria/registro/:id` (solo operaciones).
 */
@Component({
  selector: 'app-registro-auditoria-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    FormatoNumeroPipe,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideLock,
  ],
  templateUrl: './registro-auditoria.page.html',
  styleUrl: './registro-auditoria.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroAuditoriaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(AuditoriaApiService);
  private readonly consultado = inject(RegistroConsultadoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly id = signal('');
  protected readonly fase = signal<FaseRegistro>('cargando');
  protected readonly registro = signal<RegistroDecision | null>(null);
  /** Zona horaria del navegador y su desfase con UTC en el instante de la solicitud: «America/Bogota, UTC-05:00». */
  protected readonly zona = computed(() => {
    const fecha = new Date(this.registro()?.solicitadaEn ?? Date.now());
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const desfase = new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'longOffset' })
      .formatToParts(fecha)
      .find((parte) => parte.type === 'timeZoneName')?.value;
    return `${zona}, ${(desfase ?? 'GMT').replace('GMT', 'UTC')}`;
  });

  protected tonoDe(decision: ResultadoDecision): TonoInsignia {
    return TONO_DECISION[decision];
  }

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    const guardado = this.consultado.de(this.id());
    if (guardado) {
      this.registro.set(guardado);
      this.fase.set('listo');
      return;
    }
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api
      .consultarRegistroDecision(this.id())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (registro) => {
          this.registro.set(registro);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorDecision ? error.codigo : 'service_unavailable';
          if (codigo === 'decision_not_found') {
            this.fase.set('noEncontrado');
          } else if (codigo === 'service_unavailable') {
            // 401 y 403 los resuelve el interceptor.
            this.fase.set('error');
          }
        },
      });
  }
}
