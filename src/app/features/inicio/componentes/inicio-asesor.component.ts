import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ItemMenu } from '@core/navegacion/menu-por-rol';

import { AccesosRapidosComponent } from './accesos-rapidos.component';

/**
 * S0 · Inicio del asesor comercial (frame 69-6320). Estructural en HA-S01: encabezado, saludo y accesos
 * rápidos del rol; los datos de negocio los traen las historias dueñas de esos datos (docs/pantallas.md).
 */
@Component({
  selector: 'app-inicio-asesor',
  imports: [TranslocoDirective, AccesosRapidosComponent],
  template: `
    <ng-container *transloco="let t">
      <header class="encabezado-inicio">
        <h1 class="encabezado-inicio__titulo">{{ t('inicio.asesor.saludo', { nombre: nombre() }) }}</h1>
        <p class="encabezado-inicio__subtitulo">{{ t('inicio.asesor.subtitulo') }}</p>
      </header>
      <app-accesos-rapidos [accesos]="accesos()" />
    </ng-container>
  `,
  styleUrl: './encabezado-inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioAsesorComponent {
  readonly nombre = input('');
  readonly accesos = input.required<readonly ItemMenu[]>();
}
