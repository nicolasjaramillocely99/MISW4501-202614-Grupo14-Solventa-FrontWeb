import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable } from 'rxjs';

/**
 * Carga en tiempo de ejecución el diccionario de un idioma desde `public/i18n/<idioma>.json`
 * (servido como `i18n/<idioma>.json`), sin recompilar ni redesplegar por idioma.
 */
@Injectable({ providedIn: 'root' })
export class CargadorTraducciones implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(idioma: string): Observable<Translation> {
    return this.http.get<Translation>(`i18n/${idioma}.json`);
  }
}
