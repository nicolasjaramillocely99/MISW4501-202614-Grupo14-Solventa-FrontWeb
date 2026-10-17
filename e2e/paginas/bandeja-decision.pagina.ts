import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Respuesta simulada del API Gateway. */
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

/**
 * Guion del servicio de originación para HU-W1.1-02. `pendientes` y `decididas` responden la lista según el
 * parámetro `status`; `detalle` responde `GET /v1/review-requests/{id}` y `decisiones` el `POST` en orden (repite la
 * última). Se puede cambiar durante la prueba (p. ej. tras registrar una decisión).
 */
export interface GuionBandeja {
  pendientes: RespuestaSimulada;
  decididas: RespuestaSimulada;
  detalle: RespuestaSimulada;
  decisiones: RespuestaSimulada[];
}

/** Peticiones recibidas por el gateway simulado. */
export interface LlamadasBandeja {
  /** Parámetros de cada consulta de la lista (`status=…&order=…`). */
  listas: string[];
  detalles: string[];
  decisiones: unknown[];
}

/** S4 / S4b · Bandeja de decisión humana y S5 · Detalle de la solicitud (HU-W1.1-02). */
export class BandejaDecisionPagina {
  readonly titulo: Locator;
  readonly pendientes: Locator;
  readonly decididas: Locator;
  readonly motivo: Locator;
  readonly orden: Locator;
  readonly ajuste: Locator;
  readonly observaciones: Locator;
  readonly registrar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.pendientes = page.getByRole('tab', { name: /^Pendientes/ });
    this.decididas = page.getByRole('tab', { name: /^Decididas/ });
    this.motivo = page.getByLabel('Motivo');
    this.orden = page.getByLabel('Orden por llegada');
    this.ajuste = page.getByLabel('Ajuste de prima (%)');
    this.observaciones = page.getByRole('textbox', { name: 'Observaciones' });
    this.registrar = page.getByRole('button', { name: 'Registrar decisión' });
  }

  /** Responde las rutas de la bandeja según el guion. */
  async simularGateway(guion: GuionBandeja): Promise<LlamadasBandeja> {
    const llamadas: LlamadasBandeja = { listas: [], detalles: [], decisiones: [] };
    const responder = (ruta: Route, respuesta: RespuestaSimulada) =>
      ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });

    await this.page.route('**/v1/review-requests?*', async (ruta) => {
      const parametros = new URL(ruta.request().url()).searchParams;
      llamadas.listas.push(parametros.toString());
      await responder(ruta, parametros.get('status') === 'decided' ? guion.decididas : guion.pendientes);
    });
    await this.page.route('**/v1/review-requests/*', async (ruta) => {
      llamadas.detalles.push(new URL(ruta.request().url()).pathname);
      await responder(ruta, guion.detalle);
    });
    await this.page.route('**/v1/review-requests/*/decision', async (ruta) => {
      llamadas.decisiones.push(ruta.request().postDataJSON());
      const indice = Math.min(llamadas.decisiones.length - 1, guion.decisiones.length - 1);
      await responder(ruta, guion.decisiones[indice]);
    });
    return llamadas;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asesor'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  decision(nombre: RegExp): Locator {
    return this.page.getByRole('radio', { name: nombre });
  }
}
