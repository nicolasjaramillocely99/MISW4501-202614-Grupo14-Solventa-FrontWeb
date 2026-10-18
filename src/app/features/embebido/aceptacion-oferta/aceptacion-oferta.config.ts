import { InjectionToken } from '@angular/core';

/** Destinos de las acciones de la pantalla que el contrato de HU-W1.3-01 no resuelve. */
export interface AccionesAceptacionOferta {
  /**
   * Respaldo de «Generar una nueva oferta» y «Volver a cotizar»: el paso de consentimiento. La renovación
   * (`POST /v1/offers/{id}/renewal`, HU-W1.2-03) la resuelve la página; se llega aquí cuando el backend pide un
   * consentimiento nuevo o cuando la oferta no se puede renovar (p. ej. una de demostración vencida).
   */
  nuevaOferta: string;
  /** «No me interesa», «No, gracias» y «Continuar con mi crédito»: salir del flujo del seguro. */
  salir: string;
  /**
   * «Ver el estado de tu pago» tras aprobarse la suscripción: el paso de pago (E4b, HA-D02). Se le agrega el
   * identificador de la aceptación.
   */
  pago: string;
  /**
   * «Ver la nueva oferta» de una solicitud ajustada por el asesor (E6b, HU-W1.1-02): esta misma página con la
   * oferta ajustada. Se le agrega el identificador de la oferta.
   */
  oferta: string;
}

export const ACCIONES_ACEPTACION_OFERTA = new InjectionToken<AccionesAceptacionOferta>(
  'ACCIONES_ACEPTACION_OFERTA',
  {
    factory: () => ({
      nuevaOferta: '/embebido/consentimiento',
      salir: '/inicio',
      pago: '/embebido/pago',
      oferta: '/embebido/oferta',
    }),
  },
);
