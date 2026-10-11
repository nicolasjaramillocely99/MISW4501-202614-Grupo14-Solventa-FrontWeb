import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideShieldAlert } from '@lucide/angular';

import { SesionService } from '@core/auth/sesion.service';

/**
 * Acceso no autorizado (403). Sin frame web dedicado: mensaje, «Volver al inicio» y, con sesión,
 * «Cerrar sesión» para entrar con otra cuenta.
 */
@Component({
  selector: 'app-no-autorizado-page',
  imports: [RouterLink, TranslocoDirective, LucideShieldAlert],
  templateUrl: './no-autorizado.page.html',
  styleUrl: './mensaje-acceso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAutorizadoPage {
  protected readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected async cerrarSesion(): Promise<void> {
    await this.sesion.cerrarSesion();
    await this.router.navigateByUrl('/acceso/iniciar-sesion');
  }
}
