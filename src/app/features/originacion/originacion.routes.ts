import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { BandejaDecisionPage } from './bandeja-decision/bandeja-decision.page';
import { BandejaEndososPage } from './endosos/bandeja-endosos.page';
import { DetalleEndosoPage } from './endosos/detalle-endoso.page';
import { DetalleSolicitudPage } from './bandeja-decision/detalle-solicitud.page';
import { EmisionesPage } from './emisiones/emisiones.page';
import { MisSolicitudesPage } from './endosos/mis-solicitudes.page';
import { SolicitarModificacionPage } from './endosos/solicitar-modificacion.page';
import { SolicitudModificacionPage } from './endosos/solicitud-modificacion.page';
import { DatosClientePage } from './cotizacion-asistida/datos-cliente.page';
import { FormalizarCompraPage } from './cotizacion-asistida/formalizar-compra.page';
import { ResultadoCotizacionPage } from './cotizacion-asistida/resultado-cotizacion.page';
import { DetallePolizaPage } from './polizas/detalle-poliza.page';
import { MisPolizasPage } from './polizas/mis-polizas.page';
import { HistorialEndososPage } from './polizas/historial-endosos.page';
import { PolizasPorVencerPage } from './renovaciones/polizas-por-vencer.page';
import { RenovacionAsistidaPage } from './renovaciones/renovacion-asistida.page';
import { RenovarPolizaPage } from './renovaciones/renovar-poliza.page';

/**
 * Originación y ciclo de vida de la póliza (portal). Todas las rutas cuelgan del shell del portal, que exige
 * sesión; el rol se restringe aquí y la URL nunca lo lleva. Hoy: la cotización asistida del asesor
 * (HU-W1.1-01; `nueva` va antes de `:id` para que no se tome como identificador) y la formalización de la compra
 * (HU-W1.1-03, `:id/formalizar`) y la bandeja de decisión humana
 * del asesor (HU-W1.1-02), el monitoreo de emisiones y excepciones de operaciones (HU-W1.3-04), para el asegurado,
 * sus pólizas (A1) y la renovación en línea (HU-W1.5-02, `polizas/:id/renovar`) y, para el asesor, las pólizas próximas
 * a vencer (HU-W1.5-01, `renovaciones`) y su renovación asistida con recotización (HU-W1.5-03, `renovaciones/:id`, el
 * `policy_id`). Para el asegurado, la solicitud de modificación de una póliza (HU-W1.4-01, `polizas/:id/modificar`), sus
 * solicitudes (`solicitudes`) y el detalle de cada una (`solicitudes/:id`). Para operaciones, la bandeja de endosos
 * (HU-W1.4-02, `endosos`), el detalle de cada solicitud (`endosos/:id`) y el historial de endosos de una póliza
 * (`polizas/:id/endosos`, declarado antes del bloque `polizas` del asegurado para que lo resuelva primero).
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
    path: 'polizas/:id/endosos',
    canActivate: [rolGuard('operaciones')],
    component: HistorialEndososPage,
  },
  {
    path: 'polizas',
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: '', component: MisPolizasPage },
      { path: ':id/renovar', component: RenovarPolizaPage },
      { path: ':id/modificar', component: SolicitarModificacionPage },
      { path: ':id', component: DetallePolizaPage },
    ],
  },
  {
    path: 'solicitudes',
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: '', component: MisSolicitudesPage },
      { path: ':id', component: SolicitudModificacionPage },
    ],
  },
  {
    path: 'endosos',
    canActivateChild: [rolGuard('operaciones')],
    children: [
      { path: '', component: BandejaEndososPage },
      { path: ':id', component: DetalleEndosoPage },
    ],
  },
  {
    path: 'emisiones',
    canActivateChild: [rolGuard('operaciones')],
    children: [{ path: '', component: EmisionesPage }],
  },
  {
    path: 'renovaciones',
    canActivateChild: [rolGuard('asesor')],
    children: [
      { path: '', component: PolizasPorVencerPage },
      { path: ':id', component: RenovacionAsistidaPage },
    ],
  },
];
