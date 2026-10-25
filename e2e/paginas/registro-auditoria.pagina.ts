import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Respuesta simulada del API Gateway. */
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

/** O12 / O12b · Búsqueda y O13 · Registro de auditoría de la suscripción (HU-W4.1-01). */
export class RegistroAuditoriaPagina {
  readonly titulo: Locator;
  readonly identificador: Locator;
  readonly buscar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.identificador = page.getByLabel('Identificador de la póliza');
    this.buscar = page.getByRole('button', { name: 'Buscar' });
  }

  /**
   * Responde `GET /v1/audit/decisions/{id}` con la respuesta del guion para ese id (404 genérico si no hay) y devuelve
   * los ids consultados, en orden.
   */
  async simularGateway(guion: Record<string, RespuestaSimulada>): Promise<string[]> {
    const consultados: string[] = [];
    await this.page.route('**/v1/audit/decisions/*', async (ruta: Route) => {
      const id = decodeURIComponent(new URL(ruta.request().url()).pathname.split('/').pop() ?? '');
      consultados.push(id);
      const respuesta = guion[id] ?? { estado: 404, cuerpo: { error: 'decision_not_found', message: 'no audit record was found for that identifier' } };
      await ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });
    });
    return consultados;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
