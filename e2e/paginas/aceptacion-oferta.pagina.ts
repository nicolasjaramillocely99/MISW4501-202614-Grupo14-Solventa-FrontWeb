import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Respuesta simulada del API Gateway. */
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

/**
 * Guion del servicio de originación para HU-W1.3-01. `consultas` responde el polling en orden y repite la
 * última. Se puede cambiar durante la prueba.
 */
export interface GuionAceptacion {
  deOferta: RespuestaSimulada;
  aceptar: RespuestaSimulada;
  consultas: RespuestaSimulada[];
}

/** Peticiones recibidas por el gateway simulado. */
export interface LlamadasAceptacion {
  aceptar: unknown[];
  consultas: string[];
  deOferta: number;
}

/** Paso 3 del canal embebido: aceptación de la oferta (E3, E6, E7 y aceptación conservada; HU-W1.3-01). */
export class AceptacionOfertaPagina {
  readonly titulo: Locator;
  readonly terminos: Locator;
  readonly aceptar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.terminos = page.getByRole('checkbox', { name: /Acepto las condiciones generales/ });
    this.aceptar = page.getByRole('button', { name: /Aceptar oferta y pagar/ });
  }

  /** Responde las tres rutas de aceptación según el guion. */
  async simularGateway(guion: GuionAceptacion): Promise<LlamadasAceptacion> {
    const llamadas: LlamadasAceptacion = { aceptar: [], consultas: [], deOferta: 0 };
    const responder = (ruta: Route, respuesta: RespuestaSimulada) =>
      ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });

    await this.page.route('**/v1/offers/*/acceptance', async (ruta: Route) => {
      if (ruta.request().method() === 'POST') {
        llamadas.aceptar.push(ruta.request().postDataJSON());
        await responder(ruta, guion.aceptar);
      } else {
        llamadas.deOferta++;
        await responder(ruta, guion.deOferta);
      }
    });
    await this.page.route('**/v1/acceptances/*', async (ruta: Route) => {
      llamadas.consultas.push(new URL(ruta.request().url()).pathname);
      const indice = Math.min(llamadas.consultas.length - 1, guion.consultas.length - 1);
      await responder(ruta, guion.consultas[indice]);
    });
    return llamadas;
  }

  /** Abre la oferta; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a la oferta. */
  async abrirConSesion(ofertaId: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(`/embebido/oferta/${ofertaId}`);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  async aceptarOferta(): Promise<void> {
    await this.terminos.check();
    await this.aceptar.click();
  }
}
