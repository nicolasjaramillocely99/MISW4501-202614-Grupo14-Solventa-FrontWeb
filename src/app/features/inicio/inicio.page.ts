import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { SesionService } from '@core/auth/sesion.service';
import { MENU_POR_ROL, RUTA_INICIO_POR_ROL } from '@core/navegacion/menu-por-rol';

import { AccesosRapidosComponent } from './componentes/accesos-rapidos.component';
import { CentroOperacionesComponent } from './componentes/centro-operaciones.component';
import { InicioAseguradoComponent } from './componentes/inicio-asegurado.component';
import { InicioAsesorComponent } from './componentes/inicio-asesor.component';

/**
 * `/inicio`: una sola ruta que muestra el inicio del rol de la sesión (A0, S0 u O0). El socio aterriza aquí
 * con un inicio genérico hasta que exista su tablero B1 (HU-W3.2-01).
 */
@Component({
  selector: 'app-inicio-page',
  imports: [
    TranslocoDirective,
    AccesosRapidosComponent,
    CentroOperacionesComponent,
    InicioAseguradoComponent,
    InicioAsesorComponent,
  ],
  templateUrl: './inicio.page.html',
  styleUrl: './componentes/encabezado-inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  protected readonly sesion = inject(SesionService);

  /** Primer nombre para el saludo («Hola, Carolina»). */
  protected readonly nombre = computed(() => this.sesion.usuario()?.nombre.split(/\s+/)[0] ?? '');

  /** Accesos rápidos: el menú del rol sin el propio inicio. */
  protected readonly accesos = computed(() => {
    const rol = this.sesion.rol();
    return rol ? MENU_POR_ROL[rol].filter((item) => item.ruta !== RUTA_INICIO_POR_ROL[rol]) : [];
  });
}
