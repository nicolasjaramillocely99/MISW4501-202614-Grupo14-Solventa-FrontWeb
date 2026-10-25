import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { RadicacionSiniestroPage } from './radicacion/radicacion-siniestro.page';
import { MisSiniestrosPage } from './seguimiento/mis-siniestros.page';

/**
 * Atención y resolución de siniestros (portal). Todas las rutas cuelgan del shell del portal, que exige sesión; el rol
 * se restringe aquí y la URL nunca lo lleva. Hoy: la radicación con soportes del asegurado (HU-W2.1-01; la confirmación
 * A6b es un estado de `radicar`, con `?caso=`) y «Mis siniestros» en su versión mínima (A7).
 */
export const SINIESTROS_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: 'radicar', component: RadicacionSiniestroPage },
      { path: 'mis-siniestros', component: MisSiniestrosPage },
    ],
  },
];
