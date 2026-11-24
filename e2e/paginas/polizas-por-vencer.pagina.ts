import { Locator, Page, Route } from '@playwright/test';

import { RespuestaPorVencer, responder } from '../fixtures/polizas-por-vencer';
import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** S6 · Pólizas próximas a vencer del asesor: tarjeta, filtros, tabla, sin resultados y errores (HU-W1.5-01). */
export class PolizasPorVencerPagina {
  readonly titulo: Locator;
  readonly tarjeta: Locator;
  readonly desde: Locator;
  readonly hasta: Locator;
  readonly estado: Locator;
  readonly conteo: Locator;
  readonly tabla: Locator;
  readonly filas: Locator;
  readonly limpiarFiltros: Locator;
  readonly reintentar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.tarjeta = page.getByRole('region', { name: 'Pólizas que vencen en la ventana de renovación' });
    this.desde = page.getByLabel('Vencen desde');
    this.hasta = page.getByLabel('Hasta', { exact: true });
    this.estado = page.getByLabel('Estado', { exact: true });
    this.conteo = page.locator('.filtros__contador');
    this.tabla = page.getByRole('table', { name: 'Pólizas próximas a vencer' });
    this.filas = this.tabla.locator('tbody tr');
    this.limpiarFiltros = page.getByRole('button', { name: 'Limpiar filtros' });
    this.reintentar = page.getByRole('button', { name: 'Reintentar' });
  }

  /** El enlace «Renovar» de una póliza. */
  renovar(polizaId: string): Locator {
    return this.page.getByRole('link', { name: `Renovar la póliza ${polizaId}` });
  }

  /** El enlace «Ver» de una póliza con la renovación en curso. */
  ver(polizaId: string): Locator {
    return this.page.getByRole('link', { name: `Ver la renovación de la póliza ${polizaId}` });
  }

  /**
   * Simula `GET /v1/policies/expiring`: cada consulta consume la siguiente respuesta fija (si hay) y, sin ellas, responde
   * como el servicio con `responder`. Devuelve los parámetros de cada consulta, en orden.
   */
  async simularListado(fijas: RespuestaPorVencer[] = []): Promise<URLSearchParams[]> {
    const consultas: URLSearchParams[] = [];
    await this.page.route(
      (url) => url.pathname === '/v1/policies/expiring',
      async (ruta: Route) => {
        const params = new URL(ruta.request().url()).searchParams;
        consultas.push(params);
        const respuesta = fijas.shift() ?? responder(params);
        await ruta.fulfill({
          status: respuesta.estado,
          contentType: 'application/json',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify(respuesta.cuerpo),
        });
      },
    );
    return consultas;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asesor'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
