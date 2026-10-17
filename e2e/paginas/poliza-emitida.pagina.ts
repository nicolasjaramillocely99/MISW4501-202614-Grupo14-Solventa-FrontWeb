import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Respuesta simulada del API Gateway. */
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

/** Paso 5 del canal embebido: póliza emitida, documento y notificación (E5, HU-W1.3-03). */
export class PolizaEmitidaPagina {
  readonly titulo: Locator;
  readonly descargar: Locator;
  readonly alerta: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.descargar = page.getByRole('button', { name: 'Descargar' });
    this.alerta = page.getByRole('alert');
  }

  /** Responde el estado de la emisión en orden (repite el último) y el PDF; devuelve cuántas consultas hubo. */
  async simularGateway(
    estados: RespuestaSimulada[],
    pdf = '%PDF-1 e2e',
  ): Promise<{ consultas: number }> {
    const llamadas = { consultas: 0 };
    await this.page.route('**/v1/policies/*/issuance-status', async (ruta: Route) => {
      const respuesta = estados[Math.min(llamadas.consultas, estados.length - 1)];
      llamadas.consultas++;
      await ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });
    });
    await this.page.route('**/v1/policies/*/contract-document', (ruta: Route) =>
      ruta.fulfill({ status: 200, contentType: 'application/pdf', body: pdf }),
    );
    return llamadas;
  }

  /** Abre la póliza; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirConSesion(polizaId: string): Promise<void> {
    await this.page.goto(`/embebido/poliza-emitida/${polizaId}`);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA.asegurado.correo,
      CONTRASENA_PRUEBA,
    );
  }
}
