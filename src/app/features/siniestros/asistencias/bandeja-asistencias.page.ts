import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideInbox, LucideInfo, LucideRefreshCw } from '@lucide/angular';
import { Subscription } from 'rxjs';

import {
  BandejaAsistencias,
  DetalleAsistencia,
  ErrorAsistencia,
  SolicitudAsistencia,
} from '@core/api/siniestros/asistencia.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../modelos/catalogo-siniestros';
import { IndicadoresAsistenciasComponent } from './componentes/indicadores-asistencias/indicadores-asistencias.component';
import { MapaAsignacionComponent } from './componentes/mapa-asignacion/mapa-asignacion.component';
import { formatearCoordenadas } from './modelos/presentacion-asignacion';
import {
  accionFila,
  horaSolicitud,
  marcadoresBandeja,
  nombreEstadoAsistencia,
  nombreMotivoSinUbicacion,
  polizaResumida,
  sinUbicacionPendientes,
  tonoEstadoAsistencia,
} from './modelos/presentacion-asistencia';

export type FaseBandeja = 'cargando' | 'lista' | 'error';

/** Cada cuánto se vuelve a leer la bandeja (D9 del backend: la solicitud aparece en ≤ 60 s). */
export const INTERVALO_BANDEJA_MS = 30_000;
/** Cuántas solicitudes se piden (el contrato permite 1–100; la bandeja no pagina). */
export const LIMITE_BANDEJA = 50;

/** El detalle que la bandeja entrega al abrir una solicitud tras atenderla, para no leerla dos veces (S5). */
export interface EstadoNavegacionAsistencia {
  detalle?: DetalleAsistencia;
}

/**
 * O9 · Asistencias en sitio (HU-W2.3-03): las solicitudes que el asegurado envió desde la app, para atenderlas durante la
 * llamada (CA-1).
 *
 * - **Lecturas (S1):** al entrar, cada 30 s y con «Actualizar»; una sola a la vez. Con la pestaña oculta no se consulta y
 *   al volver se lee enseguida. Un refresco que falla deja la última lectura con un aviso; solo la primera muestra el
 *   error con «Reintentar».
 * - **Indicadores (S2)**, el aviso de solicitudes sin GPS (S3) y la tabla (S4): la más reciente primero.
 * - **Acciones (S5):** «Atender» y «Continuar» atienden (`POST …/attend`) y abren el detalle con la respuesta; «Ver» solo
 *   abre. Si otro analista ya la despachó o cerró, avisa y relee.
 * - **Mapa (F2, S7):** debajo de la tabla, las solicitudes abiertas con coordenadas (de la app o por voz), encuadradas.
 *   No está en el mockup: lo pide el CA-1.
 *
 * Ruta: `/siniestros/asistencias` (solo operaciones).
 */
@Component({
  selector: 'app-bandeja-asistencias-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    IndicadoresAsistenciasComponent,
    MapaAsignacionComponent,
    FormatoFechaHoraPipe,
    LucideCircleAlert,
    LucideInbox,
    LucideInfo,
    LucideRefreshCw,
  ],
  templateUrl: './bandeja-asistencias.page.html',
  styleUrl: './bandeja-asistencias.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandejaAsistenciasPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly documento = inject(DOCUMENT);

  private consulta: Subscription | null = null;
  private atencion: Subscription | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  protected readonly fase = signal<FaseBandeja>('cargando');
  protected readonly bandeja = signal<BandejaAsistencias | null>(null);
  protected readonly actualizadoEn = signal<Date | null>(null);
  /** Falló un refresco: se ve la última lectura con un aviso. */
  protected readonly refrescoFallido = signal(false);
  /** La solicitud que se está atendiendo (`POST …/attend` en curso). */
  protected readonly atendiendo = signal<string | null>(null);
  /** Aviso de la última acción que no prosperó (clave bajo `siniestros.asistencias.bandeja.avisos`). */
  protected readonly aviso = signal<'noAbierta' | 'noAtendida' | null>(null);

  protected readonly solicitudes = computed(() => this.bandeja()?.solicitudes ?? []);
  protected readonly pendientesSinGps = computed(() => sinUbicacionPendientes(this.solicitudes()));
  protected readonly marcadores = computed(() =>
    marcadoresBandeja(this.solicitudes(), this.traductor),
  );

  protected readonly accionFila = accionFila;
  protected readonly tonoEstado = tonoEstadoAsistencia;
  protected readonly polizaResumida = polizaResumida;

  private readonly traductor: Traductor = (clave, parametros) =>
    this.transloco.translate(`siniestros.${clave}`, parametros);

  constructor() {
    const alCambiarVisibilidad = () => this.alCambiarVisibilidad();
    this.documento.addEventListener('visibilitychange', alCambiarVisibilidad);
    inject(DestroyRef).onDestroy(() => {
      this.documento.removeEventListener('visibilitychange', alCambiarVisibilidad);
      this.detenerSondeo();
      this.consulta?.unsubscribe();
      this.atencion?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.leer();
  }

  /** «Actualizar» y «Reintentar»: lee ya y reinicia la espera de 30 s. */
  protected actualizar(): void {
    this.leer();
  }

  protected atender(solicitud: SolicitudAsistencia): void {
    if (this.atendiendo()) {
      return;
    }
    this.aviso.set(null);
    this.atendiendo.set(solicitud.solicitudId);
    this.atencion = this.api.atenderAsistencia(solicitud.solicitudId).subscribe({
      next: (detalle) => {
        this.atendiendo.set(null);
        const estado: EstadoNavegacionAsistencia = { detalle };
        void this.router.navigate(['/siniestros/asistencias', solicitud.solicitudId], {
          state: estado,
        });
      },
      error: (error: unknown) => {
        this.atendiendo.set(null);
        if (error instanceof ErrorAsistencia && error.codigo === 'assistance_not_open') {
          this.aviso.set('noAbierta');
          this.leer();
        } else {
          this.aviso.set('noAtendida');
        }
      },
    });
  }

  protected ubicacionPrincipal(t: Traductor, solicitud: SolicitudAsistencia): string {
    const u = solicitud.ubicacion;
    if (u.estado === 'sent') {
      return u.lugar ?? t('asistencias.bandeja.ubicacion.compartida');
    }
    return t('asistencias.bandeja.ubicacion.sinGps');
  }

  protected ubicacionSecundaria(t: Traductor, solicitud: SolicitudAsistencia): string {
    const u = solicitud.ubicacion;
    if (u.estado === 'sent' && u.latitud !== null && u.longitud !== null) {
      const coordenadas = formatearCoordenadas(
        t,
        u.latitud,
        u.longitud,
        this.transloco.getActiveLang(),
      );
      return u.precisionM === null
        ? coordenadas
        : `${coordenadas} · ${t('asistencias.bandeja.ubicacion.precision', { precision: u.precisionM })}`;
    }
    return u.voz?.direccion ?? nombreMotivoSinUbicacion(t, u.motivoSinUbicacion);
  }

  protected nombreEstado(t: Traductor, estado: string): string {
    return nombreEstadoAsistencia(t, estado);
  }

  protected hora(solicitud: SolicitudAsistencia): string {
    return horaSolicitud(solicitud.solicitadaEn, new Date(), this.transloco.getActiveLang());
  }

  protected leyendaMapa(t: Traductor): string {
    const cantidad = this.marcadores().length;
    if (cantidad === 0) {
      return t('mapa.leyendaSolicitudes.ninguna');
    }
    return cantidad === 1
      ? t('mapa.leyendaSolicitudes.una')
      : t('mapa.leyendaSolicitudes.varias', { cantidad });
  }

  private leer(): void {
    this.detenerSondeo();
    this.consulta?.unsubscribe();
    if (!this.bandeja()) {
      this.fase.set('cargando');
    }
    this.consulta = this.api.listarBandejaAsistencias({ limite: LIMITE_BANDEJA }).subscribe({
      next: (bandeja) => {
        this.bandeja.set(bandeja);
        this.actualizadoEn.set(new Date());
        this.refrescoFallido.set(false);
        this.fase.set('lista');
        this.programar();
      },
      // 401 y 403 los resuelve el interceptor. Con una lectura previa se conserva; sin ella, el error con reintento.
      error: () => {
        if (this.bandeja()) {
          this.refrescoFallido.set(true);
        } else {
          this.fase.set('error');
        }
        this.programar();
      },
    });
  }

  private programar(): void {
    this.detenerSondeo();
    if (this.documento.visibilityState === 'hidden') {
      return;
    }
    this.temporizador = setTimeout(() => this.leer(), INTERVALO_BANDEJA_MS);
  }

  private detenerSondeo(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  private alCambiarVisibilidad(): void {
    if (this.documento.visibilityState === 'hidden') {
      this.detenerSondeo();
    } else {
      this.leer();
    }
  }
}
