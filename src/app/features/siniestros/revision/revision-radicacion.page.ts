import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideInfo,
} from '@lucide/angular';
import { Observable, finalize } from 'rxjs';

import {
  CodigoErrorRevision,
  DATOS_CORREGIBLES,
  DatoCorregible,
  ErrorRevision,
  MAXIMO_MENSAJE,
  MOTIVOS_DEVOLUCION,
  MotivoDevolucion,
  RadicacionEnRevision,
  ResultadoRevision,
  Revision,
  SolicitudDevolucion,
} from '@core/api/siniestros/revision.modelos';
import { ResumenSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../modelos/catalogo-siniestros';
import { tonoEstado } from '../modelos/estado-siniestro';
import {
  CambioVeredicto,
  EntradaVeredicto,
  SoportesRevisionComponent,
} from './componentes/soportes-revision/soportes-revision.component';

export type FaseRevision = 'cargando' | 'listo' | 'noEncontrado' | 'error';

/** Lo que falta en el formulario de devolución antes de enviarlo. */
export interface ErroresDevolucion {
  motivo?: 'required';
  mensaje?: 'required' | 'too_long';
  pedido?: 'nothing_requested';
}

/**
 * S8 · Revisión de la radicación del siniestro (HU-W2.1-03).
 *
 * - **CA-1:** el asesor ve los datos reportados y los soportes adjuntos, con un veredicto por soporte: válido,
 *   ilegible (con una nota) o falta. Al lado, la póliza, la cobertura aplicable y los siniestros previos de la póliza.
 * - **CA-2:** «Aprobar y enviar a evaluación» deja el caso «En evaluación», y el triage le calcula la prioridad. Solo
 *   se aprueba si todo lo adjunto es válido y no falta nada: un soporte ilegible o faltante se devuelve.
 * - **CA-3:** «Devolución al cliente»: el motivo de la lista, el mensaje que lee el asegurado y los datos del hecho a
 *   corregir. El caso queda «Devuelto al cliente» y el asegurado lo corrige en A9 (HU-W2.1-04).
 *
 * Una radicación que ya no está pendiente (otro asesor se adelantó, o se abrió desde un enlace) se ve en solo lectura,
 * con su última revisión. Ruta: `/siniestros/revision/:id` (solo el asesor).
 */
@Component({
  selector: 'app-revision-radicacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    SoportesRevisionComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowLeft,
    LucideCheck,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideInfo,
  ],
  templateUrl: './revision-radicacion.page.html',
  styleUrl: './revision-radicacion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevisionRadicacionPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(SiniestrosApiService);
  private readonly destruccion = inject(DestroyRef);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly motivos = MOTIVOS_DEVOLUCION;
  protected readonly datosCorregibles = DATOS_CORREGIBLES;
  protected readonly maximoMensaje = MAXIMO_MENSAJE;
  protected readonly tonoEstado = tonoEstado;

  protected readonly id = signal('');
  protected readonly fase = signal<FaseRevision>('cargando');
  protected readonly radicacion = signal<RadicacionEnRevision | null>(null);
  protected readonly veredictos = signal<Readonly<Record<string, EntradaVeredicto>>>({});
  protected readonly motivo = signal<MotivoDevolucion | ''>('');
  protected readonly mensaje = signal('');
  protected readonly datos = signal<ReadonlySet<DatoCorregible>>(new Set());
  protected readonly enviando = signal(false);
  protected readonly errores = signal<ErroresDevolucion>({});
  /** Falla de la acción que no es de un campo. */
  protected readonly errorAccion = signal<CodigoErrorRevision | null>(null);
  /** La revisión que se acaba de registrar, para el aviso de éxito. */
  protected readonly resultado = signal<ResultadoRevision | null>(null);

  /** Solo una radicación pendiente (`active`) se revisa; las demás se ven en solo lectura. */
  protected readonly revisable = computed(() => this.radicacion()?.siniestro.estado === 'active');

  protected readonly ultimaRevision = computed<Revision | null>(
    () => this.radicacion()?.revisiones.at(-1) ?? null,
  );

  /** Aprobar = todo lo adjunto es válido y no falta nada: ni un requerido ni un opcional que se pidió. */
  protected readonly aprobable = computed(() => {
    const r = this.radicacion();
    if (!r || !this.revisable()) {
      return false;
    }
    return r.checklist.every((item) => {
      const v = this.veredictos()[item.codigoRequisito]?.veredicto ?? null;
      return v === 'valid' || v === null;
    });
  });

  /** Lo que la devolución le pide al asegurado: los soportes ilegibles o faltantes y los datos a corregir. */
  protected readonly pedido = computed(() => {
    const soportes = Object.entries(this.veredictos()).filter(
      ([, e]) => e.veredicto === 'illegible' || e.veredicto === 'missing',
    );
    return { soportes: soportes.length, datos: this.datos().size };
  });

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set(this.radicacion() ? this.fase() : 'cargando');
    this.api
      .consultarRevision(this.id())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (radicacion) => {
          this.radicacion.set(radicacion);
          this.veredictos.set(veredictosIniciales(radicacion));
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          const codigo = codigoDe(error);
          if (codigo === 'claim_not_found') {
            this.fase.set('noEncontrado');
          } else if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
            this.fase.set(this.radicacion() ? 'listo' : 'error');
          }
        },
      });
  }

  protected cambiarVeredicto(cambio: CambioVeredicto): void {
    this.veredictos.update((v) => ({
      ...v,
      [cambio.codigoRequisito]: { veredicto: cambio.veredicto, nota: cambio.nota },
    }));
    this.errores.update((e) => ({ ...e, pedido: undefined }));
  }

  protected elegirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLSelectElement).value as MotivoDevolucion | '');
    this.errores.update((e) => ({ ...e, motivo: undefined }));
  }

  protected escribirMensaje(evento: Event): void {
    this.mensaje.set((evento.target as HTMLTextAreaElement).value);
    this.errores.update((e) => ({ ...e, mensaje: undefined }));
  }

  protected alternarDato(dato: DatoCorregible, evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    this.datos.update((actual) => {
      const nuevo = new Set(actual);
      if (marcado) {
        nuevo.add(dato);
      } else {
        nuevo.delete(dato);
      }
      return nuevo;
    });
    this.errores.update((e) => ({ ...e, pedido: undefined }));
  }

  /** «Devolver al cliente» del encabezado lleva al formulario de devolución. */
  protected irADevolucion(): void {
    this.elemento.nativeElement.querySelector<HTMLElement>('#motivo-devolucion')?.focus();
  }

  protected aprobar(): void {
    if (!this.aprobable()) {
      return;
    }
    this.accion(this.api.aprobarRadicacion(this.id()));
  }

  protected devolver(): void {
    const errores = this.validar();
    this.errores.set(errores);
    if (Object.keys(errores).length > 0) {
      return;
    }
    const solicitud: SolicitudDevolucion = {
      motivo: this.motivo() as MotivoDevolucion,
      mensaje: this.mensaje(),
      soportes: this.soportesADevolver(),
      datosACorregir: this.datosCorregibles.filter((d) => this.datos().has(d)),
    };
    this.accion(this.api.devolverRadicacion(this.id(), solicitud));
  }

  protected resumen(t: Traductor, r: RadicacionEnRevision): string {
    const s = r.siniestro;
    return [
      nombreRamo(t, s.poliza.ramo, s.poliza.producto),
      s.poliza.id,
      nombreTipo(t, s.tipoSiniestro),
    ]
      .filter((p) => p !== '')
      .join(' · ');
  }

  protected tipo(t: Traductor, codigo: string): string {
    return nombreTipo(t, codigo, undefined, 'corto');
  }

  protected previo(t: Traductor, s: ResumenSiniestro): string {
    return t('revision.poliza.previo', {
      estado: t('estados.' + s.estado).toLowerCase(),
      tipo: this.tipo(t, s.tipoSiniestro).toLowerCase(),
      fecha: s.radicadoEn.slice(5, 7) + '/' + s.radicadoEn.slice(0, 4),
    });
  }

  /** Solo viajan los soportes que no sirven: lo adjunto que no se menciona queda válido en el backend. */
  private soportesADevolver(): SolicitudDevolucion['soportes'] {
    const r = this.radicacion();
    if (!r) {
      return [];
    }
    return r.checklist.flatMap((item): SolicitudDevolucion['soportes'] => {
      const e = this.veredictos()[item.codigoRequisito];
      if (e?.veredicto === 'illegible') {
        return [{ codigoRequisito: item.codigoRequisito, veredicto: e.veredicto, nota: e.nota }];
      }
      if (e?.veredicto === 'missing' && !item.requerido) {
        return [{ codigoRequisito: item.codigoRequisito, veredicto: e.veredicto }];
      }
      return [];
    });
  }

  private validar(): ErroresDevolucion {
    const errores: ErroresDevolucion = {};
    if (!this.motivo()) {
      errores.motivo = 'required';
    }
    const mensaje = this.mensaje().trim();
    if (!mensaje) {
      errores.mensaje = 'required';
    } else if ([...mensaje].length > MAXIMO_MENSAJE) {
      errores.mensaje = 'too_long';
    }
    const p = this.pedido();
    if (p.soportes === 0 && p.datos === 0) {
      errores.pedido = 'nothing_requested';
    }
    return errores;
  }

  private accion(peticion: Observable<ResultadoRevision>): void {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.errorAccion.set(null);
    peticion
      .pipe(
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (resultado) => {
          this.resultado.set(resultado);
          this.cargar();
        },
        error: (error: unknown) => this.alFallar(codigoDe(error)),
      });
  }

  private alFallar(codigo: CodigoErrorRevision): void {
    switch (codigo) {
      case 'message_required':
      case 'message_too_long':
        this.errores.set({ mensaje: codigo === 'message_required' ? 'required' : 'too_long' });
        break;
      case 'nothing_requested':
        this.errores.set({ pedido: 'nothing_requested' });
        break;
      case 'claim_not_reviewable':
        // Otro asesor se adelantó: se muestra lo que hay ahora con el aviso.
        this.errorAccion.set(codigo);
        this.cargar();
        break;
      case 'unauthorized':
      case 'forbidden':
        break;
      default:
        this.errorAccion.set(codigo);
    }
  }
}

/**
 * El veredicto con que abre cada fila: lo adjunto, válido; un requerido sin adjuntar, falta; un opcional sin adjuntar,
 * sin veredicto (el asesor puede pedirlo).
 */
export function veredictosIniciales(r: RadicacionEnRevision): Record<string, EntradaVeredicto> {
  const veredictos: Record<string, EntradaVeredicto> = {};
  for (const item of r.checklist) {
    if (item.archivos > 0) {
      veredictos[item.codigoRequisito] = { veredicto: 'valid', nota: '' };
    } else if (item.requerido) {
      veredictos[item.codigoRequisito] = { veredicto: 'missing', nota: '' };
    }
  }
  // Una radicación ya revisada muestra el veredicto que quedó registrado.
  const ultima = r.siniestro.estado === 'active' ? null : r.revisiones.at(-1);
  for (const s of ultima?.soportes ?? []) {
    veredictos[s.codigoRequisito] = { veredicto: s.veredicto, nota: s.nota ?? '' };
  }
  return veredictos;
}

function codigoDe(error: unknown): CodigoErrorRevision {
  return error instanceof ErrorRevision ? error.codigo : 'claims_unavailable';
}
