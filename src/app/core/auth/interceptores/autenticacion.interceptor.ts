import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { catchError, throwError } from 'rxjs';

import { SesionService } from '../sesion.service';

/**
 * Único punto que adjunta el JWT (HA-S01): añade `Authorization: Bearer <ID token>` **solo** a las peticiones
 * al API Gateway (`environment.apiGatewayUrl`); nunca a Cognito, a los diccionarios ni a otros orígenes.
 * Ante un 401 del gateway la sesión expira y se muestra «sesión expirada»; ante un 403, «acceso no autorizado».
 * El error se propaga para que la página muestre su estado.
 */
export const autenticacionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (!esDelApiGateway(peticion.url)) {
    return siguiente(peticion);
  }

  const sesion = inject(SesionService);
  const router = inject(Router);
  const token = sesion.idToken();
  const peticionFinal = token
    ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : peticion;

  return siguiente(peticionFinal).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        sesion.marcarExpirada();
        void router.navigateByUrl('/acceso/sesion-expirada');
      } else if (error instanceof HttpErrorResponse && error.status === 403) {
        void router.navigateByUrl('/acceso/no-autorizado');
      }
      return throwError(() => error);
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
