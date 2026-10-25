import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucidePaperclip, LucideUpload, LucideX } from '@lucide/angular';

import { RequisitoSoporte } from '@core/api/siniestros/radicacion.modelos';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreSoporte } from '../../../modelos/catalogo-siniestros';
import { ProblemaSoporte, aceptaArchivos, problemaSoporte } from '../../modelos/formulario-radicacion';
import { ArchivoSoporte, MotivoRechazo } from '../../servicios/carga-soportes.service';

/** Estado de la fila de un soporte; la clave va bajo `siniestros.radicacion.soportes.estado`. */
type EstadoFila = 'adjunto' | 'falta' | 'pocos' | 'subiendo' | 'opcional';

const TONO: Readonly<Record<EstadoFila, TonoInsignia>> = {
  adjunto: 'exito',
  falta: 'error',
  pocos: 'advertencia',
  subiendo: 'informacion',
  opcional: 'neutro',
};

/** Motivo de rechazo → clave bajo `siniestros.radicacion.soportes.rechazo`. */
const CLAVE_RECHAZO: Readonly<Record<MotivoRechazo, string>> = {
  file_too_large: 'muyGrande',
  unsupported_file_type: 'formatoNoAdmitido',
  empty_file: 'vacio',
  too_many_pending_supports: 'demasiadosPendientes',
  supports_unavailable: 'noDisponible',
  invalid_request: 'invalido',
  limite: 'limite',
};

export interface AgregarArchivos {
  requisito: RequisitoSoporte;
  archivos: File[];
}

export interface QuitarArchivo {
  codigo: string;
  clave: number;
}

/**
 * Tarjeta «Soportes» de A6 (HU-W2.1-01): una fila por soporte del tipo elegido (obligatorio u opcional, mínimo y
 * formatos) con su estado en texto («Adjunto · 6 archivos», «Falta») y la acción de subir; los soportes de otros tipos
 * de la póliza aparecen como «No aplica», sin acción (S6). Cada archivo muestra si está subiendo, adjunto o rechazado
 * con su motivo (CA-5). Es presentacional: la página decide qué hacer con `agregar` y `quitar`.
 */
@Component({
  selector: 'app-soportes-radicacion',
  imports: [
    TranslocoDirective,
    InsigniaEstadoComponent,
    LucideCircleCheck,
    LucideCircleAlert,
    LucidePaperclip,
    LucideUpload,
    LucideX,
  ],
  templateUrl: './soportes-radicacion.component.html',
  styleUrl: './soportes-radicacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoportesRadicacionComponent {
  private readonly transloco = inject(TranslocoService);

  readonly requisitos = input.required<readonly RequisitoSoporte[]>();
  readonly noAplica = input<readonly RequisitoSoporte[]>([]);
  readonly archivos = input<Readonly<Record<string, readonly ArchivoSoporte[]>>>({});
  /** Problemas que devolvió el backend (`422 validation_failed`) por código de requisito. */
  readonly erroresServidor = input<Readonly<Record<string, ProblemaSoporte>>>({});
  readonly deshabilitado = input(false);

  readonly agregar = output<AgregarArchivos>();
  readonly quitar = output<QuitarArchivo>();

  protected readonly obligatorios = computed(() => this.requisitos().filter((requisito) => requisito.obligatorio));
  protected readonly obligatoriosAdjuntos = computed(
    () => this.obligatorios().filter((requisito) => this.adjuntos(requisito.codigo) > 0).length,
  );

  protected readonly aceptaArchivos = aceptaArchivos;

  protected lista(codigo: string): readonly ArchivoSoporte[] {
    return this.archivos()[codigo] ?? [];
  }

  protected adjuntos(codigo: string): number {
    return this.lista(codigo).filter((archivo) => archivo.estado === 'adjunto').length;
  }

  /** Archivos que ocupan cupo (adjuntos o subiendo). */
  protected ocupados(codigo: string): number {
    return this.lista(codigo).filter((archivo) => archivo.estado !== 'rechazado').length;
  }

  protected estado(requisito: RequisitoSoporte): EstadoFila {
    if (this.lista(requisito.codigo).some((archivo) => archivo.estado === 'subiendo')) {
      return 'subiendo';
    }
    const problema = problemaSoporte(requisito, this.adjuntos(requisito.codigo));
    if (problema === 'falta' || problema === 'pocos') {
      return problema;
    }
    return this.adjuntos(requisito.codigo) > 0 ? 'adjunto' : 'opcional';
  }

  /** Clave del texto del estado: con un solo archivo, «Adjunto» sin el conteo (como en el prototipo). */
  protected claveEstado(requisito: RequisitoSoporte): string {
    const estado = this.estado(requisito);
    return estado === 'adjunto' && this.adjuntos(requisito.codigo) === 1 ? 'adjuntoUno' : estado;
  }

  protected tono(requisito: RequisitoSoporte): TonoInsignia {
    return TONO[this.estado(requisito)];
  }

  protected nombre(t: Traductor, requisito: RequisitoSoporte): string {
    return nombreSoporte(t, requisito.codigo, requisito.etiqueta);
  }

  /** «Fotos del vehículo (mínimo 4)»: el mínimo solo se menciona cuando es más de uno. */
  protected titulo(t: Traductor, requisito: RequisitoSoporte): string {
    const nombre = this.nombre(t, requisito);
    return requisito.minArchivos > 1 ? t('radicacion.soportes.conMinimo', { nombre, minimo: requisito.minArchivos }) : nombre;
  }

  /** «Obligatorio · JPG o PNG · máx. 10 MB c/u». */
  protected detalle(t: Traductor, requisito: RequisitoSoporte): string {
    const formatos = requisito.formatos.includes('pdf')
      ? requisito.formatos.length > 1
        ? 'documento'
        : 'pdf'
      : 'imagen';
    return t('radicacion.soportes.detalle', {
      obligatoriedad: t(`radicacion.soportes.${requisito.obligatorio ? 'obligatorio' : 'opcional'}`),
      formatos: t(`radicacion.soportes.formatos.${formatos}`),
      maximo: requisito.maxArchivos,
    });
  }

  /** «Subir» sin archivos, «Agregar» por debajo del máximo; en el máximo la acción se deshabilita. */
  protected accion(requisito: RequisitoSoporte): 'subir' | 'agregar' {
    return this.ocupados(requisito.codigo) > 0 ? 'agregar' : 'subir';
  }

  protected claveRechazo(motivo: MotivoRechazo | null): string {
    return CLAVE_RECHAZO[motivo ?? 'supports_unavailable'];
  }

  protected lleno(requisito: RequisitoSoporte): boolean {
    return this.ocupados(requisito.codigo) >= requisito.maxArchivos;
  }

  protected elegir(requisito: RequisitoSoporte, entrada: HTMLInputElement): void {
    const archivos = Array.from(entrada.files ?? []);
    // Se limpia para que elegir otra vez el mismo archivo vuelva a disparar el cambio.
    entrada.value = '';
    if (archivos.length > 0) {
      this.agregar.emit({ requisito, archivos });
    }
  }

  /** Tamaño legible: «482 KB» o «2,4 MB» en el idioma activo. */
  protected tamano(bytes: number): string {
    const formato = new Intl.NumberFormat(this.transloco.getActiveLang(), { maximumFractionDigits: 1 });
    return bytes < 1024 * 1024
      ? `${formato.format(Math.max(1, Math.ceil(bytes / 1024)))} KB`
      : `${formato.format(bytes / (1024 * 1024))} MB`;
  }
}
