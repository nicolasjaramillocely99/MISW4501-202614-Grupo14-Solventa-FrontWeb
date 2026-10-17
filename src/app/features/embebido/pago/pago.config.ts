import { InjectionToken } from '@angular/core';

/**
 * Destinos de las acciones del paso de pago (HA-D02). «Intentar con otro medio de pago» (frame E4b) no se
 * muestra hasta que exista el ingreso del medio de pago (E4, HU-W1.3-02). «Ver mi póliza» (E5, HU-W1.3-03) se
 * agrega cuando la pantalla de la póliza emitida esté en `develop` (PR #16 del front).
 */
export interface AccionesPago {
  /** «Continuar con mi crédito»: salir del flujo del seguro. */
  salir: string;
  /** «Ver el estado de tu aceptación»: vuelve al paso 3 cuando la aceptación aún no tiene cobro. */
  verAceptacion: string;
}

export const ACCIONES_PAGO = new InjectionToken<AccionesPago>('ACCIONES_PAGO', {
  factory: () => ({ salir: '/inicio', verAceptacion: '/embebido/oferta' }),
});
