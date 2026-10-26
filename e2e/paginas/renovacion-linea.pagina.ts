import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { RespuestaSimulada } from './cotizacion-asistida.pagina';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Guion del servicio de originación para HU-W1.5-02. */
export interface GuionRenovacion {
  /** `GET /v1/policies`. */
  polizas?: RespuestaSimulada;
  /** `GET /v1/policies/{id}/renewal`. */
  condiciones?: RespuestaSimulada;
  /** `POST /v1/policies/{id}/renewal`. */
  renovar?: RespuestaSimulada;
  /** `GET /v1/policies/{id}/renewal/status`: una lista se consume en orden y repite la última. */
  estado?: RespuestaSimulada | RespuestaSimulada[];
}

/** Peticiones recibidas por el gateway simulado. */
export interface LlamadasRenovacion {
  aceptadas: number;
  consultasDeEstado: number;
}

/** A1 · Mis pólizas, A4 · Renovar póliza y A4b · Renovación confirmada (HU-W1.5-02). */
export class RenovacionLineaPagina {
  readonly titulo: Locator;
  readonly acepto: Locator;
  readonly renovar: Locator;
  readonly alerta: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.acepto = page.getByRole('checkbox', { name: /Acepto las condiciones renovadas/ });
    this.renovar = page.getByRole('button', { name: /Renovar y pagar/ });
    this.alerta = page.getByRole('alert');
  }

  /** Responde las rutas de pólizas y renovación según el guion; lo no definido responde 503. */
  async simularGateway(guion: GuionRenovacion): Promise<LlamadasRenovacion> {
    const llamadas: LlamadasRenovacion = { aceptadas: 0, consultasDeEstado: 0 };
    const responder = (ruta: Route, respuesta: RespuestaSimulada | undefined) =>
      ruta.fulfill({
        status: respuesta?.estado ?? 503,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(
          respuesta?.cuerpo ?? { error: 'renewal_unavailable', message: 'no simulado' },
        ),
      });

    await this.page.route('**/v1/policies', (ruta) => responder(ruta, guion.polizas));
    await this.page.route('**/v1/policies/*/renewal', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        llamadas.aceptadas += 1;
        await responder(ruta, guion.renovar);
        return;
      }
      await responder(ruta, guion.condiciones);
    });
    await this.page.route('**/v1/policies/*/renewal/status', async (ruta) => {
      const turno = llamadas.consultasDeEstado;
      llamadas.consultasDeEstado += 1;
      const estado = guion.estado;
      await responder(
        ruta,
        Array.isArray(estado) ? estado[Math.min(turno, estado.length - 1)] : estado,
      );
    });
    return llamadas;
  }

  /** Abre una ruta del portal como asegurado; sin sesión el guard lleva al inicio de sesión y regresa a ella. */
  async abrirComoAsegurado(ruta: string): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA.asegurado.correo,
      CONTRASENA_PRUEBA,
    );
  }
}
