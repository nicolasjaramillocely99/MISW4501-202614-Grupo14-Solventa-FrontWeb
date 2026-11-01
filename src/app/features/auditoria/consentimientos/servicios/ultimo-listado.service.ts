import { Injectable, signal } from '@angular/core';
import { Params } from '@angular/router';

/**
 * Parámetros del último listado de consentimientos que vio el analista (HU-W4.2-01), para que «Volver» del detalle (O15)
 * regrese al mismo filtro y a la misma página. Si se abre el detalle con un enlace directo, «Volver» lleva al listado sin
 * filtro.
 */
@Injectable({ providedIn: 'root' })
export class UltimoListadoService {
  private readonly ultimo = signal<Params>({});

  /** Los parámetros de la URL del listado, tal como quedaron. */
  readonly parametros = this.ultimo.asReadonly();

  guardar(parametros: Params): void {
    this.ultimo.set({ ...parametros });
  }
}
