import { environment } from '@env/environment';

import { ConfiguracionEjecucion, ErrorConfiguracion } from './configuracion';

/** Id del aviso fijo de `index.html` que se muestra cuando no hay configuración válida. */
export const ID_AVISO_CONFIGURACION = 'aviso-configuracion';

/** Región de AWS: `us-east-2`, `sa-east-1`, `ap-southeast-1`… */
const REGION_AWS = /^[a-z]{2}(-[a-z]+)+-\d$/;

/**
 * Lee la configuración del ambiente antes de arrancar Angular (T5, decisión D-5).
 *
 * - En local (`ng serve`), `environment.development.ts` trae `configuracionLocal` y se usa tal cual.
 * - En la nube se pide `config.json` al mismo origen del portal, sin caché, y se valida: URL `https://` (o
 *   `http://localhost` en pruebas locales), identificadores no vacíos y una región de AWS.
 *
 * Falla con `ErrorConfiguracion` si no hay archivo, no es JSON o no es válido; entonces el portal no llama a nada.
 */
export async function cargarConfiguracion(
  fetchFn: typeof fetch = (entrada, opciones) => fetch(entrada, opciones),
  local: ConfiguracionEjecucion | null = environment.configuracionLocal,
  base: string = document.baseURI,
): Promise<ConfiguracionEjecucion> {
  if (local) {
    return validar(local);
  }
  let respuesta: Response;
  try {
    respuesta = await fetchFn(new URL('config.json', base).href, { cache: 'no-store' });
  } catch {
    throw new ErrorConfiguracion('config.json no se pudo pedir (red caída)');
  }
  if (!respuesta.ok) {
    throw new ErrorConfiguracion(`config.json respondió ${respuesta.status}`);
  }
  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorConfiguracion('config.json no es JSON');
  }
  return validar(datos);
}

/** Muestra el aviso fijo y bilingüe de `index.html` (Transloco aún no existe en este punto). */
export function mostrarAvisoConfiguracion(documento: Document = document): void {
  documento.getElementById(ID_AVISO_CONFIGURACION)?.removeAttribute('hidden');
}

function validar(datos: unknown): ConfiguracionEjecucion {
  if (!esObjeto(datos)) {
    throw new ErrorConfiguracion('no es un objeto');
  }
  const cognito = datos['cognito'];
  if (!esObjeto(cognito)) {
    throw new ErrorConfiguracion('falta cognito');
  }
  const configuracion: ConfiguracionEjecucion = {
    apiGatewayUrl: url(datos['apiGatewayUrl'], 'apiGatewayUrl'),
    pasarelaPagosUrl: url(datos['pasarelaPagosUrl'], 'pasarelaPagosUrl'),
    cognito: {
      region: region(cognito['region']),
      userPoolId: texto(cognito['userPoolId'], 'cognito.userPoolId'),
      clienteId: texto(cognito['clienteId'], 'cognito.clienteId'),
      ...(cognito['endpoint'] === undefined ? {} : { endpoint: url(cognito['endpoint'], 'cognito.endpoint') }),
    },
  };
  return configuracion;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorConfiguracion(`${campo} vacío`);
  }
  return valor.trim();
}

/** URL `https://`, o `http://` solo hacia `localhost` (servidor local y pruebas). */
function url(valor: unknown, campo: string): string {
  const crudo = texto(valor, campo);
  let analizada: URL;
  try {
    analizada = new URL(crudo);
  } catch {
    throw new ErrorConfiguracion(`${campo} no es una URL`);
  }
  const local = analizada.protocol === 'http:' && analizada.hostname === 'localhost';
  if (analizada.protocol !== 'https:' && !local) {
    throw new ErrorConfiguracion(`${campo} debe usar https`);
  }
  return crudo;
}

function region(valor: unknown): string {
  const crudo = texto(valor, 'cognito.region');
  if (!REGION_AWS.test(crudo)) {
    throw new ErrorConfiguracion('cognito.region no es una región de AWS');
  }
  return crudo;
}
