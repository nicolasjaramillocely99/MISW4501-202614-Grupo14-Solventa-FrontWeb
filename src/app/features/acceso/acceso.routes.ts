import { Routes } from '@angular/router';

import { IniciarSesionPage } from './iniciar-sesion.page';
import { NoAutorizadoPage } from './no-autorizado.page';
import { SesionExpiradaPage } from './sesion-expirada.page';

/** Acceso al portal (HA-S01): rutas públicas, sin shell. */
export const ACCESO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'iniciar-sesion' },
  { path: 'iniciar-sesion', component: IniciarSesionPage },
  { path: 'no-autorizado', component: NoAutorizadoPage },
  { path: 'sesion-expirada', component: SesionExpiradaPage },
];
