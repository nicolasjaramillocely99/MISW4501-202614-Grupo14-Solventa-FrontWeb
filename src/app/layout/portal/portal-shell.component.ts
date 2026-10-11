import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon, LucideLogOut } from '@lucide/angular';
import { filter, map } from 'rxjs';

import { SesionService } from '@core/auth/sesion.service';
import { IdiomaService } from '@core/i18n/idioma.service';
import { MENU_POR_ROL, itemActivo } from '@core/navegacion/menu-por-rol';
import { SelectorIdiomaComponent } from '@shared/ui/selector-idioma/selector-idioma.component';

/**
 * Shell del portal (sistema de diseño §5): barra superior de 64 px con logotipo, nombre del módulo,
 * selector de idioma y usuario con su rol; barra lateral de 240 px con el menú del rol y «Cerrar
 * sesión» al pie. Si la sesión expira (renovación fallida o 401), lleva a «sesión expirada».
 */
@Component({
  selector: 'app-portal-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoDirective,
    LucideDynamicIcon,
    LucideLogOut,
    SelectorIdiomaComponent,
  ],
  templateUrl: './portal-shell.component.html',
  styleUrl: './portal-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalShellComponent {
  protected readonly sesion = inject(SesionService);
  protected readonly idiomas = inject(IdiomaService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly menu = computed(() => {
    const rol = this.sesion.rol();
    return rol ? MENU_POR_ROL[rol] : [];
  });

  /** Nombre del módulo de la barra superior: el ítem activo del menú, o «Inicio». */
  protected readonly modulo = computed(
    () => itemActivo(this.menu(), this.url())?.clave ?? 'menu.inicio',
  );

  protected readonly iniciales = computed(() => {
    const nombre = this.sesion.usuario()?.nombre ?? '';
    return nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0].toLocaleUpperCase('es-CO'))
      .join('');
  });

  constructor() {
    effect(() => {
      if (this.sesion.expirada()) {
        void this.router.navigateByUrl('/acceso/sesion-expirada');
      }
    });
  }

  protected async cerrarSesion(): Promise<void> {
    await this.sesion.cerrarSesion();
    await this.router.navigateByUrl('/acceso/iniciar-sesion');
  }
}
