import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';

import { ID_AVISO_CONFIGURACION, cargarConfiguracion, mostrarAvisoConfiguracion } from './cargar-configuracion';
import { ConfiguracionEjecucion, ErrorConfiguracion } from './configuracion';

/** `document.baseURI` del portal: el `<base href="/">` de index.html lo deja en la raíz aunque la ruta sea profunda. */
const BASE = 'https://d1234abcd.cloudfront.net/';

const NUBE: ConfiguracionEjecucion = {
  apiGatewayUrl: 'https://d1234abcd.cloudfront.net',
  pasarelaPagosUrl: 'https://d1234abcd.cloudfront.net/pasarela',
  cognito: { region: 'us-east-2', userPoolId: 'us-east-2_Permanente', clienteId: 'clienteweb' },
};

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** fetch simulado que responde lo dado y recuerda con qué se llamó. */
function fetchQueResponde(r: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (r instanceof Error) {
      throw r;
    }
    return r;
  });
}

async function motivoDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorConfiguracion);
    return (error as ErrorConfiguracion).motivo;
  }
  throw new Error('se esperaba ErrorConfiguracion');
}

describe('cargarConfiguracion', () => {
  it('en local usa la configuración del environment sin pedir config.json', async () => {
    const fetchFn = fetchQueResponde(new Error('no debía llamarse'));

    await expect(cargarConfiguracion(fetchFn, CONFIGURACION_PRUEBAS, BASE)).resolves.toEqual(CONFIGURACION_PRUEBAS);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('en la nube pide /config.json del origen del portal, sin caché, y lo valida', async () => {
    const fetchFn = fetchQueResponde(respuesta(NUBE));

    await expect(cargarConfiguracion(fetchFn, null, BASE)).resolves.toEqual(NUBE);
    expect(fetchFn).toHaveBeenCalledWith('https://d1234abcd.cloudfront.net/config.json', { cache: 'no-store' });
  });

  it('por defecto resuelve config.json contra document.baseURI', async () => {
    const fetchFn = fetchQueResponde(respuesta(NUBE));

    await cargarConfiguracion(fetchFn, null);
    expect(fetchFn).toHaveBeenCalledWith(new URL('config.json', document.baseURI).href, { cache: 'no-store' });
  });

  it('acepta un endpoint de Cognito y lo conserva', async () => {
    const conEndpoint = { ...NUBE, cognito: { ...NUBE.cognito, endpoint: 'http://localhost:5100/' } };

    await expect(cargarConfiguracion(fetchQueResponde(respuesta(conEndpoint)), null, BASE)).resolves.toEqual(conEndpoint);
  });

  it('falla si config.json no existe (404)', async () => {
    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta('', 404)), null, BASE))).toBe(
      'config.json respondió 404',
    );
  });

  it('falla si la red está caída', async () => {
    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(new TypeError('Failed to fetch')), null, BASE))).toBe(
      'config.json no se pudo pedir (red caída)',
    );
  });

  it('falla si config.json no es JSON', async () => {
    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta('<html>')), null, BASE))).toBe(
      'config.json no es JSON',
    );
  });

  it('falla si no es un objeto o le falta cognito', async () => {
    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta([1, 2])), null, BASE))).toBe('no es un objeto');
    const sinCognito = { apiGatewayUrl: NUBE.apiGatewayUrl, pasarelaPagosUrl: NUBE.pasarelaPagosUrl };
    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta(sinCognito)), null, BASE))).toBe(
      'falta cognito',
    );
  });

  it('rechaza una URL http pública (solo https, o http hacia localhost)', async () => {
    const insegura = { ...NUBE, apiGatewayUrl: 'http://d1234abcd.cloudfront.net' };

    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta(insegura)), null, BASE))).toBe(
      'apiGatewayUrl debe usar https',
    );
  });

  it('rechaza algo que no es una URL', async () => {
    const rota = { ...NUBE, pasarelaPagosUrl: 'PENDIENTE' };

    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta(rota)), null, BASE))).toBe(
      'pasarelaPagosUrl no es una URL',
    );
  });

  it('rechaza identificadores vacíos', async () => {
    const vacia = { ...NUBE, cognito: { ...NUBE.cognito, clienteId: '  ' } };

    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta(vacia)), null, BASE))).toBe(
      'cognito.clienteId vacío',
    );
  });

  it('rechaza una región que no es de AWS', async () => {
    const region = { ...NUBE, cognito: { ...NUBE.cognito, region: 'ohio' } };

    expect(await motivoDe(cargarConfiguracion(fetchQueResponde(respuesta(region)), null, BASE))).toBe(
      'cognito.region no es una región de AWS',
    );
  });
});

describe('mostrarAvisoConfiguracion', () => {
  it('muestra el aviso fijo de index.html', () => {
    const documento = document.implementation.createHTMLDocument('portal');
    documento.body.innerHTML = `<div id="${ID_AVISO_CONFIGURACION}" role="alert" hidden>aviso</div>`;

    mostrarAvisoConfiguracion(documento);

    expect(documento.getElementById(ID_AVISO_CONFIGURACION)?.hasAttribute('hidden')).toBe(false);
  });

  it('no falla si el aviso no existe', () => {
    expect(() => mostrarAvisoConfiguracion(document.implementation.createHTMLDocument('vacio'))).not.toThrow();
  });
});

describe('ErrorConfiguracion', () => {
  it('lleva el motivo y un mensaje legible', () => {
    const error = new ErrorConfiguracion('falta cognito');

    expect(error.name).toBe('ErrorConfiguracion');
    expect(error.message).toContain('falta cognito');
  });
});
