import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { DetalleSocioPage } from './gestion/detalle-socio.page';
import { ListadoSociosPage } from './gestion/listado-socios.page';

/**
 * Gestión B2B de socios comerciales (portal). Todas las rutas cuelgan del shell del portal, que exige sesión; el rol se
 * restringe aquí y la URL nunca lo lleva. Hoy: el listado de socios (O10) y el detalle con sus credenciales (O11) de
 * HU-W3.1-01, solo para el analista de operaciones. Las pantallas del socio (tablero, desempeño y credenciales vistas
 * por él) llegan con sus historias.
 */
export const SOCIOS_ROUTES: Routes = [
  // Pantallas del socio aún sin historia (B1, B3, B4): siguen llevando al inicio del rol, como antes de que existiera
  // `/socios/:id`, en lugar de caer en el detalle de operaciones.
  { path: 'tablero', redirectTo: '/inicio', pathMatch: 'prefix' },
  { path: 'credenciales', redirectTo: '/inicio', pathMatch: 'prefix' },
  {
    path: '',
    canActivateChild: [rolGuard('operaciones')],
    children: [
      { path: '', component: ListadoSociosPage },
      { path: ':id', component: DetalleSocioPage },
    ],
  },
];
