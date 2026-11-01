import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideInfo, LucideTriangleAlert } from '@lucide/angular';
import { finalize } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CodigoErrorRevision,
  ErrorRevision,
  RegistroDecision,
  SolicitudRevision,
} from '@core/api/originacion/revision.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import {
  ErroresServidorDecision,
  FormularioDecisionComponent,
} from './componentes/formulario-decision/formulario-decision.component';
import { claveMotivo } from './modelos/motivos';
import { AvisoDecisionService } from './servicios/aviso-decision.service';

export type FaseDetalle = 'cargando' | 'listo' | 'noEncontrada' | 'error';

/** Falla al registrar que se muestra junto al formulario: `servicio` admite reintentar el mismo registro. */
type ErrorRegistro = 'servicio' | 'generico';

/**
 * S5 · Detalle del caso y registro de la decisión (HU-W1.1-02). Muestra el número de la solicitud, su estado, el
 * solicitante, la llegada, la oferta implicada y el motivo del enrutamiento; en un caso pendiente, el bloque
 * «Decisión» (aceptar, ajustar la prima o rechazar, CA-2) y el recuadro fijo «Al registrar la decisión». Al registrar
 * (`201`) vuelve a la bandeja con el aviso «Decisión registrada» (S4b). Un caso decidido se ve en solo lectura con el
 * registro completo: tipo, asesor, fecha y hora, observaciones y, si se ajustó, el porcentaje y la oferta nueva (CA-4).
 * Errores: 404 (no existe), 409 (otro asesor se adelantó: recarga y muestra lo decidido), 400 por campo y 503 con
 * reintento. Los datos que el dominio aún no tiene («Contexto del cliente», edad, ingresos…) no se muestran.
 *
 * Ruta: `/originacion/bandeja-decision/:aceptacionId` (solo asesor).
 */
@Component({
  selector: 'app-detalle-solicitud-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormularioDecisionComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideInfo,
    LucideTriangleAlert,
  ],
  templateUrl: './detalle-solicitud.page.html',
  styleUrl: './detalle-solicitud.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleSolicitudPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(OriginacionApiService);
  private readonly avisos = inject(AvisoDecisionService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly aceptacionId = signal('');
  protected readonly fase = signal<FaseDetalle>('cargando');
  protected readonly solicitud = signal<SolicitudRevision | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroresServidor = signal<ErroresServidorDecision>({});
  protected readonly errorRegistro = signal<ErrorRegistro | null>(null);
  /** El registro que falló por falta de servicio, para reintentarlo tal cual. */
  private ultimoRegistro: RegistroDecision | null = null;
  /** 409: otro asesor decidió primero; se muestra lo decidido con este aviso. */
  protected readonly yaDecidida = signal(false);

  protected readonly motivo = computed(() => claveMotivo(this.solicitud()?.motivo ?? ''));

  ngOnInit(): void {
    this.aceptacionId.set(this.ruta.snapshot.paramMap.get('aceptacionId') ?? '');
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api
      .consultarSolicitudRevision(this.aceptacionId())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (solicitud) => {
          this.solicitud.set(solicitud);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          const codigo = codigoDe(error);
          if (codigo === 'review_request_not_found') {
            this.fase.set('noEncontrada');
          } else if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
            // 401 y 403 los resuelve el interceptor.
            this.fase.set('error');
          }
        },
      });
  }

  protected registrar(registro: RegistroDecision): void {
    if (this.enviando()) {
      return;
    }
    this.ultimoRegistro = registro;
    this.enviando.set(true);
    this.errorRegistro.set(null);
    this.erroresServidor.set({});
    this.api
      .registrarDecision(this.aceptacionId(), registro)
      .pipe(
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (decidida) => {
          this.avisos.publicar({
            aceptacionId: decidida.aceptacionId,
            solicitante: decidida.solicitante.nombreCompleto,
            tipo: registro.tipo,
          });
          void this.router.navigate(['/originacion/bandeja-decision']);
        },
        error: (error: unknown) => this.alFallarRegistro(codigoDe(error)),
      });
  }

  /** Reintenta el mismo registro (seguro: el backend nunca registra dos decisiones para un caso). */
  protected reintentarRegistro(): void {
    if (this.ultimoRegistro) {
      this.registrar(this.ultimoRegistro);
    }
  }

  protected limpiarErrorServidor(campo: 'ajustePrimaPct' | 'observaciones'): void {
    if (this.erroresServidor()[campo]) {
      this.erroresServidor.update((errores) => ({ ...errores, [campo]: undefined }));
    }
  }

  private alFallarRegistro(codigo: CodigoErrorRevision): void {
    switch (codigo) {
      case 'observations_required':
        this.erroresServidor.set({ observaciones: true });
        break;
      case 'premium_adjustment_invalid':
        this.erroresServidor.set({ ajustePrimaPct: true });
        break;
      case 'review_request_already_decided':
        this.yaDecidida.set(true);
        this.cargar();
        break;
      case 'review_request_not_found':
        this.fase.set('noEncontrada');
        break;
      case 'decision_not_registered':
      case 'decision_continuation_pending':
      case 'review_unavailable':
        this.errorRegistro.set('servicio');
        break;
      case 'unauthorized':
      case 'forbidden':
        break;
      default:
        this.errorRegistro.set('generico');
    }
  }
}

function codigoDe(error: unknown): CodigoErrorRevision {
  return error instanceof ErrorRevision ? error.codigo : 'invalid_request';
}
