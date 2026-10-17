import { InjectionToken } from '@angular/core';

/**
 * Destinos de las acciones del paso de pago (HA-D02). «Intentar con otro medio de pago» (frame E4b) no se
 * muestra hasta que exista el ingreso del medio de pago (E4, HU-W1.3-02).
 */
export interface AccionesPago {
  /**
   * «Ver mi póliza» con el pago confirmado: la póliza emitida (E5, HU-W1.3-03). Se le agrega el `policy_id` que
   * devuelve el cobro.
   */
  verPoliza: string;
  /** «Continuar con mi crédito»: salir del flujo del seguro. */
  salir: string;
  /** «Ver el estado de tu aceptación»: vuelve al paso 3 cuando la aceptación aún no tiene cobro. */
  verAceptacion: string;
}

export const ACCIONES_PAGO = new InjectionToken<AccionesPago>('ACCIONES_PAGO', {
  factory: () => ({ verPoliza: '/embebido/poliza-emitida', salir: '/inicio', verAceptacion: '/embebido/oferta' }),
});
