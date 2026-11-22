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
  LucideCircleCheck,
  LucideImage,
  LucidePhone,
} from '@lucide/angular';
import { Observable, finalize } from 'rxjs';

import { CampoInvalido } from '@core/api/siniestros/asignacion.modelos';
import {
  CodigoErrorIntervencion,
  ErrorIntervencion,
  Intervencion,
  PASOS_INTERVENCION,
  PasoIntervencion,
  PasoRegistrado,
  SolicitudAvance,
  SolicitudCierreCaso,
} from '@core/api/siniestros/intervencion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreTipo } from '../modelos/catalogo-siniestros';
import { tonoEstado } from '../modelos/estado-siniestro';
import { CerrarCasoComponent } from './componentes/cerrar-caso/cerrar-caso.component';
import { RegistrarAvanceComponent } from './componentes/registrar-avance/registrar-avance.component';

export type FaseIntervencion = 'cargando' | 'listo' | 'noEncontrado' | 'error';
type Accion = 'avance' | 'cierre';

/** Una fila de la línea de tiempo: la asignación y los cinco pasos, hechos, el siguiente o pendientes. */
export interface FilaLinea {
  clave: 'assigned' | PasoIntervencion;
  numero: number;
  estado: 'hecha' | 'actual' | 'pendiente';
  registro: PasoRegistrado | null;
}

/** Errores tras los que se vuelve a leer la intervención: otro analista la cambió. */
const RELEER: readonly CodigoErrorIntervencion[] = [
  'step_out_of_order',
  'case_closed',
  'not_assigned',
  'intervention_not_finished',
];

/** Códigos con texto propio en `siniestros.intervencion.errores`. */
const CON_TEXTO: readonly CodigoErrorIntervencion[] = [
  'step_out_of_order',
  'case_closed',
  'not_assigned',
  'claims_unavailable',
];

/** Cuántos recuadros de foto muestra la tarjeta del informe, como en el prototipo. */
const MAXIMO_FOTOS = 4;

/**
 * O8 · Seguimiento de la intervención y cierre del caso (HU-W2.3-02). Una sola página con los estados del contrato:
 *
 * - **CA-1:** «Registrar avance» en el paso siguiente abre el diálogo con la fecha y hora y la observación (en la
 *   visita, también el informe); la línea de tiempo se actualiza con la respuesta, sin recargar.
 * - **CA-2:** la línea de tiempo en orden cronológico, desde la asignación, con quién registró cada paso, y la tarjeta
 *   «Informe del prestador».
 * - **CA-3 y CA-4:** «Cerrar caso» abre el diálogo del cierre; si el prestador no ha terminado, el diálogo dice qué
 *   pasos faltan y no deja cerrar.
 * - **CA-5:** el cierre muestra el resultado y el analista responsable; el estado del siniestro no cambia.
 *
 * Las tarjetas laterales muestran el prestador y el siniestro (claims no guarda el contacto de la asegurada). Ruta:
 * `/siniestros/:id/seguimiento` (solo operaciones).
 */
@Component({
  selector: 'app-seguimiento-intervencion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    RegistrarAvanceComponent,
    CerrarCasoComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowLeft,
    LucideCheck,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideImage,
    LucidePhone,
  ],
  templateUrl: './seguimiento-intervencion.page.html',
  styleUrl: './seguimiento-intervencion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeguimientoIntervencionPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(SiniestrosApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly dialogoAvance = viewChild(RegistrarAvanceComponent);
  private readonly dialogoCierre = viewChild(CerrarCasoComponent);

  protected readonly id = signal('');
  protected readonly fase = signal<FaseIntervencion>('cargando');
  protected readonly intervencion = signal<Intervencion | null>(null);
  protected readonly accion = signal<Accion | null>(null);
  protected readonly errorAccion = signal<CodigoErrorIntervencion | null>(null);
  protected readonly erroresAvance = signal<readonly CampoInvalido[]>([]);
  protected readonly erroresCierre = signal<readonly CampoInvalido[]>([]);
  /** Lo que falta para cerrar: lo que dijo el backend al leer, o el `409` de un cierre. */
  protected readonly faltantes = signal<readonly PasoIntervencion[]>([]);

  protected readonly filas = computed<FilaLinea[]>(() => {
    const i = this.intervencion();
    if (!i?.asignacion) {
      return [];
    }
    const filas: FilaLinea[] = [{ clave: 'assigned', numero: 1, estado: 'hecha', registro: null }];
    PASOS_INTERVENCION.forEach((paso, indice) => {
      const registro = i.pasos.find((p) => p.paso === paso) ?? null;
      const estado = registro ? 'hecha' : paso === i.pasoSiguiente ? 'actual' : 'pendiente';
      filas.push({ clave: paso, numero: indice + 2, estado, registro });
    });
    return filas;
  });

  protected readonly fotos = computed(() => {
    const total = this.intervencion()?.informe?.fotos ?? 0;
    return Array.from({ length: Math.min(total, MAXIMO_FOTOS) }, (_, i) => i + 1);
  });

  /** Enlace de «Contactar al prestador»: el teléfono si lo tiene, si no el correo. */
  protected readonly contacto = computed(() => {
    const p = this.intervencion()?.asignacion?.prestador;
    if (!p) {
      return null;
    }
    return p.telefono ? `tel:${p.telefono.replace(/\s/g, '')}` : `mailto:${p.correo}`;
  });

  protected readonly tonoEstado = tonoEstado;

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.cargar();
  }

  /** Vuelve a leer la intervención («Reintentar»). */
  protected cargar(): void {
    if (!this.intervencion()) {
      this.fase.set('cargando');
    }
    this.api
      .consultarIntervencion(this.id())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (intervencion) => this.mostrar(intervencion),
        error: (error: unknown) => {
          const codigo = error instanceof ErrorIntervencion ? error.codigo : 'claims_unavailable';
          if (codigo === 'claim_not_found') {
            this.fase.set('noEncontrado');
          } else {
            this.fase.set(this.intervencion() ? 'listo' : 'error');
          }
        },
      });
  }

  protected pedirAvance(paso: PasoIntervencion): void {
    this.errorAccion.set(null);
    this.erroresAvance.set([]);
    this.dialogoAvance()?.abrir(paso);
  }

  protected pedirCierre(): void {
    this.errorAccion.set(null);
    this.erroresCierre.set([]);
    this.dialogoCierre()?.abrir();
  }

  protected registrar(solicitud: SolicitudAvance): void {
    this.ejecutar('avance', this.api.registrarAvance(this.id(), solicitud));
  }

  protected cerrar(solicitud: SolicitudCierreCaso): void {
    this.ejecutar('cierre', this.api.cerrarCaso(this.id(), solicitud));
  }

  protected subtitulo(t: Traductor, i: Intervencion): string {
    const a = i.asignacion;
    if (!a) {
      return '';
    }
    const fecha = new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(a.asignadaEn));
    return t('intervencion.subtitulo', {
      prestador: a.prestador.nombre,
      fecha,
      tipo: nombreTipo(t, i.tipoSiniestro, undefined, 'corto').toLowerCase(),
    });
  }

  protected distancia(km: number): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang(), {
      maximumFractionDigits: 1,
    }).format(km);
  }

  protected analista(registro: { nombre: string | null; correo: string }): string {
    return registro.nombre ?? registro.correo;
  }

  /** Clave bajo `siniestros.intervencion.errores`; los códigos sin texto propio usan el genérico. */
  protected claveError(codigo: CodigoErrorIntervencion): string {
    return CON_TEXTO.includes(codigo) ? codigo : 'generico';
  }

  private ejecutar(accion: Accion, peticion: Observable<Intervencion>): void {
    if (this.accion()) {
      return;
    }
    this.accion.set(accion);
    this.errorAccion.set(null);
    peticion
      .pipe(
        finalize(() => this.accion.set(null)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (intervencion) => {
          this.dialogoAvance()?.cerrar();
          this.dialogoCierre()?.cerrar();
          this.mostrar(intervencion);
        },
        error: (error: unknown) => this.alFallar(accion, error),
      });
  }

  private alFallar(accion: Accion, error: unknown): void {
    const codigo = error instanceof ErrorIntervencion ? error.codigo : 'claims_unavailable';
    if (codigo === 'validation_failed' && error instanceof ErrorIntervencion) {
      (accion === 'avance' ? this.erroresAvance : this.erroresCierre).set(error.campos);
      return;
    }
    if (codigo === 'intervention_not_finished' && error instanceof ErrorIntervencion) {
      // El diálogo sigue abierto y ahora dice qué falta (CA-4).
      this.faltantes.set(error.faltantes);
      this.cargar();
      return;
    }
    this.dialogoAvance()?.cerrar();
    this.dialogoCierre()?.cerrar();
    this.errorAccion.set(codigo);
    if (RELEER.includes(codigo)) {
      this.cargar();
    }
  }

  private mostrar(intervencion: Intervencion): void {
    this.intervencion.set(intervencion);
    this.faltantes.set(intervencion.faltantes);
    this.fase.set('listo');
  }
}
