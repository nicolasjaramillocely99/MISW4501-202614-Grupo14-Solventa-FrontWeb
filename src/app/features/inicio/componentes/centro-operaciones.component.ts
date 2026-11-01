import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ItemMenu } from '@core/navegacion/menu-por-rol';

import { AccesosRapidosComponent } from './accesos-rapidos.component';

/**
 * O0 · Centro de operaciones (frame 69-6735). Estructural en HA-S01: encabezado y accesos
 * rápidos del rol; los datos de negocio los traen las historias dueñas de esos datos (docs/pantallas.md).
 */
@Component({
  selector: 'app-centro-operaciones',
  imports: [TranslocoDirective, AccesosRapidosComponent],
  template: `
    <ng-container *transloco="let t">
      <header class="encabezado-inicio">
        <h1 class="encabezado-inicio__titulo">{{ t('inicio.operaciones.titulo') }}</h1>
        <p class="encabezado-inicio__subtitulo">{{ t('inicio.operaciones.subtitulo') }}</p>
      </header>
      <app-accesos-rapidos [accesos]="accesos()" />
    </ng-container>
  `,
  styleUrl: './encabezado-inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentroOperacionesComponent {
  readonly accesos = input.required<readonly ItemMenu[]>();
}
