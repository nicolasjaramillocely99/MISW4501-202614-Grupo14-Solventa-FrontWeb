import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideClock } from '@lucide/angular';

/**
 * Sesión expirada (401 del API Gateway, token vencido o revocado). Sin frame web dedicado: mensaje e
 * «Iniciar sesión de nuevo». La sesión anterior ya se borró: no se conserva acceso con sus claims.
 */
@Component({
  selector: 'app-sesion-expirada-page',
  imports: [RouterLink, TranslocoDirective, LucideClock],
  templateUrl: './sesion-expirada.page.html',
  styleUrl: './mensaje-acceso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SesionExpiradaPage {}
