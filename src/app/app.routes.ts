import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'acceso',
    loadChildren: () => import('@features/acceso/acceso.routes').then((m) => m.ACCESO_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'acceso/iniciar-sesion' },
  { path: '**', redirectTo: '' },
];
