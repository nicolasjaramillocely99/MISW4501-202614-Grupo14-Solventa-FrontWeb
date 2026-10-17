import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowRight,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideCircleX,
  LucideClock,
  LucideInfo,
  LucideLandmark,
  LucideRefreshCw,
  LucideSlidersHorizontal,
  LucideTriangleAlert,
} from '@lucide/angular';
import { finalize } from 'rxjs';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';
import {
  Aceptacion,
  CodigoErrorAceptacion,
  ErrorAceptacion,
  MotivoRevision,
} from '@core/api/originacion/aceptacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { TarjetaCreditoComponent } from '../componentes/tarjeta-credito/tarjeta-credito.component';
import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';
import { ACCIONES_ACEPTACION_OFERTA, DETALLE_OFERTA } from './aceptacion-oferta.config';
import { DetalleOfertaComponent } from './componentes/detalle-oferta/detalle-oferta.component';
import {
  INTERVALO_CONSULTA_MS,
  PRIMERA_CONSULTA_MS,
  SeguimientoAceptacionService,
} from './servicios/seguimiento-aceptacion.service';
import { TramiteAceptacionService } from './servicios/tramite-aceptacion.service';

/**
 * `cargando` retomando el trámite; `oferta` sin aceptación (con «Aceptar»); `seguimiento` con la aceptación
 * registrada; `vencida` tras `422 offer_expired`; `error` cuando no hay nada que mostrar.
 */
type Fase = 'cargando' | 'oferta' | 'seguimiento' | 'vencida' | 'error';

/** Estados de error de página completa. El fallo al registrar la aceptación se muestra junto a la oferta. */
type MotivoError = 'sinOferta' | 'ofertaNoExiste' | 'noDisponible' | 'generico';

/**
 * Vista de la aceptación registrada (contrato §4): `validando` (registered, sin fallas), `conservada`
 * (registered con intentos fallidos o más de 2 minutos), `revision` (in_review), `emision` (issuance_pending) y,
 * tras la decisión del asesor (HU-W1.1-02), `ajustada` (adjusted, E6b) y `rechazada` (rejected, E6c).
 */
export type VistaSeguimiento = 'validando' | 'conservada' | 'revision' | 'emision' | 'ajustada' | 'rechazada';

const TONO_POR_VISTA: Readonly<Record<VistaSeguimiento, TonoInsignia>> = {
  validando: 'informacion',
  conservada: 'advertencia',
  revision: 'informacion',
  emision: 'exito',
  ajustada: 'advertencia',
  rechazada: 'error',
};

const CLAVE_MOTIVO_REVISION: Readonly<Record<MotivoRevision, string>> = {
  provisional_offer: 'ofertaProvisional',
  high_risk_score: 'perfilAdicional',
};

/**
 * Paso 3 · Aceptación de la oferta y disparo de la emisión (E3, E6, E7 y aceptación conservada; HU-W1.3-01).
 * Retoma el trámite con `GET /v1/offers/{id}/acceptance`; si la oferta no tiene aceptación muestra la oferta
 * con «Aceptar» (`POST /v1/offers/{id}/acceptance`) y luego sigue su estado con polling hasta
 * `issuance_pending` o `in_review`. Todos los estados viven en esta página; los textos salen del código
 * estable `error` del contrato, nunca de `message`. 401 y 403 los resuelve el interceptor.
 *
 * HU-W1.1-02: cuando el asesor decide, el cliente lo ve al volver a consultar: E6b «Solicitud ajustada» (nueva
 * prima, vigencia y «Ver la nueva oferta», que abre la oferta ajustada en esta misma página) y E6c «Solicitud
 * rechazada». Por eso la página sigue los cambios del parámetro de la ruta: Angular la reutiliza al pasar de
 * `/embebido/oferta/A` a `/embebido/oferta/B`.
 *
 * Ruta: `/embebido/oferta/:ofertaId` (o `/embebido/oferta`, que retoma la oferta guardada en la sesión del
 * navegador). Exige la sesión de un asegurado dueño de la oferta.
 */
@Component({
  selector: 'app-aceptacion-oferta-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    IndicadorPasosComponent,
    InsigniaEstadoComponent,
    TarjetaCreditoComponent,
    DetalleOfertaComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowRight,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleX,
    LucideClock,
    LucideInfo,
    LucideLandmark,
    LucideRefreshCw,
    LucideSlidersHorizontal,
    LucideTriangleAlert,
  ],
  providers: [SeguimientoAceptacionService],
  templateUrl: './aceptacion-oferta.page.html',
  styleUrl: './aceptacion-oferta.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AceptacionOfertaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly seguimiento = inject(SeguimientoAceptacionService);
  private readonly tramite = inject(TramiteAceptacionService);
  private readonly flujo = inject(FlujoEmbebidoService);
  private readonly aliado = inject(ContextoAliadoService);
  private readonly manejadorErrores = inject(ErrorHandler);
  private readonly destruccion = inject(DestroyRef);
  private readonly casillaTerminos = viewChild<ElementRef<HTMLInputElement>>('casillaTerminos');

  protected readonly acciones = inject(ACCIONES_ACEPTACION_OFERTA);
  protected readonly detalle = inject(DETALLE_OFERTA);
  protected readonly solicitud = this.flujo.solicitud;
  protected readonly perfil = this.flujo.perfil;
  protected readonly aceptacion = this.seguimiento.aceptacion;

  protected readonly ofertaId = signal<string | null>(null);
  protected readonly fase = signal<Fase>('cargando');
  protected readonly motivoError = signal<MotivoError>('generico');
  /** `POST` en curso: «Aceptar» queda deshabilitado. */
  protected readonly enviando = signal(false);
  /** `acceptance_not_registered`: se ofrece reenviar el mismo `POST`, que es seguro. */
  protected readonly errorRegistro = signal(false);
  protected readonly terminosAceptados = signal(false);
  protected readonly errorTerminos = signal(false);
  /** Fin de la vigencia que informa `offer_expired`. */
  protected readonly venceEn = signal<string | null>(null);

  protected readonly vista = computed<VistaSeguimiento>(() => {
    const aceptacion = this.aceptacion();
    switch (aceptacion?.estado) {
      case 'issuance_pending':
        return 'emision';
      case 'in_review':
        return 'revision';
      case 'adjusted':
        return 'ajustada';
      case 'rejected':
        return 'rechazada';
      default:
        return (aceptacion?.procesamiento.intentos ?? 0) > 0 || this.seguimiento.lento()
          ? 'conservada'
          : 'validando';
    }
  });

  protected readonly tonoInsignia = TONO_POR_VISTA;

  /** Fecha del texto principal: la de la decisión del asesor en E6b/E6c; si no, la de la aceptación. */
  protected readonly fechaTexto = computed(() => {
    const aceptacion = this.aceptacion();
    const vista = this.vista();
    return (vista === 'ajustada' || vista === 'rechazada') && aceptacion?.revision
      ? aceptacion.revision.decididaEn
      : (aceptacion?.aceptadaEn ?? null);
  });

  /**
   * Clave del motivo de la revisión (`underwriting.reason`); solo varía el texto, contrato §4. Un motivo
   * que el cliente no conoce (p. ej. uno nuevo del motor de suscripción) muestra el texto genérico, nunca
   * la clave sin traducir.
   */
  protected readonly motivoRevision = computed(() => {
    const motivo = this.aceptacion()?.suscripcion?.motivo;
    return motivo ? (CLAVE_MOTIVO_REVISION[motivo] ?? 'generico') : 'generico';
  });

  protected readonly pasos = computed<readonly PasoFlujo[]>(() => {
    // Con la oferta ajustada (E6b) el cliente vuelve al paso de la oferta: debe aceptar la nueva.
    const aceptada = this.fase() === 'seguimiento' && this.vista() !== 'ajustada';
    return [
      { etiqueta: 'embebido.pasos.consentimiento', estado: 'completado' },
      { etiqueta: 'embebido.pasos.perfilRiesgo', estado: 'completado' },
      { etiqueta: 'embebido.pasos.oferta', estado: aceptada ? 'completado' : 'actual' },
      { etiqueta: 'embebido.pasos.pago', estado: aceptada ? 'actual' : 'pendiente' },
      { etiqueta: 'embebido.pasos.poliza', estado: 'pendiente' },
    ];
  });

  constructor() {
    effect(() => {
      const error = this.seguimiento.error();
      if (error) {
        untracked(() => this.alDetenerseSeguimiento(error));
      }
    });
  }

  ngOnInit(): void {
    this.aliado.establecer(this.solicitud()?.aliado ?? null);
    this.ruta.paramMap
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe((parametros) => this.abrir(parametros.get('ofertaId')));
  }

  /** Abre la oferta de la ruta (o la guardada en la sesión del navegador) desde cero. */
  private abrir(desdeRuta: string | null): void {
    const ofertaId = desdeRuta ?? this.tramite.leer()?.ofertaId ?? null;
    this.seguimiento.detener();
    this.terminosAceptados.set(false);
    this.errorTerminos.set(false);
    this.errorRegistro.set(false);
    this.venceEn.set(null);
    this.ofertaId.set(ofertaId);
    if (ofertaId) {
      this.reanudar();
    } else {
      this.mostrarError('sinOferta');
    }
  }

  /** Retoma el trámite: si la oferta ya tiene aceptación la sigue; si no, muestra la oferta con «Aceptar». */
  protected reanudar(): void {
    const ofertaId = this.ofertaId();
    if (!ofertaId) {
      return;
    }
    this.fase.set('cargando');
    this.api
      .consultarAceptacionDeOferta(ofertaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (aceptacion) => this.seguir(aceptacion, INTERVALO_CONSULTA_MS),
        error: (error: unknown) => {
          switch (codigoDe(error)) {
            case 'acceptance_not_found':
              this.fase.set('oferta');
              break;
            case 'acceptance_unavailable':
              this.mostrarError('noDisponible');
              break;
            case 'unauthorized':
            case 'forbidden':
              // El interceptor ya llevó a «sesión expirada» o «acceso no autorizado».
              break;
            default:
              this.registrar(error);
              this.mostrarError('generico');
          }
        },
      });
  }

  /** «Ver estado de la solicitud»: vuelve a consultar sin dejar la pantalla actual. */
  protected actualizarEstado(): void {
    const ofertaId = this.ofertaId();
    if (!ofertaId) {
      return;
    }
    this.api
      .consultarAceptacionDeOferta(ofertaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (aceptacion) => this.seguir(aceptacion, INTERVALO_CONSULTA_MS),
        error: (error: unknown) => {
          // Sin servicio se mantiene la última pantalla conocida (contrato §3).
          if (codigoDe(error) !== 'acceptance_unavailable') {
            this.alDetenerseSeguimiento(error instanceof ErrorAceptacion ? error : new ErrorAceptacion('invalid_request'));
          }
        },
      });
  }

  protected alCambiarTerminos(evento: Event): void {
    const marcada = (evento.target as HTMLInputElement).checked;
    this.terminosAceptados.set(marcada);
    if (marcada) {
      this.errorTerminos.set(false);
    }
  }

  /** Acepta la oferta. Reenviar el mismo `POST` es seguro: la aceptación es idempotente por oferta. */
  protected aceptar(): void {
    const ofertaId = this.ofertaId();
    if (this.enviando() || !ofertaId) {
      return;
    }
    if (!this.terminosAceptados()) {
      this.errorTerminos.set(true);
      this.casillaTerminos()?.nativeElement.focus();
      return;
    }
    this.enviando.set(true);
    this.errorRegistro.set(false);
    this.api
      .aceptarOferta(ofertaId)
      .pipe(
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (aceptacion) => this.seguir(aceptacion, PRIMERA_CONSULTA_MS),
        error: (error: unknown) => {
          switch (codigoDe(error)) {
            case 'offer_expired':
              this.venceEn.set(error instanceof ErrorAceptacion ? error.venceEn : null);
              this.fase.set('vencida');
              break;
            case 'offer_not_found':
              this.mostrarError('ofertaNoExiste');
              break;
            case 'acceptance_not_registered':
              this.errorRegistro.set(true);
              break;
            case 'unauthorized':
            case 'forbidden':
              break;
            default:
              this.registrar(error);
              this.mostrarError('generico');
          }
        },
      });
  }

  private seguir(aceptacion: Aceptacion, primeraEsperaMs: number): void {
    this.fase.set('seguimiento');
    this.seguimiento.seguir(aceptacion, primeraEsperaMs);
  }

  private alDetenerseSeguimiento(error: ErrorAceptacion): void {
    switch (error.codigo) {
      case 'acceptance_not_found':
        // La oferta ya no tiene aceptación (el backend la perdió al reiniciarse, contrato §8): se puede aceptar de nuevo.
        this.fase.set('oferta');
        break;
      case 'unauthorized':
      case 'forbidden':
        break;
      default:
        this.registrar(error);
        this.mostrarError('generico');
    }
  }

  private mostrarError(motivo: MotivoError): void {
    this.motivoError.set(motivo);
    this.fase.set('error');
  }

  /** `invalid_request` y respuestas inesperadas son errores de programación: se registran en el manejador global. */
  private registrar(error: unknown): void {
    this.manejadorErrores.handleError(error);
  }
}

function codigoDe(error: unknown): CodigoErrorAceptacion {
  return error instanceof ErrorAceptacion ? error.codigo : 'invalid_request';
}
