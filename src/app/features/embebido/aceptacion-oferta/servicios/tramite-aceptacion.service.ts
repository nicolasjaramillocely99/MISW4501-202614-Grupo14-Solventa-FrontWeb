import { Injectable } from '@angular/core';

/** Clave de `sessionStorage` del trámite de aceptación: sobrevive a recargar y muere al cerrar la pestaña. */
export const CLAVE_TRAMITE_ACEPTACION = 'solventa.aceptacion.tramite';

/** Lo mínimo para retomar el trámite tras recargar (contrato HU-W1.3-01, §5.4): la oferta y su aceptación. */
export interface TramiteAceptacion {
  ofertaId: string;
  aceptacionId: string;
}

/**
 * Guarda en `sessionStorage` la oferta y la aceptación en curso, para retomar el trámite tras recargar
 * o volver a `/embebido/oferta` sin el identificador. Solo guarda identificadores, nunca datos del cliente.
 */
@Injectable({ providedIn: 'root' })
export class TramiteAceptacionService {
  leer(): TramiteAceptacion | null {
    try {
      const crudo = sessionStorage.getItem(CLAVE_TRAMITE_ACEPTACION);
      if (!crudo) {
        return null;
      }
      const valor: unknown = JSON.parse(crudo);
      if (typeof valor !== 'object' || valor === null) {
        return null;
      }
      const { ofertaId, aceptacionId } = valor as Record<string, unknown>;
      return typeof ofertaId === 'string' && typeof aceptacionId === 'string' ? { ofertaId, aceptacionId } : null;
    } catch {
      return null;
    }
  }

  guardar(tramite: TramiteAceptacion): void {
    try {
      sessionStorage.setItem(CLAVE_TRAMITE_ACEPTACION, JSON.stringify(tramite));
    } catch {
      // Sin sessionStorage (modo privado estricto) el trámite se retoma con el identificador de la URL.
    }
  }

  borrar(): void {
    try {
      sessionStorage.removeItem(CLAVE_TRAMITE_ACEPTACION);
    } catch {
      // Nada que borrar.
    }
  }
}
