import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { BusquedaRegistroPage } from './registro/busqueda-registro.page';
import { RegistroAuditoriaPage } from './registro/registro-auditoria.page';

/**
 * Auditoría y consentimientos (portal). Todas las rutas cuelgan del shell del portal, que exige sesión; el rol se
 * restringe aquí y la URL nunca lo lleva. Hoy: la búsqueda y el registro de auditoría de las decisiones de
 * suscripción (HU-W4.1-01), solo para el analista de operaciones.
 */
export const AUDITORIA_ROUTES: Routes = [
  {
    path: 'registro',
    canActivateChild: [rolGuard('operaciones')],
    children: [
      { path: '', component: BusquedaRegistroPage },
      { path: ':id', component: RegistroAuditoriaPage },
    ],
  },
];
