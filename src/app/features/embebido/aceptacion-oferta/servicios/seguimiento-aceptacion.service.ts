import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import {
  Aceptacion,
  CodigoErrorAceptacion,
  ErrorAceptacion,
  esEstadoFinal,
} from '@core/api/originacion/aceptacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { TramiteAceptacionService } from './tramite-aceptacion.service';

/** Primera consulta tras el 202 (contrato HU-W1.3-01, §6). */
export const PRIMERA_CONSULTA_MS = 1_000;
/** Intervalo normal de consulta. */
export const INTERVALO_CONSULTA_MS = 2_000;
/** Tras 2 minutos en `registered` se baja la frecuencia, sin abandonar: el backend sigue reintentando. */
export const UMBRAL_CONSULTA_LENTA_MS = 120_000;
export const INTERVALO_CONSULTA_LENTA_MS = 15_000;
/** Si el próximo intento del backend está a más de 2 s, se consulta 1 s después de él. */
export const MARGEN_PROXIMO_INTENTO_MS = 1_000;
/**
 * Tope de esa espera. Los reintentos del backend llegan a 60 s; el tope evita esperar de más si el reloj
 * del navegador y el del servidor difieren.
 */
export const ESPERA_MAXIMA_MS = 61_000;

/** Espera hasta la siguiente consulta de una aceptación en `registered` (§6). */
export function esperaSiguienteConsulta(
  aceptacion: Aceptacion,
  transcurridoMs: number,
  ahora: number,
): number {
  if (transcurridoMs >= UMBRAL_CONSULTA_LENTA_MS) {
    return INTERVALO_CONSULTA_LENTA_MS;
  }
  const { intentos, proximoIntentoEn } = aceptacion.procesamiento;
  if (intentos > 0 && proximoIntentoEn) {
    const hastaProximoIntento = Date.parse(proximoIntentoEn) - ahora;
    if (hastaProximoIntento > INTERVALO_CONSULTA_MS) {
      return Math.min(hastaProximoIntento + MARGEN_PROXIMO_INTENTO_MS, ESPERA_MAXIMA_MS);
    }
  }
  return INTERVALO_CONSULTA_MS;
}

/**
 * Polling del estado de una aceptación (HU-W1.3-01, §6): consulta `GET /v1/acceptances/{id}` hasta un estado
 * final (`issuance_pending` o `in_review`), baja la frecuencia a los 2 minutos y nunca pide al cliente que
 * repita nada. Ante `acceptance_unavailable` o un error de red conserva el último estado y sigue con el
 * mismo intervalo; ante `acceptance_not_found` vuelve a consultar por oferta; ante 400, 401 o 403 se detiene
 * y publica el error. Cada página lo provee para sí: se detiene al destruirse.
 */
@Injectable()
export class SeguimientoAceptacionService {
  private readonly api = inject(OriginacionApiService);
  private readonly tramite = inject(TramiteAceptacionService);
  private readonly aceptacionActual = signal<Aceptacion | null>(null);
  private readonly lentoActual = signal(false);
  private readonly errorActual = signal<ErrorAceptacion | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private consulta: Subscription | null = null;
  private inicio = 0;

  /** Último estado conocido de la aceptación. */
  readonly aceptacion = this.aceptacionActual.asReadonly();
  /** Pasaron 2 minutos sin salir de `registered`: se mantiene el mensaje de aceptación conservada. */
  readonly lento = this.lentoActual.asReadonly();
  /** Error que detuvo el seguimiento; `acceptance_not_found` significa que la oferta ya no tiene aceptación. */
  readonly error = this.errorActual.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  /** Empieza (o reinicia) el seguimiento desde la aceptación dada. */
  seguir(aceptacion: Aceptacion, primeraEsperaMs = PRIMERA_CONSULTA_MS): void {
    this.detener();
    this.errorActual.set(null);
    this.lentoActual.set(false);
    this.inicio = Date.now();
    this.publicar(aceptacion);
    if (!esEstadoFinal(aceptacion.estado)) {
      this.programar(primeraEsperaMs);
    }
  }

  detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.consulta?.unsubscribe();
    this.consulta = null;
  }

  private publicar(aceptacion: Aceptacion): void {
    this.aceptacionActual.set(aceptacion);
    this.tramite.guardar({ ofertaId: aceptacion.ofertaId, aceptacionId: aceptacion.aceptacionId });
  }

  private programar(esperaMs: number): void {
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.consultar();
    }, esperaMs);
  }

  private reprogramar(aceptacion: Aceptacion): void {
    const transcurrido = Date.now() - this.inicio;
    this.lentoActual.set(transcurrido >= UMBRAL_CONSULTA_LENTA_MS);
    this.programar(esperaSiguienteConsulta(aceptacion, transcurrido, Date.now()));
  }

  private consultar(): void {
    const actual = this.aceptacionActual();
    if (!actual) {
      return;
    }
    this.consulta = this.api.consultarAceptacion(actual.aceptacionId).subscribe({
      next: (aceptacion) => this.recibir(aceptacion),
      error: (error: unknown) => {
        const codigo = codigoDe(error);
        if (codigo === 'acceptance_not_found') {
          // Identificador desconocido (p. ej. el servicio se reinició, §8): se retoma por la oferta.
          this.recuperarPorOferta(actual);
        } else if (codigo === 'acceptance_unavailable') {
          this.reprogramar(actual);
        } else {
          this.errorActual.set(error instanceof ErrorAceptacion ? error : new ErrorAceptacion(codigo));
        }
      },
    });
  }

  private recuperarPorOferta(actual: Aceptacion): void {
    this.consulta = this.api.consultarAceptacionDeOferta(actual.ofertaId).subscribe({
      next: (aceptacion) => this.recibir(aceptacion),
      error: (error: unknown) => {
        const codigo = codigoDe(error);
        if (codigo === 'acceptance_unavailable') {
          this.reprogramar(actual);
          return;
        }
        if (codigo === 'acceptance_not_found') {
          this.tramite.borrar();
        }
        this.errorActual.set(error instanceof ErrorAceptacion ? error : new ErrorAceptacion(codigo));
      },
    });
  }

  private recibir(aceptacion: Aceptacion): void {
    this.publicar(aceptacion);
    if (esEstadoFinal(aceptacion.estado)) {
      this.lentoActual.set(false);
      return;
    }
    this.reprogramar(aceptacion);
  }
}

function codigoDe(error: unknown): CodigoErrorAceptacion {
  return error instanceof ErrorAceptacion ? error.codigo : 'acceptance_unavailable';
}
