import { Injectable, signal } from '@angular/core';

import { EstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';

/**
 * Último estado que encontró la búsqueda, para que el detalle (O15) lo muestre sin pedirlo de nuevo. Si se abre el enlace
 * directo o se recarga, O15 lo consulta por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class EstadoConsultadoService {
  private readonly ultimo = signal<EstadoRevocacion | null>(null);

  guardar(estado: EstadoRevocacion): void {
    this.ultimo.set(estado);
  }

  /** El estado guardado si es el de ese consentimiento; `null` en otro caso. */
  de(consentimientoId: string): EstadoRevocacion | null {
    const estado = this.ultimo();
    return estado?.consentimientoId === consentimientoId ? estado : null;
  }
}
