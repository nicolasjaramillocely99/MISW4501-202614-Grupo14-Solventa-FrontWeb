import { Injectable, signal } from '@angular/core';

import { TipoDecision } from '@core/api/originacion/aceptacion.modelos';

/** Decisión recién registrada que la bandeja anuncia al volver del detalle (S4b). */
export interface AvisoDecision {
  aceptacionId: string;
  /** Nombre del solicitante, para el texto «La decisión de … quedó registrada». */
  solicitante: string;
  tipo: TipoDecision;
}

/**
 * Lleva el aviso «Decisión registrada» (S4b) del detalle de la solicitud a la bandeja. El detalle lo publica tras el
 * `201` del registro y la bandeja lo consume una sola vez al abrirse, así que recargar la bandeja ya no lo muestra.
 */
@Injectable({ providedIn: 'root' })
export class AvisoDecisionService {
  private readonly pendiente = signal<AvisoDecision | null>(null);

  publicar(aviso: AvisoDecision): void {
    this.pendiente.set(aviso);
  }

  /** Devuelve el aviso pendiente y lo borra. */
  consumir(): AvisoDecision | null {
    const aviso = this.pendiente();
    this.pendiente.set(null);
    return aviso;
  }
}
