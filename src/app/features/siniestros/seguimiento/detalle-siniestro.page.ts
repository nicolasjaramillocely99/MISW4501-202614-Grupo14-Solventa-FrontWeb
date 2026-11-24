import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCircleAlert,
  LucideDownload,
  LucideFileText,
  LucideInfo,
  LucideRefreshCw,
  LucideUpload,
} from '@lucide/angular';
import { Subscription, forkJoin } from 'rxjs';

import { ErrorReenvio, HistorialSiniestro } from '@core/api/siniestros/reenvio.modelos';
import { ArchivoAdjunto, DetalleSiniestro, ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { TriageAsegurado } from '@core/api/siniestros/triage.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreSoporte, nombreTipo } from '../modelos/catalogo-siniestros';
import { tonoEstado } from '../modelos/estado-siniestro';
import { montoEnPesos } from '../modelos/presentacion-triage';
import { sondearMientrasPendiente } from '../modelos/sondeo-triage';
import { EtapaSiniestro, Texto, etapasSiniestro, queSigue } from './modelos/linea-tiempo';
import { refrescoVisible } from './modelos/refresco';

type Fase = 'cargando' | 'listo' | 'noEncontrado' | 'error';
/** Estado del bloque de prioridad, independiente del caso: si falla, el caso se sigue mostrando. */
type EstadoPrioridad = 'cargando' | 'listo' | 'error' | 'detenido';

/** Un archivo de la tarjeta «Soportes», con el soporte al que pertenece. */
interface FilaSoporte {
  codigo: string;
  etiqueta: string;
  archivo: ArchivoAdjunto;
}

/**
 * A8 · Detalle y estado del siniestro del asegurado (HU-W2.1-02; la versión mínima fue de HU-W2.2-01). Muestra:
 *
 * - el encabezado con la etapa y la fecha del último cambio (CA-1);
 * - la línea de tiempo: radicado, revisión del asesor, en evaluación (prioridad y prestador), aprobado (monto) y
 *   pagado, o rechazado con su motivo;
 * - los soportes, cada uno con su descarga firmada;
 * - «Qué sigue», «¿Necesitas ayuda?» y los datos reportados.
 *
 * Lee en paralelo el caso (`GET /v1/claims/{id}`) y su historial (`GET /v1/claims/{id}/history`), y la prioridad
 * aparte, con sondeo mientras esté `pending`. Vuelve a leer cada 60 s con la pestaña visible, sin mostrar «Cargando»
 * (CA-2). Ruta `/siniestros/:id`, rol asegurado; un caso ajeno (`403`) lo lleva el interceptor a «acceso no
 * autorizado».
 */
@Component({
  selector: 'app-detalle-siniestro-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    InsigniaEstadoComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideDownload,
    LucideFileText,
    LucideInfo,
    LucideRefreshCw,
    LucideUpload,
  ],
  templateUrl: './detalle-siniestro.page.html',
  styleUrl: './detalle-siniestro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleSiniestroPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private lecturaPrioridad: Subscription | null = null;
  private lecturaCaso: Subscription | null = null;

  private readonly id = this.ruta.snapshot.paramMap.get('id') ?? '';
  protected readonly tonoEstado = tonoEstado;

  protected readonly fase = signal<Fase>('cargando');
  protected readonly caso = signal<DetalleSiniestro | null>(null);
  protected readonly historial = signal<HistorialSiniestro | null>(null);
  protected readonly triage = signal<TriageAsegurado | null>(null);
  protected readonly estadoPrioridad = signal<EstadoPrioridad>('cargando');
  /** Cuándo se leyó el caso por última vez (CA-2). */
  protected readonly leidoEn = signal<string | null>(null);
  /** El soporte que se está pidiendo y el que no se pudo descargar. */
  protected readonly descargando = signal<string | null>(null);
  protected readonly errorDescarga = signal<string | null>(null);
  protected readonly errorRadicado = signal(false);

  protected readonly montoPesos = computed(() => {
    const minor = this.caso()?.montoEstimadoMinor;
    return minor === null || minor === undefined ? null : montoEnPesos(minor);
  });

  protected readonly etapas = computed<EtapaSiniestro[]>(() => {
    const caso = this.caso();
    const historial = this.historial();
    return caso && historial ? etapasSiniestro(caso, historial, this.triage()) : [];
  });

  protected readonly siguiente = computed(() => {
    const historial = this.historial();
    return historial ? queSigue(historial, this.triage()) : null;
  });

  protected readonly soportes = computed<FilaSoporte[]>(
    () =>
      this.caso()?.soportes.items.flatMap((item) =>
        item.archivos.map((archivo) => ({ codigo: item.codigoRequisito, etiqueta: item.etiqueta, archivo })),
      ) ?? [],
  );

  ngOnInit(): void {
    this.cargarCaso();
    this.cargarPrioridad();
    refrescoVisible()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe(() => this.actualizar());
  }

  /** Primera lectura, o «Reintentar»: muestra «Cargando». */
  protected cargarCaso(): void {
    this.fase.set('cargando');
    this.leerCaso();
  }

  /** «Actualizar» y la lectura de cada minuto: sin «Cargando», el caso sigue en pantalla mientras llega. */
  protected actualizar(): void {
    if (this.fase() !== 'listo') {
      return;
    }
    this.leerCaso();
    // Una prioridad en `pending` ya tiene su propio sondeo: reiniciarlo le quitaría el tope de 90 s.
    if (this.estadoPrioridad() !== 'cargando' && this.triage()?.estado !== 'pending') {
      this.cargarPrioridad();
    }
  }

  private leerCaso(): void {
    this.lecturaCaso?.unsubscribe();
    this.lecturaCaso = forkJoin({
      caso: this.api.consultarSiniestro(this.id),
      historial: this.api.consultarHistorial(this.id),
    })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ caso, historial }) => {
          this.caso.set(caso);
          this.historial.set(historial);
          this.leidoEn.set(new Date().toISOString());
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          // Una relectura que falla deja el caso que ya se ve; solo la primera lectura muestra el error.
          if (this.fase() === 'listo') {
            return;
          }
          this.fase.set(this.esNoEncontrado(error) ? 'noEncontrado' : 'error');
        },
      });
  }

  private esNoEncontrado(error: unknown): boolean {
    return (error instanceof ErrorSiniestro || error instanceof ErrorReenvio) && error.codigo === 'claim_not_found';
  }

  /** Lee la prioridad y, mientras esté `pending`, la vuelve a pedir cada 5 s. También es «Reintentar». */
  protected cargarPrioridad(): void {
    this.lecturaPrioridad?.unsubscribe();
    this.estadoPrioridad.set('cargando');
    this.lecturaPrioridad = sondearMientrasPendiente(
      () => this.api.consultarTriage(this.id),
      (triage) => triage.estado === 'pending',
    )
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ valor, actualizacion }) => {
          // El asegurado recibe la vista reducida; la completa (severidad, monto, historial) no debe llegar aquí.
          if (valor.vista !== 'insured') {
            this.estadoPrioridad.set('error');
            return;
          }
          this.triage.set(valor);
          this.estadoPrioridad.set(actualizacion === 'detenido' ? 'detenido' : 'listo');
        },
        error: () => this.estadoPrioridad.set('error'),
      });
  }

  /** Pide el enlace firmado del soporte y lo abre; vence a los 10 minutos, por eso se pide en el momento. */
  protected descargarSoporte(fila: FilaSoporte): void {
    this.descargando.set(fila.archivo.soporteId);
    this.errorDescarga.set(null);
    this.api
      .descargarSoporte(this.id, fila.archivo.soporteId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (enlace) => {
          this.descargando.set(null);
          window.open(enlace.url, '_blank', 'noopener');
        },
        error: () => {
          this.descargando.set(null);
          this.errorDescarga.set(fila.archivo.soporteId);
        },
      });
  }

  /** Descarga el PDF del radicado. */
  protected descargarRadicado(caso: DetalleSiniestro): void {
    this.errorRadicado.set(false);
    this.api
      .descargarRadicado(caso.id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `radicado-${caso.numeroRadicado}.pdf`;
          enlace.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.errorRadicado.set(true),
      });
  }

  /** «Autos · AU-2025-118204 · KJT-482», o solo el número de la póliza si el caso no guardó su ramo. */
  protected poliza(t: Traductor, caso: DetalleSiniestro): string {
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    return [ramo, caso.poliza.id, caso.poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }

  protected tipo(t: Traductor, caso: DetalleSiniestro): string {
    return nombreTipo(t, caso.tipoSiniestro);
  }

  /** Un texto de la línea de tiempo o de «Qué sigue»; un monto en pesos sale con la moneda, como en el resto del portal. */
  protected texto(t: Traductor, prefijo: string, texto: Texto): string {
    const parametros: Record<string, unknown> = { ...(texto.parametros ?? {}) };
    const pesos = parametros['pesos'];
    if (typeof pesos === 'number') {
      const formato = new Intl.NumberFormat(this.transloco.getActiveLang(), {
        style: 'currency',
        currency: 'COP',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0,
      });
      parametros['monto'] = `${formato.format(pesos)} COP`;
    }
    return t(`${prefijo}.${texto.clave}`, parametros);
  }

  protected nombreSoporte(t: Traductor, fila: FilaSoporte): string {
    return nombreSoporte(t, fila.codigo, fila.etiqueta);
  }

  /** «PDF · 240 KB». */
  protected formatoArchivo(archivo: ArchivoAdjunto): string {
    const tipo =
      archivo.tipoContenido === 'application/pdf' ? 'PDF' : archivo.tipoContenido.includes('png') ? 'PNG' : 'JPG';
    const kb = archivo.tamanoBytes / 1024;
    const tamano = kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(kb))} KB`;
    return `${tipo} · ${tamano}`;
  }
}
