import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowRight,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock,
  LucideInfo,
  LucideLandmark,
  LucideTriangleAlert,
} from '@lucide/angular';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';
import { Cobro, ErrorCobro } from '@core/api/originacion/cobro.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { TramiteAceptacionService } from '../aceptacion-oferta/servicios/tramite-aceptacion.service';
import { TarjetaCreditoComponent } from '../componentes/tarjeta-credito/tarjeta-credito.component';
import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';
import { ACCIONES_PAGO } from './pago.config';
import { SeguimientoCobroService } from './servicios/seguimiento-cobro.service';

/** Errores de página completa. */
type MotivoError = 'sinAceptacion' | 'sinCobro' | 'generico';

/**
 * Vista del cobro: `procesando` (primer intento en curso, sin fallas), `pendiente` (E4b: la pasarela no
 * respondió y se reintenta con la misma clave), `confirmado` (pago confirmado; con la póliza, cobertura activa) y
 * `excepcion` (ventana vencida o pago rechazado: lo gestiona operaciones).
 */
export type VistaCobro = 'procesando' | 'pendiente' | 'confirmado' | 'excepcion';

const TONO_POR_VISTA: Readonly<Record<VistaCobro, TonoInsignia>> = {
  procesando: 'informacion',
  pendiente: 'advertencia',
  confirmado: 'exito',
  excepcion: 'error',
};

/**
 * Paso 4 · Pago de la prima: estado del cobro (E4b «Tu pago está pendiente», HA-D02). Tras aprobarse la
 * suscripción, originación cobra la prima en segundo plano con una clave de idempotencia y reintenta con
 * esperas crecientes durante 24 horas si la pasarela no responde; esta página lo sigue con
 * `GET /v1/acceptances/{id}/charge` y muestra que la aceptación quedó guardada. Todos los estados viven aquí; los
 * textos salen del estado y del código `error` del contrato, nunca de `message`. 401 y 403 los resuelve el
 * interceptor.
 *
 * Ruta: `/embebido/pago/:aceptacionId` (o `/embebido/pago`, que toma la aceptación guardada en la sesión del
 * navegador). Exige la sesión del asegurado dueño de la aceptación.
 */
@Component({
  selector: 'app-pago-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    IndicadorPasosComponent,
    InsigniaEstadoComponent,
    TarjetaCreditoComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowRight,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideClock,
    LucideInfo,
    LucideLandmark,
    LucideTriangleAlert,
  ],
  providers: [SeguimientoCobroService],
  templateUrl: './pago.page.html',
  styleUrl: './pago.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagoPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly seguimiento = inject(SeguimientoCobroService);
  private readonly tramite = inject(TramiteAceptacionService);
  private readonly flujo = inject(FlujoEmbebidoService);
  private readonly aliado = inject(ContextoAliadoService);
  private readonly manejadorErrores = inject(ErrorHandler);

  protected readonly acciones = inject(ACCIONES_PAGO);
  protected readonly solicitud = this.flujo.solicitud;
  protected readonly cobro = this.seguimiento.cobro;
  protected readonly tonoInsignia = TONO_POR_VISTA;

  protected readonly aceptacionId = signal<string | null>(null);
  protected readonly motivoError = signal<MotivoError | null>(null);

  protected readonly fase = computed(() => {
    if (this.motivoError()) {
      return 'error';
    }
    return this.cobro() ? 'cobro' : 'cargando';
  });

  protected readonly vista = computed<VistaCobro>(() => vistaDe(this.cobro()));

  protected readonly pasos = computed<readonly PasoFlujo[]>(() => {
    const confirmado = this.vista() === 'confirmado' && this.fase() === 'cobro';
    return [
      { etiqueta: 'embebido.pasos.consentimiento', estado: 'completado' },
      { etiqueta: 'embebido.pasos.perfilRiesgo', estado: 'completado' },
      { etiqueta: 'embebido.pasos.oferta', estado: 'completado' },
      { etiqueta: 'embebido.pasos.pago', estado: confirmado ? 'completado' : 'actual' },
      { etiqueta: 'embebido.pasos.poliza', estado: confirmado ? 'actual' : 'pendiente' },
    ];
  });

  constructor() {
    effect(() => {
      const error = this.seguimiento.error();
      if (error) {
        untracked(() => this.alDetenerse(error));
      }
    });
  }

  ngOnInit(): void {
    this.aliado.establecer(this.solicitud()?.aliado ?? null);
    const aceptacionId = this.ruta.snapshot.paramMap.get('aceptacionId') ?? this.tramite.leer()?.aceptacionId ?? null;
    this.aceptacionId.set(aceptacionId);
    if (aceptacionId) {
      this.seguimiento.seguir(aceptacionId);
    } else {
      this.motivoError.set('sinAceptacion');
    }
  }

  /** «Reintentar» tras un error inesperado: vuelve a consultar el cobro. */
  protected reintentar(): void {
    const aceptacionId = this.aceptacionId();
    if (!aceptacionId) {
      return;
    }
    this.motivoError.set(null);
    this.seguimiento.seguir(aceptacionId);
  }

  private alDetenerse(error: ErrorCobro): void {
    switch (error.codigo) {
      case 'charge_not_found':
        this.motivoError.set('sinCobro');
        break;
      case 'unauthorized':
      case 'forbidden':
        // El interceptor ya llevó a «sesión expirada» o «acceso no autorizado».
        break;
      default:
        this.manejadorErrores.handleError(error);
        this.motivoError.set('generico');
    }
  }
}

function vistaDe(cobro: Cobro | null): VistaCobro {
  switch (cobro?.estado) {
    case 'failed':
      return 'excepcion';
    case 'confirmed':
      return 'confirmado';
    default:
      return (cobro?.intentos ?? 0) > 0 ? 'pendiente' : 'procesando';
  }
}
