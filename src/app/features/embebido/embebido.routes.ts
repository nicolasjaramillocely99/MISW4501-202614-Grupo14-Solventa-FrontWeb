import { Routes } from '@angular/router';

import { PerfilRiesgoPage } from './perfil-riesgo/perfil-riesgo.page';

/**
 * Canal embebido (demo en el sitio del banco aliado). Rutas públicas: el socio autentica con credenciales
 * de API en el gateway, no con Cognito. Cuelgan del shell `layout/embebido` en `app.routes.ts`.
 */
export const EMBEBIDO_ROUTES: Routes = [
  { path: 'perfil-riesgo/:clienteId', component: PerfilRiesgoPage },
];
