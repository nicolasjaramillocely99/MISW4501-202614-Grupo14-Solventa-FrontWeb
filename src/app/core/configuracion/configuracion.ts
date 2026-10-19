import { InjectionToken } from '@angular/core';

/**
 * Cognito del ambiente: región, *user pool* y cliente web. `endpoint` es opcional: solo lo define un ambiente
 * que usa otro servidor compatible con el API de Cognito (el emulador local); sin él se usa el endpoint
 * regional de AWS.
 */
export interface ConfiguracionCognito {
  readonly region: string;
  readonly userPoolId: string;
  readonly clienteId: string;
  readonly endpoint?: string;
}

/**
 * Configuración del ambiente que el portal lee **antes de arrancar** (T5, decisión D-5): un mismo *build* sirve a
 * staging y a production-demo. En la nube la escribe Terraform en `config.json` junto al sitio; en local la trae
 * `environment.development.ts` (`configuracionLocal`). Solo URL públicas e identificadores: nunca llaves ni
 * secretos.
 */
export interface ConfiguracionEjecucion {
  /** Origen del API Gateway. En la nube es el propio portal: CloudFront lleva `/v1/*` al gateway. */
  readonly apiGatewayUrl: string;
  /** Pasarela de pagos para tokenizar la tarjeta: el número no pasa por Solventa (HU-W1.3-02). */
  readonly pasarelaPagosUrl: string;
  readonly cognito: ConfiguracionCognito;
}

/** Configuración del ambiente, provista en `main.ts` con la que devuelve `cargarConfiguracion`. */
export const CONFIGURACION_EJECUCION = new InjectionToken<ConfiguracionEjecucion>('CONFIGURACION_EJECUCION');

/** La configuración del ambiente no se pudo leer o no es válida; el portal no arranca. */
export class ErrorConfiguracion extends Error {
  constructor(readonly motivo: string) {
    super(`Configuración del portal no válida: ${motivo}`);
    this.name = 'ErrorConfiguracion';
  }
}
