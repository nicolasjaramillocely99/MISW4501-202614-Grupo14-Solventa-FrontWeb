import { Injectable, signal } from '@angular/core';

import { RegistroDecision } from '@core/api/auditoria/decision.modelos';

/**
 * Último registro que encontró la búsqueda (O12), para que la pantalla del registro (O13) lo muestre sin pedirlo de
 * nuevo. Es solo lectura: no se modifica. Si se abre el enlace directo o se recarga, O13 lo consulta por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class RegistroConsultadoService {
  private readonly ultimo = signal<RegistroDecision | null>(null);

  guardar(registro: RegistroDecision): void {
    this.ultimo.set(registro);
  }

  /** El registro guardado si es el de esa oferta; `null` en otro caso. */
  de(ofertaId: string): RegistroDecision | null {
    const registro = this.ultimo();
    return registro?.ofertaId === ofertaId ? registro : null;
  }
}
