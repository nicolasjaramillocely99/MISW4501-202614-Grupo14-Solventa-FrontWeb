import { Observable, filter, interval, map } from 'rxjs';

/**
 * Cada cuánto vuelven a leer A7 y A8 el estado de los casos (HU-W2.1-02, CA-2). El umbral acordado es que un cambio se
 * vea en ≤ 5 minutos; leer cada 60 s lo deja muy por debajo sin cargar el backend.
 */
export const INTERVALO_REFRESCO_MS = 60_000;

/**
 * Emite cada `intervaloMs` mientras la pestaña está visible: una pestaña en segundo plano no consulta. Al volver a la
 * pestaña, la siguiente emisión trae el estado al día.
 */
export function refrescoVisible(
  intervaloMs = INTERVALO_REFRESCO_MS,
  documento: Document = document,
): Observable<void> {
  return interval(intervaloMs).pipe(
    filter(() => documento.visibilityState === 'visible'),
    map(() => undefined),
  );
}
