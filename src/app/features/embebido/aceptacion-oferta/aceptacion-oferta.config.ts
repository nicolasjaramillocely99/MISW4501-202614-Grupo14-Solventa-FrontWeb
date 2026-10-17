import { InjectionToken } from '@angular/core';

import { DetalleOferta } from './modelos/detalle-oferta';
import { DETALLE_OFERTA_PROVISIONAL } from './modelos/detalle-oferta.provisional';

/** Destinos de las acciones de la pantalla que el contrato de HU-W1.3-01 no resuelve. */
export interface AccionesAceptacionOferta {
  /**
   * «Generar una nueva oferta» y «Volver a cotizar». El endpoint para generar ofertas está pendiente
   * (HU-W1.2-03, contrato §5.3): mientras tanto se vuelve al inicio del flujo de cotización.
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

/** Contenido de la oferta. Hoy son datos de prueba provisionales (ver `detalle-oferta.provisional.ts`). */
export const DETALLE_OFERTA = new InjectionToken<DetalleOferta>('DETALLE_OFERTA', {
  factory: () => DETALLE_OFERTA_PROVISIONAL,
});
