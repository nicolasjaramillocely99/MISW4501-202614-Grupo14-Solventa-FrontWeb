import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { BandejaDecisionPage } from './bandeja-decision/bandeja-decision.page';
import { DetalleSolicitudPage } from './bandeja-decision/detalle-solicitud.page';
import { EmisionesPage } from './emisiones/emisiones.page';
import { DatosClientePage } from './cotizacion-asistida/datos-cliente.page';
import { FormalizarCompraPage } from './cotizacion-asistida/formalizar-compra.page';
import { ResultadoCotizacionPage } from './cotizacion-asistida/resultado-cotizacion.page';
import { MisPolizasPage } from './polizas/mis-polizas.page';
import { RenovarPolizaPage } from './renovaciones/renovar-poliza.page';

/**
 * Originación y ciclo de vida de la póliza (portal). Todas las rutas cuelgan del shell del portal, que exige
 * sesión; el rol se restringe aquí y la URL nunca lo lleva. Hoy: la cotización asistida del asesor
 * (HU-W1.1-01; `nueva` va antes de `:id` para que no se tome como identificador) y la formalización de la compra
 * (HU-W1.1-03, `:id/formalizar`) y la bandeja de decisión humana
 * del asesor (HU-W1.1-02), el monitoreo de emisiones y excepciones de operaciones (HU-W1.3-04) y, para el asegurado,
 * sus pólizas (A1) y la renovación en línea (HU-W1.5-02, `polizas/:id/renovar`).
 */
export const ORIGINACION_ROUTES: Routes = [
  {
    path: 'cotizaciones',
    canActivateChild: [rolGuard('asesor')],
    children: [
      { path: 'nueva', component: DatosClientePage },
      { path: ':id', component: ResultadoCotizacionPage },
      { path: ':id/formalizar', component: FormalizarCompraPage },
    ],
  },
  {
    path: 'bandeja-decision',
    canActivateChild: [rolGuard('asesor')],
    children: [
      { path: '', component: BandejaDecisionPage },
      { path: ':aceptacionId', component: DetalleSolicitudPage },
    ],
  },
  {
    path: 'polizas',
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: '', component: MisPolizasPage },
      { path: ':id/renovar', component: RenovarPolizaPage },
    ],
  },
  {
    path: 'emisiones',
    canActivateChild: [rolGuard('operaciones')],
    children: [{ path: '', component: EmisionesPage }],
  },
];
