import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideRefreshCw, LucideTruck } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';

import {
  CampoInvalido,
  Prestador,
  SolicitudUbicacion,
} from '@core/api/siniestros/asignacion.modelos';
import {
  CandidatoAsistencia,
  CodigoErrorAsistencia,
  DetalleAsistencia,
  ErrorAsistencia,
  PoliticaAsistencia,
  SolicitudCierre,
} from '@core/api/siniestros/asistencia.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { SesionService } from '@core/auth/sesion.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../modelos/catalogo-siniestros';
import { EstadoNavegacionAsistencia } from './bandeja-asistencias.page';
import { CandidatosAsistenciaComponent } from './componentes/candidatos-asistencia/candidatos-asistencia.component';
import { CierreAsistenciaComponent } from './componentes/cierre-asistencia/cierre-asistencia.component';
import { ConfirmarDespachoComponent } from './componentes/confirmar-despacho/confirmar-despacho.component';
import { DespachoAsistenciaComponent } from './componentes/despacho-asistencia/despacho-asistencia.component';
import { HistorialAsistenciaComponent } from './componentes/historial-asistencia/historial-asistencia.component';
import { LlamadaAsistenciaComponent } from './componentes/llamada-asistencia/llamada-asistencia.component';
import { MapaAsignacionComponent } from './componentes/mapa-asignacion/mapa-asignacion.component';
import { NecesidadAsistenciaComponent } from './componentes/necesidad-asistencia/necesidad-asistencia.component';
import { UbicacionIncidenteComponent } from './componentes/ubicacion-incidente/ubicacion-incidente.component';
import { Coordenadas, MarcadorMapa } from './modelos/mapa';
import {
  fechaLocal,
  formatearCoordenadas,
  nombreEspecialidad,
} from './modelos/presentacion-asignacion';
import {
  MOTIVOS_CIERRE_CONOCIDOS,
  accionesDetalle,
  candidatosSeparados,
  coordenadasDe,
  estaAbierta,
  etiquetaObjetoAsegurado,
  horaSolicitud,
  horaUtc,
  inicioLlamada,
  necesidadesDeLinea,
  nombreEstadoAsistencia,
  nombreMotivoCierre,
  nombreMotivoSinUbicacion,
  tonoEstadoAsistencia,
} from './modelos/presentacion-asistencia';

export type FaseDetalle = 'cargando' | 'lista' | 'noEncontrada' | 'error';
type Escritura = 'atender' | 'necesidad' | 'ubicar' | 'despachar' | 'cerrar';

/** Cada cuánto se vuelve a leer la solicitud mientras el correo al prestador no sale, y cuántas veces como máximo (S17). */
export const INTERVALO_AVISO_ASISTENCIA_MS = 5000;
export const MAXIMO_LECTURAS_AVISO_ASISTENCIA = 12;

/** Errores tras los que se vuelve a leer la solicitud: otro analista o la sugerencia cambiaron lo que se ve. */
const RELEER: readonly CodigoErrorAsistencia[] = [
  'assistance_not_open',
  'assistance_not_attended',
  'location_from_app',
  'need_not_for_line',
  'need_missing',
  'location_missing',
  'provider_not_eligible',
];

/** Códigos con texto propio en `siniestros.asistencias.detalle.errores`. */
const CON_TEXTO: readonly string[] = [...RELEER, 'validation_failed'];

/**
 * O9b · Detalle de la asistencia (HU-W2.3-03): todo lo que el analista necesita durante la llamada (CA-2) y sus
 * decisiones (CA-3 a CA-5), en una sola página con los estados de la solicitud y de la sugerencia:
 *
 * - **Encabezado (S8):** número, estado, asegurado, póliza y hora; «Atender» (`new`), «Continuar la llamada» (la atiende
 *   otro analista), «Cerrar solicitud» (envía el formulario de cierre) y «Despachar prestador sugerido» (`in_call`).
 * - **Izquierda:** el mapa con el asegurado y los prestadores cercanos, sus coordenadas, la hora UTC, la necesidad y la
 *   especialidad (S12, S13); sin GPS, la dirección y el pin que indica el asegurado por voz. Debajo, el cierre por otro
 *   medio (S16), el prestador despachado (S17) o el cierre registrado.
 * - **Derecha:** la llamada con su cronómetro (S9), el asegurado (S10), «Al despachar» (S11) y el historial (S18).
 * - **Abajo:** «Prestadores cercanos» (S14); «Despachar» pide confirmación (S15).
 *
 * Abrir el detalle no cambia el estado. Cada escritura devuelve la solicitud completa y la página repinta con ella; si
 * otro analista se adelantó, avisa y relee. El front no calcula distancias, elegibilidad ni llegada estimada (D8). Si
 * llega desde «Atender» de la bandeja, usa la respuesta que trae la navegación en vez de leer otra vez (S5).
 * Ruta: `/siniestros/asistencias/:id` (solo operaciones).
 */
@Component({
  selector: 'app-detalle-asistencia-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    MapaAsignacionComponent,
    UbicacionIncidenteComponent,
    LlamadaAsistenciaComponent,
    NecesidadAsistenciaComponent,
    CandidatosAsistenciaComponent,
    ConfirmarDespachoComponent,
    CierreAsistenciaComponent,
    DespachoAsistenciaComponent,
    HistorialAsistenciaComponent,
    FormatoFechaHoraPipe,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideRefreshCw,
    LucideTruck,
  ],
  templateUrl: './detalle-asistencia.page.html',
  styleUrl: './detalle-asistencia.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleAsistenciaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(SiniestrosApiService);
  private readonly sesion = inject(SesionService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly confirmacion = viewChild(ConfirmarDespachoComponent);
  private readonly cierre = viewChild(CierreAsistenciaComponent);
  /** El detalle que entregó «Atender» de la bandeja, solo durante esa navegación (S5). */
  private readonly detalleNavegacion = (
    inject(Router).currentNavigation()?.extras.state as EstadoNavegacionAsistencia | undefined
  )?.detalle;
  private seguimiento: ReturnType<typeof setTimeout> | null = null;
  private lecturasAviso = 0;
  private especialidadLeida: string | null = null;

  protected readonly id = signal('');
  protected readonly fase = signal<FaseDetalle>('cargando');
  protected readonly detalle = signal<DetalleAsistencia | null>(null);
  protected readonly politica = signal<PoliticaAsistencia | null>(null);
  protected readonly politicaFallida = signal(false);
  /** El registro de la especialidad, solo para ubicar a los prestadores en el mapa (S12); `null` si no se leyó. */
  protected readonly prestadores = signal<Prestador[] | null>(null);
  protected readonly prestadoresFallidos = signal(false);
  protected readonly escritura = signal<Escritura | null>(null);
  /** Clave del aviso bajo `siniestros.asistencias.detalle.errores`. */
  protected readonly aviso = signal<string | null>(null);
  protected readonly erroresUbicacion = signal<readonly CampoInvalido[]>([]);
  protected readonly erroresCierre = signal<readonly CampoInvalido[]>([]);
  protected readonly corrigiendo = signal(false);
  protected readonly pinEdicion = signal<Coordenadas | null>(null);
  protected readonly avisoDetenido = signal(false);
  protected readonly hoy = fechaLocal(new Date());

  protected readonly acciones = computed(() => {
    const d = this.detalle();
    return d ? accionesDetalle(d, this.sesion.usuario()?.correo ?? '') : null;
  });
  protected readonly radioMaximoKm = computed(() => {
    const radios = this.politica()?.radiosKm ?? [];
    return radios.length > 0 ? Math.max(...radios) : null;
  });
  protected readonly opcionesNecesidad = computed(() => {
    const politica = this.politica();
    const d = this.detalle();
    return politica && d ? necesidadesDeLinea(politica, d.poliza.linea) : null;
  });
  protected readonly motivosCierre = computed(
    () => this.politica()?.motivosCierre ?? MOTIVOS_CIERRE_CONOCIDOS,
  );
  protected readonly inicioLlamada = computed(() => inicioLlamada(this.detalle()?.historial ?? []));
  protected readonly punto = computed(() => {
    const d = this.detalle();
    return d ? coordenadasDe(d.ubicacion) : null;
  });
  /** El formulario de la ubicación por voz: en llamada y sin coordenadas, o al corregir la registrada. */
  protected readonly ubicando = computed(
    () => !!this.acciones()?.decidir && (this.punto() === null || this.corrigiendo()),
  );
  protected readonly incidenteMapa = computed(() =>
    this.ubicando() ? this.pinEdicion() : this.punto(),
  );
  protected readonly radioMapa = computed(() =>
    this.ubicando() ? null : (this.detalle()?.sugerencia.radioKm ?? null),
  );
  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const prestadores = this.prestadores();
    const d = this.detalle();
    if (!prestadores || !d || this.ubicando()) {
      return [];
    }
    const porId = new Map(prestadores.map((p) => [p.id, p]));
    const numero = new Intl.NumberFormat(this.transloco.getActiveLang(), {
      maximumFractionDigits: 1,
    });
    const marcador = (
      id: string,
      nombre: string,
      distanciaKm: number,
      tipo: MarcadorMapa['tipo'],
    ): MarcadorMapa[] => {
      const p = porId.get(id);
      return p
        ? [
            {
              id,
              latitud: p.latitud,
              longitud: p.longitud,
              tipo,
              etiqueta: `${nombre} · ${numero.format(distanciaKm)} km`,
            },
          ]
        : [];
    };
    if (d.despacho) {
      const { prestador, distanciaKm } = d.despacho;
      return marcador(prestador.id, prestador.nombre, distanciaKm, 'asignado');
    }
    return candidatosSeparados(d.sugerencia, this.radioMaximoKm()).enMapa.flatMap((c) =>
      marcador(c.prestadorId, c.nombre, c.distanciaKm, 'candidato'),
    );
  });
  /** El nombre del prestador que sugería el sistema al despachar, del registro de la especialidad (S17). */
  protected readonly nombreSugerido = computed(() => {
    const id = this.detalle()?.despacho?.prestadorSugeridoId;
    return (id && this.prestadores()?.find((p) => p.id === id)?.nombre) || null;
  });

  protected readonly tonoEstado = tonoEstadoAsistencia;
  protected readonly estaAbierta = estaAbierta;

  constructor() {
    this.destruccion.onDestroy(() => this.detenerSeguimiento());
  }

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.leerPolitica();
    const desdeBandeja = this.detalleNavegacion;
    if (desdeBandeja && desdeBandeja.solicitudId === this.id()) {
      this.mostrar(desdeBandeja);
    } else {
      this.leer();
    }
  }

  /** «Actualizar», «Reintentar» y «Buscar de nuevo» (la sugerencia se calcula en cada lectura). */
  protected cargar(): void {
    this.detenerSeguimiento();
    this.lecturasAviso = 0;
    this.avisoDetenido.set(false);
    if (!this.detalle()) {
      this.fase.set('cargando');
    }
    this.leer();
  }

  protected leerPolitica(): void {
    this.politicaFallida.set(false);
    this.api
      .consultarPoliticaAsistencia()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (politica) => this.politica.set(politica),
        error: () => this.politicaFallida.set(true),
      });
  }

  /** «Atender» y «Continuar la llamada»: las dos son `POST …/attend` (S2 del backend). */
  protected atender(): void {
    this.ejecutar('atender', this.api.atenderAsistencia(this.id()));
  }

  protected registrarNecesidad(codigo: string): void {
    this.ejecutar('necesidad', this.api.registrarNecesidad(this.id(), codigo));
  }

  protected guardarUbicacion(solicitud: SolicitudUbicacion): void {
    this.ejecutar('ubicar', this.api.registrarUbicacionPorVoz(this.id(), solicitud));
  }

  protected corregirUbicacion(): void {
    this.pinEdicion.set(this.punto());
    this.erroresUbicacion.set([]);
    this.corrigiendo.set(true);
  }

  protected cancelarCorreccion(): void {
    this.corrigiendo.set(false);
    this.pinEdicion.set(null);
  }

  protected pedirDespacho(candidato: CandidatoAsistencia): void {
    this.aviso.set(null);
    this.confirmacion()?.abrir(candidato);
  }

  protected despachar(candidato: CandidatoAsistencia): void {
    this.ejecutar('despachar', this.api.despacharAsistencia(this.id(), candidato.prestadorId));
  }

  protected cerrar(solicitud: SolicitudCierre): void {
    this.ejecutar('cerrar', this.api.cerrarAsistencia(this.id(), solicitud));
  }

  /** «Cerrar como “Sin prestador disponible”» (S14): elige ese motivo en el formulario y le lleva el foco. */
  protected cerrarSinPrestador(): void {
    this.cierre()?.elegirMotivo('no_provider_available');
  }

  /** «Carolina Pérez · Autos AU-2026-868766 · IZJ-766 · recibida hoy a las 11:16:10 · llamada en curso». */
  protected subtitulo(t: Traductor, d: DetalleAsistencia): string {
    const idioma = this.transloco.getActiveLang();
    const fecha = new Date(d.solicitadaEn);
    const hora = new Intl.DateTimeFormat(idioma, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(fecha);
    const recibida =
      fechaLocal(fecha) === this.hoy
        ? t('asistencias.detalle.subtitulo.recibidaHoy', { hora })
        : t('asistencias.detalle.subtitulo.recibidaEl', {
            hora,
            fecha: new Intl.DateTimeFormat(idioma, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }).format(fecha),
          });
    const p = d.poliza;
    const partes = [
      d.solicitante ?? t('asistencias.bandeja.sinNombre'),
      `${p.producto} ${p.polizaId}`,
      p.linea === 'auto' ? p.objetoAsegurado : '',
      recibida,
      d.estado === 'in_call' ? t('asistencias.detalle.subtitulo.enLlamada') : '',
    ];
    return partes.filter((parte) => parte !== '').join(' · ');
  }

  protected nombreEstado(t: Traductor, estado: string): string {
    return nombreEstadoAsistencia(t, estado);
  }

  protected etiquetaObjeto(linea: string): string {
    return `asistencias.detalle.asegurado.${etiquetaObjetoAsegurado(linea)}`;
  }

  protected coordenadas(t: Traductor, punto: Coordenadas): string {
    return formatearCoordenadas(t, punto.latitud, punto.longitud, this.transloco.getActiveLang());
  }

  protected motivoSinUbicacion(t: Traductor, d: DetalleAsistencia): string {
    return nombreMotivoSinUbicacion(t, d.ubicacion.motivoSinUbicacion);
  }

  protected motivoCierre(t: Traductor, codigo: string): string {
    return nombreMotivoCierre(t, codigo);
  }

  protected especialidad(t: Traductor, codigo: string): string {
    return nombreEspecialidad(t, codigo);
  }

  protected horaUtc(instante: string): string {
    return horaUtc(instante, this.transloco.getActiveLang());
  }

  protected hora(instante: string): string {
    return horaSolicitud(instante, new Date(), this.transloco.getActiveLang());
  }

  /** Rótulo del pin del asegurado: con la precisión del teléfono o «por voz» (S12). */
  protected etiquetaPin(t: Traductor, d: DetalleAsistencia): string {
    const u = d.ubicacion;
    if (this.ubicando() || (u.estado !== 'sent' && u.voz)) {
      return t('mapa.aseguradoPorVoz');
    }
    return u.precisionM === null
      ? t('mapa.aseguradoSinPrecision')
      : t('mapa.asegurado', { precision: u.precisionM });
  }

  private ejecutar(accion: Escritura, peticion: Observable<DetalleAsistencia>): void {
    if (this.escritura()) {
      return;
    }
    this.escritura.set(accion);
    this.aviso.set(null);
    this.erroresUbicacion.set([]);
    this.erroresCierre.set([]);
    peticion
      .pipe(
        finalize(() => this.escritura.set(null)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (detalle) => {
          this.confirmacion()?.cerrar();
          if (accion === 'ubicar') {
            this.cancelarCorreccion();
          }
          this.cargarSeguimiento();
          this.mostrar(detalle);
        },
        error: (error: unknown) => this.alFallar(accion, error),
      });
  }

  private alFallar(accion: Escritura, error: unknown): void {
    const codigo = error instanceof ErrorAsistencia ? error.codigo : 'assistance_unavailable';
    this.confirmacion()?.cerrar();
    if (codigo === 'validation_failed' && error instanceof ErrorAsistencia) {
      if (accion === 'ubicar') {
        this.erroresUbicacion.set(error.campos);
        return;
      }
      if (accion === 'cerrar') {
        this.erroresCierre.set(error.campos);
        return;
      }
    }
    if (codigo === 'assistance_request_not_found') {
      this.detenerSeguimiento();
      this.fase.set('noEncontrada');
      return;
    }
    this.aviso.set(CON_TEXTO.includes(codigo) ? codigo : 'generico');
    if (RELEER.includes(codigo)) {
      this.cancelarCorreccion();
      this.cargar();
    }
  }

  private leer(): void {
    this.api
      .consultarAsistencia(this.id())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (detalle) => this.mostrar(detalle),
        error: (error: unknown) => {
          const codigo = error instanceof ErrorAsistencia ? error.codigo : 'assistance_unavailable';
          if (codigo === 'assistance_request_not_found') {
            this.fase.set('noEncontrada');
          } else if (this.detalle()) {
            this.aviso.set('lectura');
          } else {
            this.fase.set('error');
          }
        },
      });
  }

  private mostrar(detalle: DetalleAsistencia): void {
    this.detalle.set(detalle);
    this.fase.set('lista');
    this.leerPrestadores(
      detalle.sugerencia.especialidad ??
        detalle.despacho?.especialidad ??
        detalle.necesidad?.especialidad ??
        null,
    );
    this.seguirAviso(detalle);
  }

  /** Coordenadas de los prestadores de la especialidad para el mapa; se relee solo si cambia (S12). */
  private leerPrestadores(especialidad: string | null): void {
    if (!especialidad || especialidad === this.especialidadLeida) {
      return;
    }
    this.especialidadLeida = especialidad;
    this.prestadoresFallidos.set(false);
    this.api
      .listarPrestadores({ especialidad })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (prestadores) => this.prestadores.set(prestadores),
        error: () => {
          this.prestadores.set([]);
          this.prestadoresFallidos.set(true);
        },
      });
  }

  /** Una escritura empieza un seguimiento nuevo del aviso. */
  private cargarSeguimiento(): void {
    this.lecturasAviso = 0;
    this.avisoDetenido.set(false);
  }

  /** Mientras el correo al prestador está pendiente, vuelve a leer hasta que salga o se agote el seguimiento (S17). */
  private seguirAviso(detalle: DetalleAsistencia): void {
    this.detenerSeguimiento();
    if (detalle.despacho?.aviso.estado !== 'pending') {
      return;
    }
    if (this.lecturasAviso >= MAXIMO_LECTURAS_AVISO_ASISTENCIA) {
      this.avisoDetenido.set(true);
      return;
    }
    this.lecturasAviso++;
    this.seguimiento = setTimeout(() => this.leer(), INTERVALO_AVISO_ASISTENCIA_MS);
  }

  private detenerSeguimiento(): void {
    if (this.seguimiento !== null) {
      clearTimeout(this.seguimiento);
      this.seguimiento = null;
    }
  }
}
