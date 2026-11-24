import { Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

type Cuerpo = Record<string, unknown>;

/** Lo que el gateway simulado recibió. */
export interface TraficoIntervencion {
  avances: Cuerpo[];
  cierres: Cuerpo[];
}

/** Respuestas del gateway simulado: la lectura inicial y lo que devuelve cada escritura, en orden. */
export interface GuionIntervencion {
  lectura: Cuerpo;
  trasAvances?: Cuerpo[];
  trasCierres?: { status: number; cuerpo: Cuerpo }[];
}

/** O8 · Seguimiento de la intervención y cierre del caso (HU-W2.3-02). */
export class SeguimientoIntervencionPagina {
  constructor(private readonly page: Page) {}

  async simularGateway(guion: GuionIntervencion): Promise<TraficoIntervencion> {
    const trafico: TraficoIntervencion = { avances: [], cierres: [] };
    let actual = guion.lectura;
    const avances = [...(guion.trasAvances ?? [])];
    const cierres = [...(guion.trasCierres ?? [])];
    const json = (ruta: Route, status: number, cuerpo: unknown) =>
      ruta.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(cuerpo),
      });

    await this.page.route('**/v1/claims/*/intervention', (ruta) => json(ruta, 200, actual));
    await this.page.route('**/v1/claims/*/intervention/steps', (ruta) => {
      trafico.avances.push(ruta.request().postDataJSON() as Cuerpo);
      actual = avances.shift() ?? actual;
      return json(ruta, 201, actual);
    });
    await this.page.route('**/v1/claims/*/closure', (ruta) => {
      trafico.cierres.push(ruta.request().postDataJSON() as Cuerpo);
      const respuesta = cierres.shift() ?? {
        status: 503,
        cuerpo: { error: 'claims_unavailable', message: 'x' },
      };
      if (respuesta.status === 201) {
        actual = respuesta.cuerpo;
      }
      return json(ruta, respuesta.status, respuesta.cuerpo);
    });
    return trafico;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA[rol].correo,
      CONTRASENA_PRUEBA,
    );
  }

  fila(paso: string) {
    return this.page.locator(`[data-paso="${paso}"]`);
  }

  dialogo() {
    return this.page.getByRole('dialog');
  }
}
