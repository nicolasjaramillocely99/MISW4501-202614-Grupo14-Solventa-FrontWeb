import { Injectable, signal } from '@angular/core';

import { PerfilRiesgo } from '@core/api/originacion/perfil-riesgo.modelos';

/** Datos del crédito que el canal del aliado entrega al flujo (tarjeta «Tu crédito»). */
export interface SolicitudCredito {
  numero: string;
  aliado: string;
  banco: string;
  montoAprobado: number;
  plazoAnios: number;
  cuotaEstimada: number;
  /** Código ISO 4217 (COP, MXN, CLP, PEN). */
  moneda: string;
}

/**
 * Estado compartido entre las pantallas del canal embebido. El consentimiento (HU-W1.2-01) deja aquí la
 * solicitud; el perfil de riesgo (HU-W1.2-02) publica el perfil resuelto para que la oferta
 * (HU-W1.2-03) lo consuma. Vive en memoria: no persiste datos del cliente en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class FlujoEmbebidoService {
  /** Crédito en curso; `null` mientras la pantalla anterior no lo haya entregado. */
  readonly solicitud = signal<SolicitudCredito | null>(null);
  /** Perfil de riesgo resuelto en el paso 2. */
  readonly perfil = signal<PerfilRiesgo | null>(null);
}
