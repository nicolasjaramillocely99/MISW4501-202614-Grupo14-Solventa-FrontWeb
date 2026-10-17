import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';
import { RespuestaSimulada } from './aceptacion-oferta.pagina';

/** Peticiones recibidas por el gateway simulado en el paso de pago. */
export interface LlamadasCobro {
  consultas: string[];
}

/** Paso 4 del canal embebido: estado del cobro de la prima (E4b, HA-D02). */
export class PagoPagina {
  readonly titulo: Locator;
  readonly continuar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.continuar = page.getByRole('link', { name: /Continuar con mi crédito/ });
  }

  /** Responde `GET /v1/acceptances/{id}/charge` en orden y repite la última respuesta. */
  async simularGateway(respuestas: RespuestaSimulada[]): Promise<LlamadasCobro> {
    const llamadas: LlamadasCobro = { consultas: [] };
    await this.page.route('**/v1/acceptances/*/charge', async (ruta: Route) => {
      llamadas.consultas.push(new URL(ruta.request().url()).pathname);
      const respuesta = respuestas[Math.min(llamadas.consultas.length - 1, respuestas.length - 1)];
      await ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });
    });
    return llamadas;
  }

  /** Abre el paso de pago; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa aquí. */
  async abrirConSesion(aceptacionId: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(`/embebido/pago/${aceptacionId}`);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
