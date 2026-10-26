import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, defer, tap } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  ErrorRevocacion,
  EstadoRevocacion,
  ResultadoReintento,
  SolicitudRevocacion,
} from '@core/api/auditoria/revocacion.modelos';

import { requiereSondeo, sondeoVencido } from '../modelos/presentacion-revocacion';

/** Cada cuánto se vuelve a leer el estado mientras el aviso a las entidades está en curso (contrato HU-W4.2-02, §1). */
export const INTERVALO_SONDEO_MS = 5_000;
/** Fallos seguidos del sondeo antes de detenerlo y pedirle al analista que actualice. */
export const FALLOS_MAXIMOS = 3;

/**
 * `al-dia`: no hay nada que esperar; `sondeando`: se vuelve a leer cada 5 s; `detenido`: el sondeo se rindió (3 fallos
 * seguidos o pasó el plazo de las entidades más 30 s) y el analista decide cuándo actualizar.
 */
export type Actualizacion = 'al-dia' | 'sondeando' | 'detenido';

/**
 * Seguimiento de la revocación de un consentimiento (HU-W4.2-02): guarda el último estado, sondea
 * `GET …/revocation` cada 5 s mientras haya avisos pendientes (S4) y es dueño de la `Idempotency-Key` del modal (S1). No
 * orquesta nada del backend: pide, sondea y reintenta. Cada página lo provee para sí y el sondeo se cancela al destruirse.
 */
@Injectable()
export class SeguimientoRevocacionService {
  private readonly api = inject(AuditoriaApiService);
  private readonly estadoActual = signal<EstadoRevocacion | null>(null);
  private readonly actualizacionActual = signal<Actualizacion>('al-dia');
  private consentimientoId = '';
  private claveIdempotencia: string | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private lectura: { unsubscribe(): void } | null = null;
  private fallosSeguidos = 0;

  /** Último estado conocido. */
  readonly estado = this.estadoActual.asReadonly();
  readonly actualizacion = this.actualizacionActual.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  /** Empieza el seguimiento de un consentimiento; con `estadoInicial` (el que trajo la búsqueda) no se lee otra vez. */
  iniciar(consentimientoId: string, estadoInicial?: EstadoRevocacion): void {
    this.detener();
    this.consentimientoId = consentimientoId;
    this.claveIdempotencia = null;
    this.estadoActual.set(null);
    if (estadoInicial) {
      this.aplicar(estadoInicial);
    }
  }

  /** Lee el estado ahora. El llamador decide qué mostrar si falla; el sondeo se reanuda si hace falta. */
  recargar(): Observable<EstadoRevocacion> {
    return defer(() => {
      this.detener();
      return this.api.consultarEstadoRevocacion(this.consentimientoId);
    }).pipe(
      tap({
        next: (estado) => this.aplicar(estado),
        error: () => {
          // Una lectura manual que falla no borra lo que ya se sabía: si había avisos pendientes, sigue «detenido».
          const actual = this.estadoActual();
          this.actualizacionActual.set(actual && requiereSondeo(actual) ? 'detenido' : 'al-dia');
        },
      }),
    );
  }

  /**
   * Genera la `Idempotency-Key` de este modal. Cerrar y volver a abrir genera otra; mientras siga abierto, cada
   * reintento (503, red, renovación del token) reutiliza la misma.
   */
  abrirConfirmacion(): void {
    this.claveIdempotencia = crypto.randomUUID();
  }

  /**
   * Revoca con la clave del modal. Solo con la respuesta 2xx guarda el estado y empieza el sondeo: la confirmación
   * nunca es optimista. La clave se conserva ante cualquier fallo salvo `idempotency_key_reused`.
   */
  revocar(solicitud: SolicitudRevocacion): Observable<EstadoRevocacion> {
    return defer(() => {
      this.claveIdempotencia ??= crypto.randomUUID();
      this.detener();
      return this.api.revocarConsentimiento(this.consentimientoId, solicitud, this.claveIdempotencia);
    }).pipe(
      tap({
        next: (estado) => {
          this.claveIdempotencia = null;
          this.aplicar(estado);
        },
        error: (error: unknown) => {
          if (error instanceof ErrorRevocacion && error.codigo === 'idempotency_key_reused') {
            this.claveIdempotencia = null;
          }
        },
      }),
    );
  }

  /** Reintenta el aviso a las entidades que no confirmaron; con el 202 pinta el estado y vuelve a sondear. */
  reintentar(): Observable<ResultadoReintento> {
    return defer(() => {
      this.detener();
      return this.api.reintentarRevocacion(this.consentimientoId);
    }).pipe(tap((resultado) => this.aplicar(resultado.estado)));
  }

  /** Cancela el sondeo en curso. */
  detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.lectura?.unsubscribe();
    this.lectura = null;
    this.actualizacionActual.set('al-dia');
  }

  /** Guarda el estado y decide si hay que seguir sondeando. */
  private aplicar(estado: EstadoRevocacion): void {
    this.estadoActual.set(estado);
    this.fallosSeguidos = 0;
    this.programar(estado);
  }

  private programar(estado: EstadoRevocacion): void {
    this.detener();
    if (!requiereSondeo(estado)) {
      return;
    }
    if (sondeoVencido(estado, Date.now())) {
      this.actualizacionActual.set('detenido');
      return;
    }
    this.actualizacionActual.set('sondeando');
    this.temporizador = setTimeout(() => this.leer(estado), INTERVALO_SONDEO_MS);
  }

  private leer(anterior: EstadoRevocacion): void {
    this.temporizador = null;
    this.lectura = this.api.consultarEstadoRevocacion(this.consentimientoId).subscribe({
      next: (estado) => this.aplicar(estado),
      error: () => {
        this.fallosSeguidos += 1;
        this.lectura = null;
        if (this.fallosSeguidos >= FALLOS_MAXIMOS || sondeoVencido(anterior, Date.now())) {
          this.actualizacionActual.set('detenido');
          return;
        }
        // Un fallo suelto no corta el seguimiento: se vuelve a intentar con el último estado conocido.
        this.actualizacionActual.set('sondeando');
        this.temporizador = setTimeout(() => this.leer(anterior), INTERVALO_SONDEO_MS);
      },
    });
  }
}
