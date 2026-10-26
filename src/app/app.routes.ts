import { Routes } from '@angular/router';

import { autenticacionGuard } from '@core/auth/guards/autenticacion.guard';

/**
 * Rutas raíz. `acceso` es público y sin shell; `embebido` es público con su propio shell; todo lo demás vive dentro del shell del portal, protegido
 * por sesión (los dominios restringen el rol con `rolGuard`). Una ruta que no existe lleva al inicio del rol.
 */
export const routes: Routes = [
  {
    path: 'acceso',
    loadChildren: () => import('@features/acceso/acceso.routes').then((m) => m.ACCESO_ROUTES),
  },
  {
    path: 'embebido',
    loadComponent: () =>
      import('@layout/embebido/embebido-shell.component').then((m) => m.EmbebidoShellComponent),
    loadChildren: () => import('@features/embebido/embebido.routes').then((m) => m.EMBEBIDO_ROUTES),
  },
  {
    path: '',
    loadComponent: () =>
      import('@layout/portal/portal-shell.component').then((m) => m.PortalShellComponent),
    canActivate: [autenticacionGuard],
    canActivateChild: [autenticacionGuard],
    children: [
      {
        path: 'inicio',
        loadChildren: () => import('@features/inicio/inicio.routes').then((m) => m.INICIO_ROUTES),
      },
      {
        path: 'auditoria',
        loadChildren: () => import('@features/auditoria/auditoria.routes').then((m) => m.AUDITORIA_ROUTES),
      },
      {
        path: 'originacion',
        loadChildren: () => import('@features/originacion/originacion.routes').then((m) => m.ORIGINACION_ROUTES),
      },
      {
        path: 'siniestros',
        loadChildren: () => import('@features/siniestros/siniestros.routes').then((m) => m.SINIESTROS_ROUTES),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },
  { path: '**', redirectTo: '' },
];
