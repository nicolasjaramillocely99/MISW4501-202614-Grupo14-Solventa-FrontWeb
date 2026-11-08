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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCircleAlert,
  LucideInfo,
  LucideRefreshCw,
  LucideTriangleAlert,
} from '@lucide/angular';
import { Observable, finalize } from 'rxjs';

import {
  AsignacionSiniestro,
  CampoInvalido,
  Candidato,
  CodigoErrorAsignacion,
  ErrorAsignacion,
  PoliticaAsignacion,
  Prestador,
  SolicitudUbicacion,
} from '@core/api/siniestros/asignacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../modelos/catalogo-siniestros';
import { AsignacionConfirmadaComponent } from './componentes/asignacion-confirmada/asignacion-confirmada.component';
import { ConfirmarAsignacionComponent } from './componentes/confirmar-asignacion/confirmar-asignacion.component';
import { MapaAsignacionComponent } from './componentes/mapa-asignacion/mapa-asignacion.component';
import { RegistroIntentosComponent } from './componentes/registro-intentos/registro-intentos.component';
import { TablaCandidatosComponent } from './componentes/tabla-candidatos/tabla-candidatos.component';
import { UbicacionIncidenteComponent } from './componentes/ubicacion-incidente/ubicacion-incidente.component';
import { Coordenadas, MarcadorMapa } from './modelos/mapa';
import {
  accionesDisponibles,
  fechaLocal,
  formatearCoordenadas,
  nombreEspecialidad,
  nombreMotivo,
} from './modelos/presentacion-asignacion';

export type FaseAsignacion = 'cargando' | 'listo' | 'noEncontrado' | 'error';
type Accion = 'buscar' | 'ampliar' | 'reintentar' | 'asignar' | 'ubicar';

/** Cada cuánto se vuelve a leer el caso mientras el correo al prestador no sale, y cuántas veces como máximo (S9). */
export const INTERVALO_AVISO_MS = 5000;
export const MAXIMO_LECTURAS_AVISO = 12;

/** Errores tras los que se vuelve a leer el caso: otro analista o el reintento automático cambiaron la asignación. */
const RELEER: readonly CodigoErrorAsignacion[] = [
  'provider_unavailable',
  'search_outdated',
  'assignment_exists',
  'claim_not_assignable',
  'location_from_app',
  'location_missing',
];

/** Códigos con texto propio en `siniestros.asignacion.errores`. */
const CON_TEXTO: readonly CodigoErrorAsignacion[] = [
  ...RELEER,
  'provider_not_eligible',
  'validation_failed',
  'claims_unavailable',
];

/**
 * O7 · Asignación del prestador más cercano y O7b · Prestador no encontrado (HU-W2.3-01). Una sola página con los
 * estados del contrato:
 *
 * - **CA-1:** con coordenadas de la app, el mapa y su precisión; sin ellas (`location_missing`), la dirección y el pin
 *   del mapa (`UbicacionIncidenteComponent`, sin geocodificador). La del analista se puede corregir antes de asignar.
 * - **CA-2 y CA-3:** «Buscar prestador» y la tabla de candidatos con la especialidad requerida, el sugerido (el más
 *   cercano) y por qué los demás no se asignan.
 * - **CA-4:** «Ampliar radio de búsqueda» con el radio siguiente de la política y el «Registro de intentos».
 * - **CA-5:** «Asignar» (el sugerido o cualquier `eligible`) con confirmación; luego el prestador asignado y el estado
 *   del correo que le avisa, que la página sigue mientras está pendiente.
 * - **CA-6:** «Pendiente de asignación» con el motivo, los intentos y «Reintentar búsqueda»; el backend repite la
 *   búsqueda cada 5 min y la página no sondea: «Actualizar estado» la vuelve a leer.
 *
 * El front no calcula distancias ni elegibilidad (D7): pinta lo que devolvió el backend. Ruta:
 * `/siniestros/:id/asignar-prestador` (solo operaciones).
 */
@Component({
  selector: 'app-asignacion-prestador-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    MapaAsignacionComponent,
    UbicacionIncidenteComponent,
    TablaCandidatosComponent,
    RegistroIntentosComponent,
    AsignacionConfirmadaComponent,
    ConfirmarAsignacionComponent,
    FormatoFechaHoraPipe,
    LucideArrowLeft,
    LucideCheck,
    LucideCircleAlert,
    LucideInfo,
    LucideRefreshCw,
    LucideTriangleAlert,
  ],
  templateUrl: './asignacion-prestador.page.html',
  styleUrl: './asignacion-prestador.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsignacionPrestadorPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(SiniestrosApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly confirmacion = viewChild(ConfirmarAsignacionComponent);
  private seguimiento: ReturnType<typeof setTimeout> | null = null;
  private lecturasAviso = 0;

  protected readonly id = signal('');
  protected readonly fase = signal<FaseAsignacion>('cargando');
  protected readonly asignacion = signal<AsignacionSiniestro | null>(null);
  protected readonly politica = signal<PoliticaAsignacion | null>(null);
  /** El registro de la especialidad, solo para ubicar a los candidatos en el mapa (S1); `null` si no se leyó. */
  protected readonly prestadores = signal<Prestador[] | null>(null);
  protected readonly accion = signal<Accion | null>(null);
  protected readonly errorAccion = signal<CodigoErrorAsignacion | null>(null);
  protected readonly erroresUbicacion = signal<readonly CampoInvalido[]>([]);
  protected readonly corrigiendo = signal(false);
  protected readonly pinEdicion = signal<Coordenadas | null>(null);
  protected readonly avisoDetenido = signal(false);
  protected readonly hoy = fechaLocal(new Date());

  protected readonly acciones = computed(() => {
    const a = this.asignacion();
    return a ? accionesDisponibles(a, this.politica()) : null;
  });
  protected readonly busqueda = computed(() => this.asignacion()?.ultimaBusqueda ?? null);
  /** Formulario de la ubicación: sin coordenadas, o al corregir la que registró el analista. */
  protected readonly ubicando = computed(
    () => this.asignacion()?.estado === 'location_missing' || this.corrigiendo(),
  );
  protected readonly conMapa = computed(() => {
    const estado = this.asignacion()?.estado;
    return !!estado && estado !== 'not_required' && estado !== 'not_applicable';
  });
  protected readonly incidenteMapa = computed<Coordenadas | null>(() => {
    if (this.ubicando()) {
      return this.pinEdicion();
    }
    const u = this.asignacion()?.ubicacion;
    return u ? { latitud: u.latitud, longitud: u.longitud } : null;
  });
  protected readonly radioMapa = computed(() =>
    this.ubicando() ? null : (this.busqueda()?.radioKm ?? this.politica()?.radioInicialKm ?? null),
  );
  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const prestadores = this.prestadores();
    const a = this.asignacion();
    if (!prestadores || !a || this.ubicando()) {
      return [];
    }
    const porId = new Map(prestadores.map((p) => [p.id, p]));
    const numero = new Intl.NumberFormat(this.transloco.getActiveLang(), {
      maximumFractionDigits: 1,
    });
    if (a.asignacion) {
      const p = porId.get(a.asignacion.prestador.id);
      return p
        ? [
            {
              id: p.id,
              latitud: p.latitud,
              longitud: p.longitud,
              tipo: 'asignado',
              etiqueta: `${p.nombre} · ${numero.format(a.asignacion.distanciaKm)} km`,
            },
          ]
        : [];
    }
    return (a.ultimaBusqueda?.candidatos ?? []).flatMap((c) => {
      const p = porId.get(c.prestadorId);
      return p
        ? [
            {
              id: p.id,
              latitud: p.latitud,
              longitud: p.longitud,
              tipo: 'candidato' as const,
              etiqueta: `${c.nombre} · ${numero.format(c.distanciaKm)} km`,
            },
          ]
        : [];
    });
  });

  constructor() {
    this.destruccion.onDestroy(() => this.detenerSeguimiento());
  }

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.api
      .consultarPoliticaAsignacion()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (politica) => this.politica.set(politica),
        error: () => this.politica.set(null),
      });
    this.cargar();
  }

  /** Vuelve a leer la asignación («Reintentar», «Actualizar estado», «Actualizar»). */
  protected cargar(): void {
    this.detenerSeguimiento();
    this.lecturasAviso = 0;
    this.avisoDetenido.set(false);
    if (!this.asignacion()) {
      this.fase.set('cargando');
    }
    this.leer();
  }

  protected buscar(): void {
    this.ejecutar('buscar', this.api.buscarPrestador(this.id()));
  }

  protected reintentar(): void {
    this.ejecutar('reintentar', this.api.buscarPrestador(this.id()));
  }

  protected ampliar(): void {
    const radio = this.acciones()?.ampliar.radio;
    if (radio) {
      this.ejecutar('ampliar', this.api.buscarPrestador(this.id(), radio));
    }
  }

  protected pedirAsignacion(candidato: Candidato): void {
    this.errorAccion.set(null);
    this.confirmacion()?.abrir(candidato);
  }

  protected asignar(candidato: Candidato): void {
    const busqueda = this.busqueda();
    if (busqueda) {
      this.ejecutar(
        'asignar',
        this.api.asignarPrestador(this.id(), candidato.prestadorId, busqueda.secuencia),
      );
    }
  }

  protected guardarUbicacion(solicitud: SolicitudUbicacion): void {
    this.ejecutar('ubicar', this.api.registrarUbicacionIncidente(this.id(), solicitud));
  }

  protected corregirUbicacion(): void {
    const u = this.asignacion()?.ubicacion;
    this.pinEdicion.set(u ? { latitud: u.latitud, longitud: u.longitud } : null);
    this.erroresUbicacion.set([]);
    this.corrigiendo.set(true);
  }

  protected cancelarCorreccion(): void {
    this.corrigiendo.set(false);
    this.pinEdicion.set(null);
  }

  protected subtitulo(t: Traductor, a: AsignacionSiniestro): string {
    const partes = [
      a.especialidad ? t('asignacion.subtitulo.visita') : '',
      nombreRamo(t, a.linea, null),
      nombreTipo(t, a.tipoSiniestro, undefined, 'corto').toLowerCase(),
      a.ubicacion
        ? t(
            a.ubicacion.fuente === 'app'
              ? 'asignacion.subtitulo.app'
              : 'asignacion.subtitulo.analista',
          )
        : t('asignacion.subtitulo.sinUbicacion'),
      a.estado === 'pending_assignment' ? t('asignacion.subtitulo.agotada') : '',
    ];
    return partes.filter((p) => p !== '').join(' · ');
  }

  protected coordenadas(t: Traductor, latitud: number, longitud: number): string {
    return formatearCoordenadas(t, latitud, longitud, this.transloco.getActiveLang());
  }

  protected especialidad(t: Traductor, codigo: string | null): string {
    return codigo ? nombreEspecialidad(t, codigo).toLowerCase() : '';
  }

  /** Clave bajo `siniestros.asignacion.errores`; los códigos sin texto propio usan el genérico. */
  protected claveError(codigo: CodigoErrorAsignacion): string {
    return CON_TEXTO.includes(codigo) ? codigo : 'generico';
  }

  /** «5 km», o «20 km (máximo)» en el radio máximo de la política. */
  protected textoRadio(t: Traductor): string {
    const radio = this.busqueda()?.radioKm ?? this.politica()?.radioInicialKm;
    if (radio === undefined) {
      return '—';
    }
    const maximo = radio === this.politica()?.radioMaximoKm;
    return t(maximo ? 'asignacion.ubicacion.radioMaximo' : 'asignacion.ubicacion.radioValor', {
      radio,
    });
  }

  protected ayudaRadio(t: Traductor, a: AsignacionSiniestro): string {
    if (a.estado !== 'pending_assignment') {
      return t('asignacion.ubicacion.ayudaRadio');
    }
    const intentos = a.ultimaBusqueda?.intentos.length ?? 0;
    return intentos === 1
      ? t('asignacion.ubicacion.ayudaRadioMaximoUno')
      : t('asignacion.ubicacion.ayudaRadioMaximo', { intentos });
  }

  /** Parámetros del aviso de O7b: los radios intentados («5, 10 y 20»), la especialidad, el motivo y los minutos. */
  protected pendiente(t: Traductor, a: AsignacionSiniestro): Record<string, unknown> {
    const busqueda = a.ultimaBusqueda;
    const lista = new Intl.ListFormat(this.transloco.getActiveLang(), { type: 'conjunction' });
    const politica = this.politica();
    return {
      radios: lista.format((busqueda?.intentos ?? []).map((i) => String(i.radioKm))),
      especialidad: this.especialidad(t, a.especialidad),
      motivo: nombreMotivo(t, busqueda?.motivo ?? null),
      minutos: politica ? Math.round(politica.intervaloReintentoSegundos / 60) : null,
    };
  }

  private ejecutar(accion: Accion, peticion: Observable<AsignacionSiniestro>): void {
    if (this.accion()) {
      return;
    }
    this.accion.set(accion);
    this.errorAccion.set(null);
    this.erroresUbicacion.set([]);
    peticion
      .pipe(
        finalize(() => this.accion.set(null)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (asignacion) => {
          this.confirmacion()?.cerrar();
          if (accion === 'ubicar') {
            this.corrigiendo.set(false);
            this.pinEdicion.set(null);
          }
          this.mostrar(asignacion);
        },
        error: (error: unknown) => this.alFallar(accion, error),
      });
  }

  private alFallar(accion: Accion, error: unknown): void {
    const codigo = error instanceof ErrorAsignacion ? error.codigo : 'claims_unavailable';
    this.confirmacion()?.cerrar();
    if (codigo === 'validation_failed' && accion === 'ubicar' && error instanceof ErrorAsignacion) {
      this.erroresUbicacion.set(error.campos);
      return;
    }
    this.errorAccion.set(codigo);
    if (RELEER.includes(codigo)) {
      this.corrigiendo.set(false);
      this.cargar();
    }
  }

  private leer(): void {
    this.api
      .consultarAsignacion(this.id())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (asignacion) => this.mostrar(asignacion),
        error: (error: unknown) => {
          const codigo = error instanceof ErrorAsignacion ? error.codigo : 'claims_unavailable';
          if (codigo === 'claim_not_found') {
            this.fase.set('noEncontrado');
          } else {
            this.fase.set(this.asignacion() ? 'listo' : 'error');
          }
        },
      });
  }

  private mostrar(asignacion: AsignacionSiniestro): void {
    this.asignacion.set(asignacion);
    this.fase.set('listo');
    this.leerPrestadores(asignacion.especialidad);
    this.seguirAviso(asignacion);
  }

  /** Coordenadas de los prestadores de la especialidad para el mapa; si fallan, el mapa queda sin ellos (S1). */
  private leerPrestadores(especialidad: string | null): void {
    if (!especialidad || this.prestadores() !== null) {
      return;
    }
    this.api
      .listarPrestadores({ especialidad })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (prestadores) => this.prestadores.set(prestadores),
        error: () => this.prestadores.set([]),
      });
  }

  /** Mientras el correo al prestador está pendiente, vuelve a leer el caso hasta que salga o se agote el seguimiento. */
  private seguirAviso(asignacion: AsignacionSiniestro): void {
    this.detenerSeguimiento();
    if (asignacion.asignacion?.aviso.estado !== 'pending') {
      return;
    }
    if (this.lecturasAviso >= MAXIMO_LECTURAS_AVISO) {
      this.avisoDetenido.set(true);
      return;
    }
    this.lecturasAviso++;
    this.seguimiento = setTimeout(() => this.leer(), INTERVALO_AVISO_MS);
  }

  private detenerSeguimiento(): void {
    if (this.seguimiento !== null) {
      clearTimeout(this.seguimiento);
      this.seguimiento = null;
    }
  }
}
