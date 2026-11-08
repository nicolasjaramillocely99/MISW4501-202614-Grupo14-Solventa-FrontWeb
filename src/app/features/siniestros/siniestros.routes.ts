import { Routes } from '@angular/router';

import { rolGuard } from '@core/auth/guards/rol.guard';

import { CasosEvaluacionPage } from './evaluacion/casos-evaluacion.page';
import { EvaluacionSiniestroPage } from './evaluacion/evaluacion-siniestro.page';
import { RadicacionSiniestroPage } from './radicacion/radicacion-siniestro.page';
import { RadicacionesRevisionPage } from './revision/radicaciones-revision.page';
import { RevisionRadicacionPage } from './revision/revision-radicacion.page';
import { DetalleSiniestroPage } from './seguimiento/detalle-siniestro.page';
import { MisSiniestrosPage } from './seguimiento/mis-siniestros.page';
import { ColaSiniestrosPage } from './triage/cola-siniestros.page';
import { PrioridadSiniestroPage } from './triage/prioridad-siniestro.page';

/**
 * Atención y resolución de siniestros (portal). Todas las rutas cuelgan del shell del portal, que exige sesión; el rol
 * se restringe aquí y la URL nunca lo lleva. Hoy: la radicación con soportes del asegurado (HU-W2.1-01; la confirmación
 * A6b es un estado de `radicar`, con `?caso=`), «Mis siniestros» en su versión mínima (A7), la prioridad automática del
 * siniestro (HU-W2.2-01): la cola y la prioridad del analista de operaciones y el detalle mínimo del asegurado (A8), y
 * la evaluación, aprobación y pago (HU-W2.2-03): los casos en evaluación del analista y la evaluación de un caso (O6
 * y O6b), y la revisión del asesor (HU-W2.1-03): las radicaciones por revisar y la revisión de una (S8).
 *
 * El orden importa: los grupos de operaciones (`cola`, `evaluacion` y `:id/evaluar`) y del asesor (`revision`) van antes del grupo del asegurado
 * y `:id` va después de `radicar` y `mis-siniestros`; si no, `:id` capturaría `cola` y el guard del asegurado
 * rechazaría al analista.
 */
export const SINIESTROS_ROUTES: Routes = [
  {
    path: 'cola',
    canActivateChild: [rolGuard('operaciones')],
    children: [
      { path: '', component: ColaSiniestrosPage },
      { path: ':id', component: PrioridadSiniestroPage },
    ],
  },
  {
    path: 'evaluacion',
    canActivate: [rolGuard('operaciones')],
    component: CasosEvaluacionPage,
  },
  {
    path: ':id/evaluar',
    canActivate: [rolGuard('operaciones')],
    component: EvaluacionSiniestroPage,
  },
  {
    path: 'revision',
    canActivateChild: [rolGuard('asesor')],
    children: [
      { path: '', component: RadicacionesRevisionPage },
      { path: ':id', component: RevisionRadicacionPage },
    ],
  },
  // Entrada del menú cuya historia todavía no existe: las asistencias de operaciones (HU-W2.3-03). Lleva al inicio del
  // rol, como las demás rutas pendientes; sin esto `:id` la captura y el guard del asegurado muestra «acceso no
  // autorizado».
  { path: 'asistencias', redirectTo: '/inicio', pathMatch: 'prefix' },
  {
    path: '',
    canActivateChild: [rolGuard('asegurado')],
    children: [
      { path: 'radicar', component: RadicacionSiniestroPage },
      { path: 'mis-siniestros', component: MisSiniestrosPage },
      { path: ':id', component: DetalleSiniestroPage },
    ],
  },
];
