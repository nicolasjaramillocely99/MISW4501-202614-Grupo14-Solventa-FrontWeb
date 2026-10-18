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
import { Cobro, ErrorCobro, MedioDePagoNuevo } from '@core/api/originacion/cobro.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { TramiteAceptacionService } from '../aceptacion-oferta/servicios/tramite-aceptacion.service';
import { TarjetaCreditoComponent } from '../componentes/tarjeta-credito/tarjeta-credito.component';
import { FormularioMedioPagoComponent } from './componentes/formulario-medio-pago/formulario-medio-pago.component';
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
export type VistaCobro =
  /** E4: el cobro espera a que el cliente entregue un medio de pago. */
  | 'capturando'
  | 'procesando'
  /** E4b: la pasarela no responde y el cobro se reintenta solo. */
  | 'pendiente'
  /** E4c: la pasarela rechazó la tarjeta; el cliente puede intentar con otra. */
  | 'rechazado'
  | 'confirmado'
  | 'excepcion';

const TONO_POR_VISTA: Readonly<Record<VistaCobro, TonoInsignia>> = {
  capturando: 'informacion',
  procesando: 'informacion',
  rechazado: 'error',
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
 * interceptor. Con el pago confirmado y la póliza, «Ver mi póliza» abre la póliza emitida (E5, HU-W1.3-03).
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
    FormularioMedioPagoComponent,
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
  private readonly api = inject(OriginacionApiService);
  private readonly manejadorErrores = inject(ErrorHandler);

  protected readonly acciones = inject(ACCIONES_PAGO);
  protected readonly solicitud = this.flujo.solicitud;
  protected readonly cobro = this.seguimiento.cobro;
  protected readonly tonoInsignia = TONO_POR_VISTA;

  protected readonly aceptacionId = signal<string | null>(null);
  protected readonly motivoError = signal<MotivoError | null>(null);
  /** Mientras originación registra el medio de pago que E4 acaba de entregar. */
  protected readonly entregandoMedioDePago = signal(false);
  /** El cobro ya no admite otro medio de pago: alguien pagó o el cobro avanzó. */
  protected readonly medioDePagoRechazado = signal(false);

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

  /**
   * E4 · el cliente confirmó su medio de pago.
   *
   * Lo que llega aquí **ya está tokenizado**: el formulario habló con la
   * pasarela y el número de tarjeta no salió de él. Entregarlo hace vencer el
   * intento del cobro, así que la pantalla pasa enseguida a «procesando» sin
   * esperar al siguiente sondeo.
   */
  protected entregarMedioDePago(medio: MedioDePagoNuevo): void {
    const id = this.aceptacionId();
    if (!id || this.entregandoMedioDePago()) {
      return;
    }
    this.entregandoMedioDePago.set(true);
    this.medioDePagoRechazado.set(false);
    this.api.entregarMedioDePago(id, medio).subscribe({
      next: (cobro) => {
        this.entregandoMedioDePago.set(false);
        this.seguimiento.adelantar(cobro);
      },
      error: (error: unknown) => {
        this.entregandoMedioDePago.set(false);
        if (error instanceof ErrorCobro && error.codigo === 'charge_not_payable') {
          // El cobro avanzó por su cuenta: el seguimiento traerá el estado real.
          this.medioDePagoRechazado.set(true);
          return;
        }
        if (error instanceof ErrorCobro) {
          this.alDetenerse(error);
          return;
        }
        this.manejadorErrores.handleError(error);
        this.motivoError.set('generico');
      },
    });
  }
}

/**
 * Qué pantalla corresponde al cobro.
 *
 * El medio de pago se mira **explícitamente** y no se deduce de `intentos`:
 * esperando la tarjeta (E4) y la pasarela fallando (E4b) son los dos `pending`,
 * y distinguirlas por el contador acopla la pantalla a cuándo el backend
 * decide incrementarlo.
 */
function vistaDe(cobro: Cobro | null): VistaCobro {
  if (!cobro) return 'procesando';
  switch (cobro.estado) {
    case 'failed':
      return cobro.motivoFalla === 'payment_rejected' ? 'rechazado' : 'excepcion';
    case 'confirmed':
      return 'confirmado';
    default:
      if (!cobro.medioDePago) return 'capturando';
      return cobro.intentos > 0 ? 'pendiente' : 'procesando';
  }
}
