import { Injectable, signal } from '@angular/core';

/**
 * Banco aliado cuyo canal embebe a Solventa. Lo publica la pantalla del flujo que conoce la solicitud y
 * lo lee el shell embebido para rotular la barra del aliado (`layout` no importa de `features`).
 */
@Injectable({ providedIn: 'root' })
export class ContextoAliadoService {
  private readonly _nombre = signal<string | null>(null);

  /** Nombre del aliado, o `null` mientras no se conozca. */
  readonly nombre = this._nombre.asReadonly();

  establecer(nombre: string | null): void {
    this._nombre.set(nombre);
  }
}
