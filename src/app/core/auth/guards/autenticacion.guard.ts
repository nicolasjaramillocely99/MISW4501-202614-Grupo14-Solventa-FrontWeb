import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SesionService } from '../sesion.service';

/**
 * Protege el shell del portal (úsese en `canActivate` y `canActivateChild`). Con sesión, o si se puede
 * recuperar con el token de renovación, deja pasar. Si la sesión venció sin poder renovarse, lleva a
 * «sesión expirada»; si nunca hubo sesión, al inicio de sesión con la URL pedida en `returnUrl`.
 */
export const autenticacionGuard: CanActivateFn = async (_ruta, estado) => {
  const sesion = inject(SesionService);
  const router = inject(Router);

  if (sesion.autenticado() || (await sesion.restaurar())) {
    return true;
  }
  if (sesion.expirada()) {
    return router.createUrlTree(['/acceso/sesion-expirada']);
  }
  return router.createUrlTree(['/acceso/iniciar-sesion'], {
    queryParams: { returnUrl: estado.url },
  });
};
