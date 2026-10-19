import { Provider } from '@angular/core';
import { CONFIGURACION_EJECUCION, ConfiguracionEjecucion } from '@core/configuracion/configuracion';

/**
 * Configuración del ambiente en las pruebas unitarias (T5): los mismos valores de `environment.development.ts`
 * (API y pasarela en el origen de `ng serve`, Cognito en el emulador local), para que las URL esperadas en los
 * *specs* no cambien.
 */
export const CONFIGURACION_PRUEBAS: ConfiguracionEjecucion = {
  apiGatewayUrl: 'http://localhost:4200',
  pasarelaPagosUrl: 'http://localhost:4200/pasarela',
  cognito: {
    region: 'us-east-2',
    endpoint: 'http://localhost:5100/',
    userPoolId: 'us-east-2_88555728a50459bf24b7f9852bd1309c320c7b54aae1b',
    clienteId: '9dbed27502f38ace4281ec963a',
  },
};

/** Proveedor de `CONFIGURACION_EJECUCION` para un `TestBed` que necesite otros valores. */
export function proveerConfiguracionPruebas(configuracion: ConfiguracionEjecucion = CONFIGURACION_PRUEBAS): Provider {
  return { provide: CONFIGURACION_EJECUCION, useValue: configuracion };
}

/**
 * Proveedores de todo el entorno de pruebas: `angular.json` → `test.options.providersFile` registra este archivo, así
 * que cualquier servicio que inyecte la configuración la encuentra sin que cada *spec* la declare.
 */
export default [proveerConfiguracionPruebas()];
