import { DOCUMENT, Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

/** Clave de la preferencia de idioma en `localStorage` (no es un dato sensible). */
export const CLAVE_PREFERENCIA_IDIOMA = 'solventa.idioma';

/**
 * Idioma activo del portal (es-CO / en-US). Cambia el idioma de Transloco en caliente, actualiza el
 * atributo `lang` del documento y recuerda la preferencia del navegador, de modo que se conserva al
 * pasar de P0 al portal y al recargar.
 */
@Injectable({ providedIn: 'root' })
export class IdiomaService {
  private readonly transloco = inject(TranslocoService);
  private readonly documento = inject(DOCUMENT);

  /** Idioma activo; sigue también los cambios hechos directamente sobre Transloco. */
  readonly idioma = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Idiomas que ofrece el portal, en el orden de la configuración. */
  get disponibles(): readonly string[] {
    return this.transloco
      .getAvailableLangs()
      .map((idioma) => (typeof idioma === 'string' ? idioma : idioma.id));
  }

  /** Aplica la preferencia guardada si es un idioma disponible. Lo llama el inicializador de la app. */
  restaurar(): void {
    const guardado = this.leerPreferencia();
    if (guardado && this.disponibles.includes(guardado)) {
      this.aplicar(guardado);
    } else {
      this.documento.documentElement.lang = this.transloco.getActiveLang();
    }
  }

  /** Cambia el idioma en caliente y lo recuerda. Ignora idiomas que el portal no ofrece. */
  cambiar(idioma: string): void {
    if (!this.disponibles.includes(idioma)) {
      return;
    }
    this.aplicar(idioma);
    try {
      localStorage.setItem(CLAVE_PREFERENCIA_IDIOMA, idioma);
    } catch {
      // Sin almacenamiento (modo privado estricto) el idioma dura lo que dure la página.
    }
  }

  private aplicar(idioma: string): void {
    this.transloco.setActiveLang(idioma);
    this.documento.documentElement.lang = idioma;
  }

  private leerPreferencia(): string | null {
    try {
      return localStorage.getItem(CLAVE_PREFERENCIA_IDIOMA);
    } catch {
      return null;
    }
  }
}
