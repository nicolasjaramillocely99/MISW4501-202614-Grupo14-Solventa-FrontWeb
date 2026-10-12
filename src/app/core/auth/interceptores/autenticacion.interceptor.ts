import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { SesionService } from '../sesion.service';

/**
 * Único punto que adjunta el JWT (HA-S01): añade `Authorization: Bearer <ID token>` **solo** a las peticiones
 * al API Gateway (`environment.apiGatewayUrl`); nunca a Cognito, a los diccionarios ni a otros orígenes.
 * Ante un 401 del gateway renueva el token y reintenta la petición una sola vez; si no se puede renovar o el
 * reintento vuelve a dar 401, la sesión expira y se muestra «sesión expirada». Ante un 403, «acceso no
 * autorizado», sin reintentar. El error se propaga para que la página muestre su estado.
 */
export const autenticacionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (!esDelApiGateway(peticion.url)) {
    return siguiente(peticion);
  }

  const sesion = inject(SesionService);
  const router = inject(Router);
  const conToken = () => {
    const token = sesion.idToken();
    return token ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : peticion;
  };
  const terminar = (error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      sesion.marcarExpirada();
      void router.navigateByUrl('/acceso/sesion-expirada');
    } else if (error instanceof HttpErrorResponse && error.status === 403) {
      void router.navigateByUrl('/acceso/no-autorizado');
    }
    return throwError(() => error);
  };

  return siguiente(conToken()).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        return terminar(error);
      }
      return from(sesion.renovarAhora()).pipe(
        switchMap((renovada) =>
          renovada ? siguiente(conToken()).pipe(catchError(terminar)) : terminar(error),
        ),
      );
    }),
  );
};

/** ¿La URL pertenece al API Gateway? Compara por prefijo de origen y ruta, no por subcadena. */
export function esDelApiGateway(url: string, base: string = environment.apiGatewayUrl): boolean {
  const raiz = base.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raiz)) {
    return false;
  }
  return url === raiz || url.startsWith(`${raiz}/`) || url.startsWith(`${raiz}?`);
}
