import { ModuleWithProviders } from '@angular/core';
import { TranslocoTestingModule, TranslocoTestingOptions } from '@jsverse/transloco';

import enUS from '../../public/i18n/en-US.json';
import esCO from '../../public/i18n/es-CO.json';

/**
 * Transloco con los diccionarios reales de `public/i18n/`, precargados, para verificar en las pruebas
 * los textos externalizados (AGENTS.md §4.3). Uso: `imports: [proveerTranslocoPruebas()]`.
 */
export function proveerTranslocoPruebas(
  opciones: TranslocoTestingOptions = {},
): ModuleWithProviders<TranslocoTestingModule> {
  return TranslocoTestingModule.forRoot({
    langs: { 'es-CO': esCO, 'en-US': enUS },
    translocoConfig: { availableLangs: ['es-CO', 'en-US'], defaultLang: 'es-CO' },
    preloadLangs: true,
    ...opciones,
  });
}

/** Diccionarios crudos, para comprobar que ambos idiomas tienen las mismas claves. */
export const DICCIONARIOS = { 'es-CO': esCO, 'en-US': enUS } as const;
