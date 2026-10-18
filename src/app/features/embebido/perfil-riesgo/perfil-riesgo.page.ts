import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock,
  LucideEllipsis,
  LucideInfo,
  LucideLandmark,
  LucideTriangleAlert,
} from '@lucide/angular';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';
import { ErrorOferta } from '@core/api/originacion/oferta.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  FuentePerfil,
  NombreFuente,
  PerfilRiesgo,
} from '@core/api/originacion/perfil-riesgo.modelos';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { ContextoLanzamientoService } from '../servicios/contexto-lanzamiento.service';
import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';

type Fase = 'calculando' | 'listo' | 'error';
type MotivoError = 'consentimiento' | 'generico';
/** Por qué no se pudo generar la oferta al pulsar «Ver mi oferta». */
type MotivoErrorOferta = 'datos' | 'noDisponible' | 'generico';
type Icono = 'listo' | 'enCurso' | 'alerta' | 'pendiente';
type TonoAviso = 'informacion' | 'exito' | 'advertencia' | 'error';

/** Una fila del detalle del cálculo: una fuente externa, el motor de tarifación o la generación de la oferta. */
export interface FilaCalculo {
  clave: string;
  icono: Icono;
  /** Clave i18n bajo `embebido.perfilRiesgo`. */
  nombre: string;
  detalle: string;
  detalleParametros?: Record<string, number>;
  /** Fecha ISO que se interpola como `{{fecha}}` en el detalle. */
  detalleFecha?: string | null;
  insignia: { tono: TonoInsignia; texto: string } | null;
  atenuada: boolean;
}

export interface AvisoCalculo {
  tono: TonoAviso;
  titulo: string;
  texto: string;
  /** Clave de la fuente afectada (`fuente.<clave>`), para `{{fuente}}`. */
  fuente?: string;
  fecha?: string | null;
}

const CLAVE_FUENTE: Record<NombreFuente, string> = {
  open_finance: 'openFinance',
  open_data: 'openData',
  kyc: 'kyc',
};

/**
 * Paso 2 · Cálculo del perfil de riesgo (E2 y E2b; HU-W1.2-02). Resuelve el perfil con
 * `POST /v1/risk-profiles/resolve` y muestra el estado de cada fuente, el resultado y, si el cálculo
 * degradó (último perfil en caché, perfil base o fuentes parciales), el aviso correspondiente. Los
 * estados viven en la misma página. El cálculo de latencia, caché y corte es del backend: aquí solo se
 * presenta.
 *
 * Ruta: `/embebido/perfil-riesgo/:clienteId?consentimiento=true`. El consentimiento lo afirma quien
 * navega (HU-W1.2-01); sin él, el backend responde 422 y no consulta ninguna fuente.
 *
 * «Ver mi oferta» (HU-W1.2-03) genera la oferta con `POST /v1/offers`, con el cliente y el consentimiento del paso 1
 * y el crédito del aliado, y abre `/embebido/oferta/:ofertaId`.
 */
@Component({
  selector: 'app-perfil-riesgo-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    IndicadorPasosComponent,
    InsigniaEstadoComponent,
    FormatoMonedaPipe,
    FormatoFechaPipe,
    LucideLandmark,
    LucideCircleCheck,
    LucideClock,
    LucideEllipsis,
    LucideTriangleAlert,
    LucideInfo,
    LucideCircleAlert,
  ],
  templateUrl: './perfil-riesgo.page.html',
  styleUrl: './perfil-riesgo.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilRiesgoPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly router = inject(Router);
  private readonly flujo = inject(FlujoEmbebidoService);
  private readonly contexto = inject(ContextoLanzamientoService);
  private readonly aliado = inject(ContextoAliadoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly solicitud = this.flujo.solicitud;
  protected readonly fase = signal<Fase>('calculando');
  protected readonly perfil = signal<PerfilRiesgo | null>(null);
  protected readonly motivoError = signal<MotivoError>('generico');
  /** `POST /v1/offers` en curso: «Ver mi oferta» queda deshabilitado. */
  protected readonly generandoOferta = signal(false);
  protected readonly errorOferta = signal<MotivoErrorOferta | null>(null);

  protected readonly pasos = computed<readonly PasoFlujo[]>(() => {
    const completado = this.fase() === 'listo';
    return [
      { etiqueta: 'embebido.pasos.consentimiento', estado: 'completado' },
      { etiqueta: 'embebido.pasos.perfilRiesgo', estado: completado ? 'completado' : 'actual' },
      { etiqueta: 'embebido.pasos.oferta', estado: 'pendiente' },
      { etiqueta: 'embebido.pasos.pago', estado: 'pendiente' },
      { etiqueta: 'embebido.pasos.poliza', estado: 'pendiente' },
    ];
  });

  protected readonly filas = computed<FilaCalculo[]>(() => {
    const fase = this.fase();
    const perfil = this.perfil();
    if (fase === 'error') {
      return [];
    }
    if (fase === 'calculando' || !perfil) {
      return [
        ...(['open_finance', 'open_data', 'kyc'] as const).map((nombre) =>
          filaFuente(nombre, 'consultando', 'enCurso', 'informacion', 'enCurso'),
        ),
        {
          clave: 'motor',
          icono: 'enCurso',
          nombre: 'motor.nombre',
          detalle: 'motor.aplicando',
          insignia: { tono: 'informacion', texto: 'insignia.enCurso' },
          atenuada: false,
        },
        {
          clave: 'oferta',
          icono: 'pendiente',
          nombre: 'oferta.nombre',
          detalle: 'oferta.pendiente',
          insignia: null,
          atenuada: true,
        },
      ];
    }
    return [
      ...filasDeFuentes(perfil),
      {
        clave: 'motor',
        icono: 'listo',
        nombre: 'motor.nombre',
        detalle: 'motor.listo',
        insignia: { tono: 'exito', texto: 'insignia.listo' },
        atenuada: false,
      },
      {
        clave: 'oferta',
        icono: 'listo',
        nombre: 'oferta.nombre',
        detalle: 'oferta.lista',
        insignia: null,
        atenuada: true,
      },
    ];
  });

  protected readonly aviso = computed<AvisoCalculo>(() => {
    const fase = this.fase();
    const perfil = this.perfil();
    if (fase === 'error') {
      return this.motivoError() === 'consentimiento'
        ? { tono: 'error', titulo: 'avisos.consentimiento.titulo', texto: 'avisos.consentimiento.texto' }
        : { tono: 'error', titulo: 'avisos.error.titulo', texto: 'avisos.error.texto' };
    }
    if (fase === 'calculando' || !perfil) {
      return { tono: 'informacion', titulo: 'avisos.fuentesNoResponden.titulo', texto: 'avisos.fuentesNoResponden.texto' };
    }
    if (perfil.modo === 'provisional') {
      return perfil.aviso === 'last_profile_in_use' && perfil.fechaPerfil
        ? {
            tono: 'advertencia',
            titulo: 'avisos.ultimoPerfil.titulo',
            texto: 'avisos.ultimoPerfil.texto',
            fuente: CLAVE_FUENTE[perfil.fuenteNoDisponible ?? 'open_finance'],
            fecha: perfil.fechaPerfil,
          }
        : { tono: 'advertencia', titulo: 'avisos.perfilBase.titulo', texto: 'avisos.perfilBase.texto' };
    }
    return perfil.parcial
      ? { tono: 'informacion', titulo: 'avisos.parcial.titulo', texto: 'avisos.parcial.texto' }
      : { tono: 'exito', titulo: 'avisos.lista.titulo', texto: 'avisos.lista.texto' };
  });

  ngOnInit(): void {
    this.aliado.establecer(this.solicitud()?.aliado ?? null);
    this.calcular();
  }

  /**
   * Genera la oferta con el cliente y el consentimiento del paso 1. Sin ellos (la página se abrió sin pasar por el
   * consentimiento) o si el backend pide el consentimiento, se vuelve al paso 1.
   */
  protected verOferta(): void {
    const cliente = this.contexto.cliente();
    const aliadoId = this.contexto.aliadoId();
    const consentimiento = this.contexto.consentimiento();
    const solicitud = this.solicitud();
    if (this.generandoOferta()) {
      return;
    }
    if (!cliente || !aliadoId || !consentimiento || !solicitud) {
      void this.router.navigateByUrl('/embebido/consentimiento');
      return;
    }
    this.generandoOferta.set(true);
    this.errorOferta.set(null);
    this.api
      .generarOferta({
        clienteId: cliente.id,
        consentimientoId: consentimiento.id,
        aliadoId,
        solicitudId: solicitud.numero,
        documento: cliente.documento,
        nombreCompleto: cliente.nombreCompleto,
        correo: cliente.correo,
        fechaNacimiento: cliente.fechaNacimiento,
        valorAsegurado: solicitud.montoAprobado,
        plazoMeses: solicitud.plazoAnios * 12,
      })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (oferta) => void this.router.navigate(['/embebido/oferta', oferta.id]),
        error: (error: unknown) => {
          this.generandoOferta.set(false);
          this.alFallarOferta(error);
        },
      });
  }

  private alFallarOferta(error: unknown): void {
    switch (error instanceof ErrorOferta ? error.codigo : 'offer_unavailable') {
      case 'consent_required':
      case 'consent_mismatch':
        void this.router.navigateByUrl('/embebido/consentimiento');
        break;
      case 'validation_failed':
      case 'invalid_request':
        this.errorOferta.set('datos');
        break;
      case 'consent_unverifiable':
      case 'offer_unavailable':
        this.errorOferta.set('noDisponible');
        break;
      default:
        this.errorOferta.set('generico');
    }
  }

  protected calcular(): void {
    const { clienteId } = this.ruta.snapshot.params;
    const consentimientoActivo = this.ruta.snapshot.queryParamMap.get('consentimiento') === 'true';
    this.fase.set('calculando');
    this.api
      .resolverPerfilRiesgo({ clienteId, consentimientoActivo })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (perfil) => {
          this.perfil.set(perfil);
          this.flujo.perfil.set(perfil);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          this.motivoError.set(
            error instanceof HttpErrorResponse && error.status === 422 ? 'consentimiento' : 'generico',
          );
          this.fase.set('error');
        },
      });
  }
}

/** Fila de una fuente externa en el estado indicado. */
function filaFuente(
  nombre: NombreFuente,
  detalle: string,
  icono: Icono,
  tono: TonoInsignia,
  insignia: string,
  latenciaMs?: number,
): FilaCalculo {
  return {
    clave: nombre,
    icono,
    nombre: `fuente.${CLAVE_FUENTE[nombre]}`,
    detalle: `detalleFuente.${detalle}`,
    detalleParametros: latenciaMs === undefined ? undefined : { ms: latenciaMs },
    insignia: { tono, texto: `insignia.${insignia}` },
    atenuada: false,
  };
}

function filaDeFuente(fuente: FuentePerfil): FilaCalculo {
  switch (fuente.estado) {
    case 'ok':
      return filaFuente(fuente.nombre, 'consultado', 'listo', 'exito', 'listo', fuente.latenciaMs);
    case 'timeout':
      return filaFuente(fuente.nombre, 'tiempoAgotado', 'alerta', 'advertencia', 'sinRespuesta', fuente.latenciaMs);
    case 'error':
      return filaFuente(fuente.nombre, 'error', 'alerta', 'error', 'conFalla', fuente.latenciaMs);
    case 'circuit_open':
      return filaFuente(fuente.nombre, 'aislada', 'alerta', 'advertencia', 'noDisponible');
  }
}

/**
 * Filas de las fuentes del resultado. Sin detalle por fuente (perfil reutilizado, una sola fuente o perfil
 * base) se muestra una fila que explica de dónde salió el perfil.
 */
function filasDeFuentes(perfil: PerfilRiesgo): FilaCalculo[] {
  if (perfil.fuentes.length > 0) {
    return perfil.fuentes.map(filaDeFuente);
  }
  switch (perfil.origen) {
    case 'cache':
      return [
        {
          clave: 'perfil',
          icono: 'listo',
          nombre: 'perfilVigente.nombre',
          detalle: 'perfilVigente.detalle',
          detalleFecha: perfil.fechaPerfil,
          insignia: { tono: 'exito', texto: 'insignia.listo' },
          atenuada: false,
        },
      ];
    case 'base_actuarial':
      return [
        {
          clave: 'perfil',
          icono: 'alerta',
          nombre: 'perfilBase.nombre',
          detalle: 'perfilBase.detalle',
          insignia: { tono: 'advertencia', texto: 'insignia.provisional' },
          atenuada: false,
        },
      ];
    default:
      return [filaFuente('open_finance', 'consultadoSinLatencia', 'listo', 'exito', 'listo')];
  }
}
