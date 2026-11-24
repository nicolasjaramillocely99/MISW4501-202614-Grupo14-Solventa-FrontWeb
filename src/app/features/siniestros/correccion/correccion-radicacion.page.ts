import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideInfo,
  LucideSend,
  LucideTriangleAlert,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { forkJoin } from 'rxjs';

import {
  ErrorReenvio,
  HistorialSiniestro,
  ResultadoReenvio,
} from '@core/api/siniestros/reenvio.modelos';
import { Revision } from '@core/api/siniestros/revision.modelos';
import { DetalleSiniestro, ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import {
  InsigniaEstadoComponent,
  TonoInsignia,
} from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreSoporte, nombreTipo } from '../modelos/catalogo-siniestros';
import { aceptaArchivos } from '../radicacion/modelos/formulario-radicacion';
import {
  ArchivoSoporte,
  CargaSoportesService,
} from '../radicacion/servicios/carga-soportes.service';
import {
  CampoHecho,
  DATO_DE_CAMPO,
  ErroresServidor,
  EstadoFilaCorreccion,
  FilaCorreccion,
  HechosCorregidos,
  ProblemaHecho,
  aSolicitudReenvio,
  erroresDelServidor,
  filasCorreccion,
  hechosDe,
  problemasHechos,
  requisitoParaSubir,
} from './modelos/correccion-radicacion';

type Fase = 'cargando' | 'listo' | 'noDevuelto' | 'noEncontrado' | 'error' | 'enviado';

/** Error del reenvío que no es de un campo; la clave va bajo `siniestros.correccion.errores`. */
type ErrorAccion = 'stale_return' | 'claim_not_returned' | 'claims_unavailable' | 'invalid_request';

const TONO: Readonly<Record<EstadoFilaCorreccion, TonoInsignia>> = {
  reemplazar: 'error',
  falta: 'error',
  pocos: 'advertencia',
  corregido: 'informacion',
  adjunto: 'exito',
  opcional: 'neutro',
};

/** Una copia del registro sin la clave: el problema que el servidor señaló se borra al corregirlo. */
function sin<T extends object>(registro: T, clave: string): T {
  const copia = { ...registro } as Record<string, unknown>;
  delete copia[clave];
  return copia as T;
}

/** Una etapa de «Historial de la radicación», de la más antigua a la más nueva. */
interface EtapaHistorial {
  tipo: 'radicado' | 'devuelto' | 'aprobado' | 'reenviado';
  en: string;
  quien: string | null;
  detalle: string | null;
}

/**
 * A9 · Edición de la radicación devuelta (HU-W2.1-04). El asegurado ve el motivo de la devolución, los datos que
 * radicó y los soportes con lo que pidió el asesor (CA-1); corrige los datos habilitados y reemplaza, sube o agrega
 * soportes sin perder el resto (CA-2); antes de reenviar ve todo lo que aún falta (CA-3) y, al reenviar, el caso
 * vuelve a revisión con el mismo número (CA-4). Cada reenvío queda en el historial (CA-5).
 *
 * Lee el caso (`GET /v1/claims/{id}`) y su historial (`GET /v1/claims/{id}/history`) en paralelo; los archivos nuevos
 * se suben uno a uno, igual que en la radicación (HU-W2.1-01). Ruta `/siniestros/:id/corregir`, rol asegurado.
 */
@Component({
  selector: 'app-correccion-radicacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    InsigniaEstadoComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideInfo,
    LucideSend,
    LucideTriangleAlert,
    LucideUpload,
    LucideX,
  ],
  providers: [CargaSoportesService],
  templateUrl: './correccion-radicacion.page.html',
  styleUrl: './correccion-radicacion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorreccionRadicacionPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);
  protected readonly carga = inject(CargaSoportesService);

  protected readonly id = this.ruta.snapshot.paramMap.get('id') ?? '';
  private readonly resumenFaltantes = viewChild<ElementRef<HTMLElement>>('resumenFaltantes');

  protected readonly fase = signal<Fase>('cargando');
  protected readonly caso = signal<DetalleSiniestro | null>(null);
  protected readonly historial = signal<HistorialSiniestro | null>(null);
  private original: HechosCorregidos = {
    ocurridoEn: '',
    lugar: '',
    descripcion: '',
    montoEstimado: '',
  };
  protected readonly hechos = signal<HechosCorregidos>(this.original);
  /** Después del primer intento de reenviar se muestran todos los problemas, no solo los de lo que se tocó. */
  protected readonly intentado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroresServidor = signal<ErroresServidor>({
    hechos: {},
    soportes: {},
    general: false,
  });
  protected readonly errorAccion = signal<ErrorAccion | null>(null);
  protected readonly resultado = signal<ResultadoReenvio | null>(null);

  protected readonly campos: readonly CampoHecho[] = [
    'ocurridoEn',
    'lugar',
    'descripcion',
    'montoEstimado',
  ];

  protected readonly devolucion = computed<Revision | null>(
    () => this.historial()?.ultimaDevolucion ?? null,
  );

  protected readonly filas = computed<FilaCorreccion[]>(() => {
    const caso = this.caso();
    const historial = this.historial();
    if (!caso || !historial) {
      return [];
    }
    return filasCorreccion(historial.requisitos, this.devolucion(), caso, this.carga.adjuntos());
  });

  protected readonly pendientes = computed(() => this.filas().filter((fila) => fila.pendiente));

  /** Problemas de los hechos: los del navegador y, si no hay, los que devolvió el servidor. */
  protected readonly problemas = computed<Partial<Record<CampoHecho, ProblemaHecho>>>(() => {
    const caso = this.caso();
    if (!caso) {
      return {};
    }
    const locales = problemasHechos(
      this.hechos(),
      caso,
      this.devolucion()?.datosACorregir ?? [],
      new Date(),
    );
    return { ...this.erroresServidor().hechos, ...locales };
  });

  protected readonly faltan = computed(
    () => this.pendientes().length > 0 || Object.keys(this.problemas()).length > 0,
  );

  protected readonly historia = computed<EtapaHistorial[]>(() => {
    const caso = this.caso();
    const historial = this.historial();
    if (!caso || !historial) {
      return [];
    }
    const etapas: EtapaHistorial[] = [
      { tipo: 'radicado', en: caso.radicadoEn, quien: null, detalle: caso.canal },
    ];
    for (const r of historial.revisiones) {
      etapas.push({
        tipo: r.resultado === 'returned' ? 'devuelto' : 'aprobado',
        en: r.revisadaEn,
        quien: r.nombreRevisor,
        detalle: null,
      });
    }
    for (const r of historial.reenvios) {
      etapas.push({ tipo: 'reenviado', en: r.reenviadoEn, quien: null, detalle: null });
    }
    return etapas.sort((a, b) => Date.parse(a.en) - Date.parse(b.en));
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    forkJoin({
      caso: this.api.consultarSiniestro(this.id),
      historial: this.api.consultarHistorial(this.id),
    })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ caso, historial }) => {
          this.caso.set(caso);
          this.historial.set(historial);
          this.original = hechosDe(caso);
          this.hechos.set(this.original);
          this.fase.set(
            historial.estado === 'returned' && historial.ultimaDevolucion ? 'listo' : 'noDevuelto',
          );
        },
        error: (error: unknown) =>
          this.fase.set(this.esNoEncontrado(error) ? 'noEncontrado' : 'error'),
      });
  }

  private esNoEncontrado(error: unknown): boolean {
    return (
      (error instanceof ErrorReenvio || error instanceof ErrorSiniestro) &&
      error.codigo === 'claim_not_found'
    );
  }

  protected editar(campo: CampoHecho, evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.hechos.update((actual) => ({ ...actual, [campo]: valor }));
    this.erroresServidor.update((e) => ({ ...e, hechos: sin(e.hechos, campo) }));
  }

  protected pedido(campo: CampoHecho): boolean {
    return this.devolucion()?.datosACorregir.includes(DATO_DE_CAMPO[campo]) ?? false;
  }

  protected problemaVisible(campo: CampoHecho): ProblemaHecho | null {
    const problema = this.problemas()[campo] ?? null;
    if (!problema) {
      return null;
    }
    return this.intentado() || this.hechos()[campo] !== this.original[campo] ? problema : null;
  }

  protected elegirArchivos(fila: FilaCorreccion, evento: Event): void {
    const control = evento.target as HTMLInputElement;
    const archivos = Array.from(control.files ?? []);
    control.value = '';
    if (archivos.length > 0) {
      this.carga.agregar(requisitoParaSubir(fila), archivos);
      this.erroresServidor.update((e) => ({
        ...e,
        soportes: sin(e.soportes, fila.requisito.codigo),
      }));
    }
  }

  protected quitar(codigo: string, archivo: ArchivoSoporte): void {
    this.carga.quitar(codigo, archivo.clave);
  }

  protected archivosNuevos(codigo: string): readonly ArchivoSoporte[] {
    return this.carga.archivos()[codigo] ?? [];
  }

  protected acepta(fila: FilaCorreccion): string {
    return aceptaArchivos(fila.requisito);
  }

  protected tono(estado: EstadoFilaCorreccion): TonoInsignia {
    return TONO[estado];
  }

  /** El problema de un soporte: el del servidor si lo hay; si no, el del estado de la fila cuando falta algo. */
  protected problemaSoporte(fila: FilaCorreccion): string | null {
    const delServidor = this.erroresServidor().soportes[fila.requisito.codigo];
    if (delServidor) {
      return delServidor;
    }
    return this.intentado() && fila.pendiente ? fila.estado : null;
  }

  protected reenviar(): void {
    this.intentado.set(true);
    this.errorAccion.set(null);
    const devolucion = this.devolucion();
    if (!devolucion || this.carga.subiendo() || this.enviando()) {
      return;
    }
    if (this.faltan()) {
      queueMicrotask(() => this.resumenFaltantes()?.nativeElement.focus());
      return;
    }
    this.enviando.set(true);
    const solicitud = aSolicitudReenvio(
      devolucion,
      this.original,
      this.hechos(),
      this.filas(),
      this.carga.soporteIds(),
    );
    this.api
      .reenviarRadicacion(this.id, solicitud)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (resultado) => {
          this.enviando.set(false);
          this.resultado.set(resultado);
          this.fase.set('enviado');
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.manejarError(error);
        },
      });
  }

  private manejarError(error: unknown): void {
    const codigo = error instanceof ErrorReenvio ? error.codigo : 'claims_unavailable';
    switch (codigo) {
      case 'validation_failed': {
        const errores = erroresDelServidor(error instanceof ErrorReenvio ? error.campos : []);
        this.erroresServidor.set(errores);
        if (errores.general) {
          this.errorAccion.set('invalid_request');
        }
        queueMicrotask(() => this.resumenFaltantes()?.nativeElement.focus());
        return;
      }
      case 'claim_not_found':
        this.fase.set('noEncontrado');
        return;
      default:
        this.errorAccion.set(codigo);
    }
  }

  protected nombreSoporte(t: Traductor, fila: FilaCorreccion): string {
    return nombreSoporte(t, fila.requisito.codigo, fila.requisito.etiqueta);
  }

  /** «Autos · AU-2025-118204 · KJT-482», o solo el número de la póliza si el caso no guardó su ramo. */
  protected poliza(t: Traductor, caso: DetalleSiniestro): string {
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    return [ramo, caso.poliza.id, caso.poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }

  protected tipo(t: Traductor, caso: DetalleSiniestro): string {
    return nombreTipo(t, caso.tipoSiniestro);
  }
}
