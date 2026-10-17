import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { BandejaDecisionPage } from './bandeja-decision/bandeja-decision.page';
import { DatosClientePage } from './cotizacion-asistida/datos-cliente.page';
import { ResultadoCotizacionPage } from './cotizacion-asistida/resultado-cotizacion.page';

/**
 * Originación y ciclo de vida de la póliza (portal). Todas las rutas cuelgan del shell del portal, que exige
 * sesión; el rol se restringe aquí y la URL nunca lo lleva. Hoy: la cotización asistida del asesor
 * (HU-W1.1-01; `nueva` va antes de `:id` para que no se tome como identificador) y la bandeja de decisión humana
 * del asesor (HU-W1.1-02).
 */
export const ORIGINACION_ROUTES: Routes = [
  {
    path: 'cotizaciones',
    canActivateChild: [rolGuard('asesor')],
    children: [
      { path: 'nueva', component: DatosClientePage },
      { path: ':id', component: ResultadoCotizacionPage },
    ],
  },
  {
    path: 'bandeja-decision',
    canActivateChild: [rolGuard('asesor')],
    children: [{ path: '', component: BandejaDecisionPage }],
  },
];
