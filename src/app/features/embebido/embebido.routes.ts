import { Routes } from '@angular/router';

import { autenticacionGuard } from '@core/auth/guards/autenticacion.guard';
import { rolGuard } from '@core/auth/guards/rol.guard';

import { AceptacionOfertaPage } from './aceptacion-oferta/aceptacion-oferta.page';
import { ConsentimientoPage } from './consentimiento/consentimiento.page';
import { PagoPage } from './pago/pago.page';
import { PerfilRiesgoPage } from './perfil-riesgo/perfil-riesgo.page';
import { PolizaEmitidaPage } from './poliza-emitida/poliza-emitida.page';

/**
 * Canal embebido (demo en el sitio del banco aliado). Rutas públicas: el socio autentica con credenciales
 * de API en el gateway, no con Cognito. Cuelgan del shell `layout/embebido` en `app.routes.ts`.
 *
 * Excepción: aceptar la oferta (HU-W1.3-01) exige el ID token de un asegurado dueño de la oferta (contrato
 * §2.1), así que `oferta` pide sesión. El rol se valida en los hijos para que corra después de recuperar la
 * sesión al recargar. Lo mismo para `pago` (HA-D02): el estado del cobro solo lo consulta el asegurado dueño de
 * la aceptación.
 */
export const EMBEBIDO_ROUTES: Routes = [
  // Paso 1 (HU-W1.2-01): público. El aliado entrega el contexto del cliente y del crédito en `?contexto=`.
  { path: 'consentimiento', component: ConsentimientoPage },
  { path: 'perfil-riesgo/:clienteId', component: PerfilRiesgoPage },
  {
    path: 'oferta',
    canActivate: [autenticacionGuard],
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: '', component: AceptacionOfertaPage },
      { path: ':ofertaId', component: AceptacionOfertaPage },
    ],
  },
  // Póliza emitida (HU-W1.3-03): el backend solo deja leer la póliza a su dueño, así que también pide un asegurado.
  {
    path: 'poliza-emitida/:polizaId',
    canActivate: [autenticacionGuard],
    canActivateChild: [rolGuard('asegurado')],
    children: [{ path: '', component: PolizaEmitidaPage }],
  },
  {
    path: 'pago',
    canActivate: [autenticacionGuard],
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: '', component: PagoPage },
      { path: ':aceptacionId', component: PagoPage },
    ],
  },
];
