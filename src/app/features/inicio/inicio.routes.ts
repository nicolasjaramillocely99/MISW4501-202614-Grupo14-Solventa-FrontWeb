import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { InicioPage } from './inicio.page';

/** Inicio por rol (HA-S01): `/inicio` para los cuatro roles humanos; el contenido depende del rol. */
export const INICIO_ROUTES: Routes = [
  {
    path: '',
    component: InicioPage,
    canActivate: [rolGuard('asegurado', 'asesor', 'operaciones', 'socio')],
  },
];
