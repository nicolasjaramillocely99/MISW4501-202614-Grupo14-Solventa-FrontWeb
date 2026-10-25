import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';
import { RespuestaSimulada } from './cotizacion-asistida.pagina';

/** Guion del servicio de originación para HU-W1.1-03. */
export interface GuionFormalizacion {
  /** `GET /v1/assisted-quotes/{id}`. */
  cotizacion?: RespuestaSimulada;
  /** `GET /v1/assisted-quotes/{id}/formalization`. */
  consultar?: RespuestaSimulada;
  /** `POST /v1/assisted-quotes/{id}/consent`. */
  codigo?: RespuestaSimulada;
  /** `POST /v1/assisted-quotes/{id}/formalization`. */
  formalizar?: RespuestaSimulada;
}

/** Peticiones recibidas por el gateway simulado. */
export interface LlamadasFormalizacion {
  codigosPedidos: number;
  formalizadas: unknown[];
}

/** S3 / S3c · Formalizar compra por el asesor (HU-W1.1-03). */
export class FormalizacionPagina {
  readonly titulo: Locator;
  readonly medio: Locator;
  readonly referencia: Locator;
  readonly confirmo: Locator;
  readonly enviarCodigo: Locator;
  readonly codigo: Locator;
  readonly formalizar: Locator;
  readonly alerta: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.medio = page.getByLabel('Medio de aceptación');
    this.referencia = page.getByLabel('Referencia');
    this.confirmo = page.getByRole('checkbox', { name: /Confirmo que el cliente aceptó/ });
    this.enviarCodigo = page.getByRole('button', { name: 'Enviar código al cliente' });
    this.codigo = page.getByLabel('Código de confirmación');
    this.formalizar = page.getByRole('button', { name: 'Formalizar y emitir' });
    this.alerta = page.getByRole('alert');
  }

  /** Responde las rutas de formalización según el guion; lo no definido responde 503. */
  async simularGateway(guion: GuionFormalizacion): Promise<LlamadasFormalizacion> {
    const llamadas: LlamadasFormalizacion = { codigosPedidos: 0, formalizadas: [] };
    const responder = (ruta: Route, respuesta: RespuestaSimulada | undefined) =>
      ruta.fulfill({
        status: respuesta?.estado ?? 503,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta?.cuerpo ?? { error: 'formalization_unavailable', message: 'no simulado' }),
      });

    await this.page.route('**/v1/assisted-quotes/*', (ruta) => responder(ruta, guion.cotizacion));
    await this.page.route('**/v1/assisted-quotes/*/consent', async (ruta) => {
      llamadas.codigosPedidos += 1;
      await responder(ruta, guion.codigo);
    });
    await this.page.route('**/v1/assisted-quotes/*/formalization', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        llamadas.formalizadas.push(ruta.request().postDataJSON());
        await responder(ruta, guion.formalizar);
        return;
      }
      await responder(ruta, guion.consultar);
    });
    return llamadas;
  }

  /** Abre una ruta del portal como asesor; sin sesión el guard lleva al inicio de sesión y regresa a ella. */
  async abrirComoAsesor(ruta: string): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA.asesor.correo, CONTRASENA_PRUEBA);
  }
}
