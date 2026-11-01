import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { ItemMenu } from '@core/navegacion/menu-por-rol';

/** Tarjeta «Accesos rápidos» de los inicios por rol: enlaces a las pantallas del menú del rol. */
@Component({
  selector: 'app-accesos-rapidos',
  imports: [RouterLink, TranslocoDirective, LucideDynamicIcon],
  template: `
    <section class="tarjeta accesos" aria-labelledby="titulo-accesos-rapidos" *transloco="let t">
      <h2 id="titulo-accesos-rapidos" class="accesos__titulo">{{ t('inicio.accesosRapidos') }}</h2>
      <ul class="accesos__lista">
        @for (item of accesos(); track item.ruta) {
          <li>
            <a class="boton boton--secundario boton--bloque" [routerLink]="item.ruta">
              <svg [lucideIcon]="item.icono" [size]="20"></svg>
              {{ t(item.clave) }}
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .accesos {
      display: flex;
      flex-direction: column;
      gap: var(--espacio-16);
      max-width: 400px;
    }

    .accesos__titulo {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 600;
    }

    .accesos__lista {
      display: flex;
      flex-direction: column;
      gap: var(--espacio-12);
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosRapidosComponent {
  readonly accesos = input.required<readonly ItemMenu[]>();
}
