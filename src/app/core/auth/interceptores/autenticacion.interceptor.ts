import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { SesionService } from '../sesion.service';

/**
 * Único punto que adjunta el JWT (HA-S01): añade `Authorization: Bearer <ID token>` **solo** a las peticiones
 * al API de negocio del gateway, `<apiGatewayUrl>/v1/…` (`CONFIGURACION_EJECUCION`); nunca a Cognito, a los
 * diccionarios, a `config.json`, a la pasarela de pagos ni a otros orígenes. En la nube `apiGatewayUrl` es el propio
 * portal (CloudFront lleva `/v1/*` al gateway), así que el prefijo `/v1` es lo que separa el API del resto (T5, H-T5-1).
 * Ante un 401 del gateway renueva el token y reintenta la petición una sola vez; si no se puede renovar o el
 * reintento vuelve a dar 401, la sesión expira y se muestra «sesión expirada». Ante un 403, «acceso no
 * autorizado», sin reintentar. El error se propaga para que la página muestre su estado.
 */
export const autenticacionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (!esDelApiGateway(peticion.url, inject(CONFIGURACION_EJECUCION).apiGatewayUrl)) {
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

/**
 * ¿La URL es del API de negocio del gateway, `<base>/v1/…`? Compara por prefijo de origen y ruta, no por subcadena.
 * La base sola, `config.json`, `/i18n/*` y `/pasarela/*` del mismo origen no lo son (T5, H-T5-1).
 */
export function esDelApiGateway(url: string, base: string): boolean {
  const raiz = base.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raiz)) {
    return false;
  }
  const api = `${raiz}/v1`;
  return url === api || url.startsWith(`${api}/`) || url.startsWith(`${api}?`);
}
