import { Observable, Subscription } from 'rxjs';

/** Cada cuánto se vuelve a pedir mientras el triage está `pending` (contrato HU-W2.2-01, §2.1). */
export const INTERVALO_SONDEO_MS = 5_000;
/** Fallos seguidos antes de detener el sondeo. */
export const FALLOS_MAXIMOS = 3;
/** El cálculo se promete en 60 s (CA-1); con margen, a los 90 s se deja de esperar. */
export const PLAZO_SONDEO_MS = 90_000;

/**
 * `al-dia`: ya no hay nada que esperar; `sondeando`: sigue `pending` y se vuelve a pedir; `detenido`: el sondeo se
 * rindió (3 fallos seguidos o 90 s) y la persona decide cuándo actualizar.
 */
export type Actualizacion = 'al-dia' | 'sondeando' | 'detenido';

export interface EmisionSondeo<T> {
  valor: T;
  actualizacion: Actualizacion;
}

export interface OpcionesSondeo {
  intervaloMs?: number;
  fallosMaximos?: number;
  plazoMs?: number;
}

/**
 * Pide `consulta` y, mientras `esPendiente` diga que falta algo, la repite cada 5 s (HU-W2.2-01, S1). Emite cada
 * lectura con su `actualizacion` y completa cuando ya no hay nada que esperar o el sondeo se detiene. El primer error
 * (aún sin ninguna lectura) se propaga para que la página muestre su estado de error; los siguientes cuentan como
 * fallos: uno aislado no corta el sondeo y el tercero seguido lo detiene con la última lectura. Al cancelar la
 * suscripción (salir de la página) se cancela también la espera pendiente.
 */
export function sondearMientrasPendiente<T>(
  consulta: () => Observable<T>,
  esPendiente: (valor: T) => boolean,
  opciones: OpcionesSondeo = {},
): Observable<EmisionSondeo<T>> {
  const intervalo = opciones.intervaloMs ?? INTERVALO_SONDEO_MS;
  const fallosMaximos = opciones.fallosMaximos ?? FALLOS_MAXIMOS;
  const plazo = opciones.plazoMs ?? PLAZO_SONDEO_MS;

  return new Observable<EmisionSondeo<T>>((suscriptor) => {
    const inicio = Date.now();
    let ultimo: { valor: T } | null = null;
    let fallos = 0;
    let espera: ReturnType<typeof setTimeout> | null = null;
    let lectura: Subscription | null = null;

    const detener = () => {
      if (ultimo) {
        suscriptor.next({ valor: ultimo.valor, actualizacion: 'detenido' });
      }
      suscriptor.complete();
    };

    const programar = () => {
      if (Date.now() - inicio + intervalo > plazo) {
        detener();
        return;
      }
      espera = setTimeout(pedir, intervalo);
    };

    const pedir = () => {
      espera = null;
      lectura = consulta().subscribe({
        next: (valor) => {
          fallos = 0;
          ultimo = { valor };
          if (!esPendiente(valor)) {
            suscriptor.next({ valor, actualizacion: 'al-dia' });
            suscriptor.complete();
            return;
          }
          suscriptor.next({ valor, actualizacion: 'sondeando' });
          programar();
        },
        error: (error: unknown) => {
          if (!ultimo) {
            suscriptor.error(error);
            return;
          }
          fallos += 1;
          if (fallos >= fallosMaximos) {
            detener();
          } else {
            programar();
          }
        },
      });
    };

    pedir();

    return () => {
      if (espera !== null) {
        clearTimeout(espera);
      }
      lectura?.unsubscribe();
    };
  });
}
