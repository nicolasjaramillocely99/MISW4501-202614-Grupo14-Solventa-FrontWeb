import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideCircleCheck, LucideCircleX, LucideInfo } from '@lucide/angular';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { ErrorSolicitudModificacion, SolicitudModificacion } from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { IndicadorPasosComponent } from '@shared/ui/indicador-pasos/indicador-pasos.component';

import { EstadoSolicitudComponent, pasosDeSolicitud } from './componentes/estado-solicitud/estado-solicitud.component';

/** Fase de A3b: consultando, con la solicitud, inexistente, falla del servicio u oculta (401/403 del interceptor). */
export type FaseSolicitud = 'cargando' | 'listo' | 'noEncontrada' | 'error' | 'oculta';

/**
 * A3b · Solicitud radicada (HU-W1.4-01, frame `20:866`, también en revisión, aplicada y rechazada con motivo): el
 * identificador, el estado con sus pasos (Radicada → En revisión → Aplicada o Rechazada), el tipo, quién la radicó y por
 * qué canal (CA-2). Al venir de radicar muestra «Tu solicitud quedó radicada»; al recargar, el estado tal como está. Una
 * `not_applied` sin motivo se ve en revisión y con motivo, rechazada con el motivo (ajuste A-1). Es una ruta propia
 * (decisión D-12) para que «Ver detalle» de A11 pueda abrir cualquier solicitud. 401 y 403 los resuelve el interceptor.
 *
 * Ruta: `/originacion/solicitudes/:id` (solo el asegurado).
 */
@Component({
  selector: 'app-solicitud-modificacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    IndicadorPasosComponent,
    EstadoSolicitudComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleX,
    LucideInfo,
  ],
  templateUrl: './solicitud-modificacion.page.html',
  styleUrl: './solicitud-modificacion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudModificacionPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);

  protected readonly solicitudId = String(this.ruta.snapshot.params['id'] ?? '');
  /** Se llegó aquí al radicar (A3): se muestra la confirmación. */
  protected readonly recienRadicada = inject(Router).currentNavigation()?.extras.state?.['recienRadicada'] === true;
  protected readonly fase = signal<FaseSolicitud>('cargando');
  protected readonly solicitud = signal<SolicitudModificacion | null>(null);
  protected readonly pasos = computed(() => pasosDeSolicitud(this.solicitud()?.estado ?? 'radicada'));
  /** Una solicitud que todavía no tiene decisión. */
  protected readonly abierta = computed(() => {
    const estado = this.solicitud()?.estado;
    return estado === 'radicada' || estado === 'enRevision';
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api
      .consultarSolicitudModificacion(this.solicitudId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (solicitud) => {
          this.solicitud.set(solicitud);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorSolicitudModificacion ? error.codigo : 'change_request_unavailable';
          if (codigo === 'unauthorized' || codigo === 'forbidden') {
            this.fase.set('oculta');
          } else {
            this.fase.set(codigo === 'change_request_not_found' ? 'noEncontrada' : 'error');
          }
        },
      });
  }

  /** La clave del título y el texto de la tarjeta: la confirmación al venir de radicar o la del estado. */
  protected tarjeta(solicitud: SolicitudModificacion): string {
    return this.recienRadicada && solicitud.estado === 'radicada' ? 'confirmacion' : solicitud.estado;
  }
}
