import type { ConfiguracionEjecucion } from '@core/configuracion/configuracion';

/**
 * Producción (demo) y cualquier *build* de producción: la URL del API, la de la pasarela y el *user pool* de Cognito
 * **no se compilan**. El portal los lee al arrancar de `config.json`, que escribe Terraform junto al sitio en cada
 * ambiente (T5, decisión D-5; ver `src/app/core/configuracion/`). Así un mismo *build* sirve a staging y a
 * production-demo.
 */
export const environment = {
  nombre: 'produccion',
  produccion: true,
  /** Sin configuración local: se lee `config.json`. */
  configuracionLocal: null as ConfiguracionEjecucion | null,
  idiomaPredeterminado: 'es-CO',
};
