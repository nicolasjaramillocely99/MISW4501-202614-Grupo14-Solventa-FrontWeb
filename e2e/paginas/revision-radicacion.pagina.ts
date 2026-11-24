import { Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Lo que el gateway simulado recibió. */
export interface TraficoRevision {
  aprobaciones: unknown[];
  devoluciones: unknown[];
}

/** Respuestas del gateway simulado: el detalle cambia según la revisión que se registre. */
export interface GuionRevision {
  radicaciones: unknown[];
  /** El detalle antes de revisar. */
  detalle: Record<string, unknown>;
  trasAprobar?: Record<string, unknown>;
  trasDevolver?: Record<string, unknown>;
}

/** Radicaciones por revisar y S8 · Revisión de la radicación (HU-W2.1-03). */
export class RevisionRadicacionPagina {
  constructor(private readonly page: Page) {}

  /** Simula las rutas del asesor de `claims`: la bandeja, el detalle, la aprobación y la devolución. */
  async simularGateway(guion: GuionRevision): Promise<TraficoRevision> {
    const trafico: TraficoRevision = { aprobaciones: [], devoluciones: [] };
    let detalle = guion.detalle;
    const json = (ruta: Route, estado: number, cuerpo: unknown) =>
      ruta.fulfill({
        status: estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(cuerpo),
      });
    const revisar = (resultado: Record<string, unknown>) => {
      detalle = {
        ...detalle,
        claim: { ...(detalle['claim'] as object), status: resultado['status'] },
        reviews: [...((detalle['reviews'] as unknown[]) ?? []), resultado['review']],
      };
      return resultado;
    };

    await this.page.route(
      (url) => url.pathname === '/v1/claims/reviews',
      (ruta) => json(ruta, 200, { items: guion.radicaciones, next_page_token: null }),
    );
    await this.page.route('**/v1/claims/*/review', (ruta) => json(ruta, 200, detalle));
    await this.page.route('**/v1/claims/*/review-approval', async (ruta) => {
      trafico.aprobaciones.push(ruta.request().postDataJSON());
      await json(ruta, 200, revisar(guion.trasAprobar!));
    });
    await this.page.route('**/v1/claims/*/review-return', async (ruta) => {
      trafico.devoluciones.push(ruta.request().postDataJSON());
      await json(ruta, 200, revisar(guion.trasDevolver!));
    });
    return trafico;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asesor'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA[rol].correo,
      CONTRASENA_PRUEBA,
    );
  }
}
