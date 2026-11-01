import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronDown, LucideGlobe } from '@lucide/angular';

let siguienteId = 0;

/**
 * Selector de idioma del sistema de diseño (P0 y barra superior del portal): globo, código del idioma
 * activo («ES», «EN») y chevron, sobre un `<select>` nativo con etiqueta permanente para lectores de
 * pantalla. Cada opción anuncia el nombre completo del idioma en ese idioma. Es presentacional: recibe
 * el idioma activo y los disponibles y emite el elegido; quien lo usa decide cómo aplicarlo.
 */
@Component({
  selector: 'app-selector-idioma',
  imports: [TranslocoDirective, LucideGlobe, LucideChevronDown],
  template: `
    <ng-container *transloco="let t">
      <label class="visualmente-oculto" [attr.for]="id">{{ t('comun.idioma.etiqueta') }}</label>
      <span class="selector-idioma">
        <svg lucideGlobe class="selector-idioma__globo" [size]="18"></svg>
        <select [id]="id" class="selector-idioma__control" (change)="elegir($event)">
          @for (opcion of idiomas(); track opcion) {
            <option
              [value]="opcion"
              [selected]="opcion === idioma()"
              [attr.lang]="opcion"
              [attr.aria-label]="t('comun.idioma.' + clave(opcion))"
            >
              {{ t('comun.idioma.' + clave(opcion) + 'Corto') }}
            </option>
          }
        </select>
        <svg lucideChevronDown class="selector-idioma__chevron" [size]="16"></svg>
      </span>
    </ng-container>
  `,
  styleUrl: './selector-idioma.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorIdiomaComponent {
  /** Idioma activo (`es-CO`, `en-US`). */
  readonly idioma = input.required<string>();
  /** Idiomas que se ofrecen, en orden. */
  readonly idiomas = input.required<readonly string[]>();
  /** Idioma que eligió el usuario. */
  readonly cambio = output<string>();

  protected readonly id = `selector-idioma-${++siguienteId}`;

  /** Clave i18n del idioma: `es-CO` → `esCO`. */
  protected clave(idioma: string): string {
    return idioma.replace('-', '');
  }

  protected elegir(evento: Event): void {
    this.cambio.emit((evento.target as HTMLSelectElement).value);
  }
}
