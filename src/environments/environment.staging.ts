import type { ConfiguracionEjecucion } from '@core/configuracion/configuracion';

/**
 * Staging: réplica reducida de producción, encendida solo durante las ventanas de experimentación (k6,
 * Toxiproxy, OWASP ZAP). Como producción, lee su configuración de `config.json` al arrancar (T5, decisión D-5):
 * el *build* que se publica en staging es el mismo de producción (`--configuration production`).
 */
export const environment = {
  nombre: 'staging',
  produccion: true,
  /** Sin configuración local: se lee `config.json`. */
  configuracionLocal: null as ConfiguracionEjecucion | null,
  idiomaPredeterminado: 'es-CO',
};
