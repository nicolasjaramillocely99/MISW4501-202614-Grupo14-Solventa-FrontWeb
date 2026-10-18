import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { Cobro, CodigoErrorCobro, ErrorCobro, esCobroFinal } from '@core/api/originacion/cobro.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

/** Primera consulta después de mostrar el estado inicial del cobro. */
export const PRIMERA_CONSULTA_COBRO_MS = 1_000;
/** Intervalo normal de consulta. */
export const INTERVALO_CONSULTA_COBRO_MS = 2_000;
/** Si el próximo reintento del backend está a más de 2 s, se consulta 1 s después de él. */
export const MARGEN_PROXIMO_REINTENTO_MS = 1_000;
/**
 * Tope de esa espera: los reintentos del cobro llegan a 60 s (HA-D02); el tope evita esperar de más si el
 * reloj del navegador y el del servidor difieren.
 */
export const ESPERA_MAXIMA_COBRO_MS = 61_000;

/** Espera hasta la siguiente consulta de un cobro que aún no termina. */
export function esperaSiguienteConsultaCobro(cobro: Cobro, ahora: number): number {
  if (cobro.intentos > 0 && cobro.proximoIntentoEn) {
    const hastaProximoReintento = Date.parse(cobro.proximoIntentoEn) - ahora;
    if (hastaProximoReintento > INTERVALO_CONSULTA_COBRO_MS) {
      return Math.min(hastaProximoReintento + MARGEN_PROXIMO_REINTENTO_MS, ESPERA_MAXIMA_COBRO_MS);
    }
  }
  return INTERVALO_CONSULTA_COBRO_MS;
}

/**
 * Polling del cobro de la prima (HA-D02, contrato `HA-D02-api.md`): consulta `GET /v1/acceptances/{id}/charge`
 * hasta que el cobro falla o queda confirmado con su póliza, como el seguimiento de la aceptación (HU-W1.3-01):
 * primera consulta a 1 s, luego cada 2 s, y hasta el próximo reintento + 1 s cuando el backend reintenta más
 * tarde (tope de 61 s). Ante `charge_unavailable` o un error de red conserva el último estado y sigue; ante
 * `charge_not_found`, 400, 401 o 403 se detiene y publica el error. Cada página lo provee para sí: se detiene al
 * destruirse.
 */
@Injectable()
export class SeguimientoCobroService {
  private readonly api = inject(OriginacionApiService);
  private readonly cobroActual = signal<Cobro | null>(null);
  private readonly errorActual = signal<ErrorCobro | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private consulta: Subscription | null = null;
  private aceptacionId: string | null = null;

  /** Último estado conocido del cobro. */
  readonly cobro = this.cobroActual.asReadonly();
  /** Error que detuvo el seguimiento. */
  readonly error = this.errorActual.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  /** Empieza (o reinicia) el seguimiento: consulta ya y luego según el estado del cobro. */
  /**
   * Adelanta el cobro que una acción acaba de devolver, sin esperar al
   * siguiente sondeo. Es lo que hace que E4 pase a «procesando» en cuanto se
   * entrega el medio de pago, en vez de quedarse hasta dos segundos quieta.
   */
  adelantar(cobro: Cobro): void {
    this.cobroActual.set(cobro);
    this.errorActual.set(null);
  }

  seguir(aceptacionId: string): void {
    this.detener();
    this.aceptacionId = aceptacionId;
    this.cobroActual.set(null);
    this.errorActual.set(null);
    this.consultar(true);
  }

  detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.consulta?.unsubscribe();
    this.consulta = null;
  }

  private programar(esperaMs: number): void {
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.consultar(false);
    }, esperaMs);
  }

  private consultar(primera: boolean): void {
    const aceptacionId = this.aceptacionId;
    if (!aceptacionId) {
      return;
    }
    this.consulta = this.api.consultarCobro(aceptacionId).subscribe({
      next: (cobro) => {
        this.cobroActual.set(cobro);
        if (!esCobroFinal(cobro)) {
          this.programar(primera ? PRIMERA_CONSULTA_COBRO_MS : esperaSiguienteConsultaCobro(cobro, Date.now()));
        }
      },
      error: (error: unknown) => {
        const codigo = codigoDe(error);
        if (codigo === 'charge_unavailable') {
          const actual = this.cobroActual();
          this.programar(actual ? esperaSiguienteConsultaCobro(actual, Date.now()) : INTERVALO_CONSULTA_COBRO_MS);
          return;
        }
        this.errorActual.set(error instanceof ErrorCobro ? error : new ErrorCobro(codigo));
      },
    });
  }
}

function codigoDe(error: unknown): CodigoErrorCobro {
  return error instanceof ErrorCobro ? error.codigo : 'charge_unavailable';
}
