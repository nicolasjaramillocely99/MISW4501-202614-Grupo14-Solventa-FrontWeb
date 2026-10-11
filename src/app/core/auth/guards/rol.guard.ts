import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from '../modelos/rol';
import { SesionService } from '../sesion.service';

/**
 * Restringe una ruta a los roles dados (la URL nunca lleva el rol). Con un rol insuficiente lleva a
 * «acceso no autorizado» (403); sin sesión, al inicio de sesión. Va después de `autenticacionGuard`.
 */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return () => {
    const sesion = inject(SesionService);
    const router = inject(Router);
    const rol = sesion.rol();

    if (rol === null) {
      return router.createUrlTree(['/acceso/iniciar-sesion']);
    }
    return roles.includes(rol) ? true : router.createUrlTree(['/acceso/no-autorizado']);
  };
}
