import { EnvironmentProviders, isDevMode } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { environment } from '@env/environment';

import { CargadorTraducciones } from './cargador-traducciones';

/** Idiomas del portal (sistema de diseño §7): español de Colombia (predeterminado) e inglés de EE. UU. */
export const IDIOMAS_DISPONIBLES = ['es-CO', 'en-US'] as const;
export type Idioma = (typeof IDIOMAS_DISPONIBLES)[number];
export const IDIOMA_RESPALDO: Idioma = 'es-CO';

/** Proveedores de Transloco para `app.config.ts`. */
export function proveerI18n(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...IDIOMAS_DISPONIBLES],
      defaultLang: environment.idiomaPredeterminado,
      fallbackLang: IDIOMA_RESPALDO,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: { useFallbackTranslation: true },
    },
    loader: CargadorTraducciones,
  });
}
