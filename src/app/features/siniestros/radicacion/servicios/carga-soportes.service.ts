import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, concatMap, map, of } from 'rxjs';

import { CodigoErrorSoporte, ErrorSoporte, RequisitoSoporte } from '@core/api/siniestros/radicacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { validarArchivo } from '../modelos/formulario-radicacion';

/** Por qué no se adjuntó un archivo: el código del contrato o `limite` (el soporte ya tiene su máximo). */
export type MotivoRechazo = CodigoErrorSoporte | 'limite';

/** Un archivo elegido para un soporte y su estado. */
export interface ArchivoSoporte {
  /** Identificador local, estable mientras el archivo esté en la lista. */
  clave: number;
  nombre: string;
  tamanoBytes: number;
  estado: 'subiendo' | 'adjunto' | 'rechazado';
  /** El `support_id` del backend, solo cuando está adjunto. */
  soporteId: string | null;
  motivo: MotivoRechazo | null;
}

interface Tarea {
  codigo: string;
  clave: number;
  archivo: File;
  generacion: number;
}

type Resultado = { tarea: Tarea; soporteId: string } | { tarea: Tarea; motivo: CodigoErrorSoporte };

/**
 * Soportes del formulario «Radicar un siniestro» (HU-W2.1-01). Se provee **en la página**: vive lo que vive el
 * formulario.
 *
 * - Cada archivo se prevalida (tamaño, vacío, formato) y, si pasa, se sube en cuanto se elige, **uno por petición y en
 *   secuencia** (S4). Un rechazo afecta solo a ese archivo: los demás y el formulario siguen intactos (CA-5).
 * - «Quitar» es local (S5): el contrato no tiene `DELETE` y el soporte queda pendiente en el servidor.
 */
@Injectable()
export class CargaSoportesService {
  private readonly api = inject(SiniestrosApiService);
  private readonly cola = new Subject<Tarea>();
  private siguienteClave = 1;
  /** Cambia al reiniciar, para descartar las respuestas de las subidas de un formulario anterior. */
  private generacion = 0;

  /** Archivos por código de requisito. */
  readonly archivos = signal<Readonly<Record<string, readonly ArchivoSoporte[]>>>({});

  /** Archivos adjuntos (ya subidos) por código de requisito. */
  readonly adjuntos = computed(() => this.contar((archivo) => archivo.estado === 'adjunto'));

  /** `support_id` de los adjuntos por código de requisito, en el orden en que se eligieron. */
  readonly soporteIds = computed(() => {
    const resultado: Record<string, string[]> = {};
    for (const [codigo, lista] of Object.entries(this.archivos())) {
      resultado[codigo] = lista.flatMap((archivo) => (archivo.soporteId ? [archivo.soporteId] : []));
    }
    return resultado;
  });

  /** Hay al menos una subida en curso: no se puede radicar todavía. */
  readonly subiendo = computed(() =>
    Object.values(this.archivos()).some((lista) => lista.some((archivo) => archivo.estado === 'subiendo')),
  );

  constructor() {
    this.cola
      .pipe(
        concatMap((tarea) =>
          this.api.subirSoporte(tarea.archivo).pipe(
            map((soporte): Resultado => ({ tarea, soporteId: soporte.id })),
            catchError((error: unknown) =>
              of<Resultado>({
                tarea,
                motivo: error instanceof ErrorSoporte ? error.codigo : 'supports_unavailable',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => this.aplicar(resultado));
  }

  /**
   * Agrega los archivos elegidos para un soporte. Los que no caben (ya hay `maxArchivos` adjuntos o subiendo) o no
   * pasan la prevalidación quedan como rechazados, con su motivo y sin petición.
   */
  agregar(requisito: RequisitoSoporte, elegidos: readonly File[]): void {
    const lista = [...(this.archivos()[requisito.codigo] ?? [])];
    const tareas: Tarea[] = [];
    let ocupados = lista.filter((archivo) => archivo.estado !== 'rechazado').length;
    for (const archivo of elegidos) {
      const clave = this.siguienteClave++;
      const motivo: MotivoRechazo | null =
        ocupados >= requisito.maxArchivos ? 'limite' : validarArchivo(archivo, requisito);
      lista.push({
        clave,
        nombre: archivo.name,
        tamanoBytes: archivo.size,
        estado: motivo ? 'rechazado' : 'subiendo',
        soporteId: null,
        motivo,
      });
      if (!motivo) {
        ocupados++;
        tareas.push({ codigo: requisito.codigo, clave, archivo, generacion: this.generacion });
      }
    }
    // Primero la lista y después la cola: una respuesta inmediata debe encontrar su archivo.
    this.archivos.update((actual) => ({ ...actual, [requisito.codigo]: lista }));
    tareas.forEach((tarea) => this.cola.next(tarea));
  }

  /** Quita un archivo de la lista (adjunto, rechazado o aún subiendo: su respuesta se descarta). */
  quitar(codigo: string, clave: number): void {
    this.archivos.update((actual) => ({
      ...actual,
      [codigo]: (actual[codigo] ?? []).filter((archivo) => archivo.clave !== clave),
    }));
  }

  /** Vacía la lista para un formulario nuevo; las subidas en curso se descartan al responder. */
  reiniciar(): void {
    this.generacion++;
    this.archivos.set({});
  }

  private aplicar(resultado: Resultado): void {
    const { tarea } = resultado;
    if (tarea.generacion !== this.generacion) {
      return;
    }
    this.archivos.update((actual) => {
      const lista = actual[tarea.codigo];
      if (!lista?.some((archivo) => archivo.clave === tarea.clave)) {
        return actual;
      }
      return {
        ...actual,
        [tarea.codigo]: lista.map((archivo) =>
          archivo.clave !== tarea.clave
            ? archivo
            : 'soporteId' in resultado
              ? { ...archivo, estado: 'adjunto', soporteId: resultado.soporteId }
              : { ...archivo, estado: 'rechazado', motivo: resultado.motivo },
        ),
      };
    });
  }

  private contar(condicion: (archivo: ArchivoSoporte) => boolean): Record<string, number> {
    const resultado: Record<string, number> = {};
    for (const [codigo, lista] of Object.entries(this.archivos())) {
      resultado[codigo] = lista.filter(condicion).length;
    }
    return resultado;
  }
}
