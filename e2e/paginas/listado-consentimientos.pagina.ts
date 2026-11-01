import { Locator, Page, Route } from '@playwright/test';

import { RespuestaConsentimiento } from '../fixtures/consentimientos';
import { pagina } from '../fixtures/listado-consentimientos';

/** O14 / O14b · Consentimientos Open Finance: indicadores, filtros, tabla paginada y sin resultados (HU-W4.2-01). */
export class ListadoConsentimientosPagina {
  readonly titulo: Locator;
  readonly indicadores: Locator;
  readonly estado: Locator;
  readonly desde: Locator;
  readonly hasta: Locator;
  readonly entidad: Locator;
  readonly cliente: Locator;
  readonly tabla: Locator;
  readonly filas: Locator;
  readonly conteo: Locator;
  readonly anterior: Locator;
  readonly siguiente: Locator;
  readonly limpiarFiltros: Locator;
  readonly reintentar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.indicadores = page.getByRole('region', { name: 'Indicadores de los consentimientos' });
    this.estado = page.getByLabel('Estado', { exact: true });
    this.desde = page.getByLabel('Otorgado desde');
    this.hasta = page.getByLabel('Hasta', { exact: true });
    this.entidad = page.getByLabel('Entidad', { exact: true });
    this.cliente = page.getByLabel('Buscar cliente');
    this.tabla = page.getByRole('table', { name: 'Consentimientos de Open Finance' });
    this.filas = this.tabla.locator('tbody tr');
    this.conteo = page.locator('.pie__conteo');
    this.anterior = page.getByRole('button', { name: 'Anterior' });
    this.siguiente = page.getByRole('button', { name: 'Siguiente' });
    this.limpiarFiltros = page.getByRole('button', { name: 'Limpiar filtros' });
    this.reintentar = page.getByRole('button', { name: 'Reintentar' });
  }

  /** El enlace «Ver» de una fila. */
  ver(id: string): Locator {
    return this.page.getByRole('link', { name: `Ver el consentimiento ${id}` });
  }

  /**
   * Simula `GET /v1/audit/consents` (solo la ruta exacta: el detalle va por `…/consents/{id}/…`). Cada consulta consume la
   * siguiente respuesta y la última se repite; devuelve los parámetros de cada consulta, en orden.
   */
  async simularListado(respuestas: RespuestaConsentimiento[] = []): Promise<URLSearchParams[]> {
    const consultas: URLSearchParams[] = [];
    await this.page.route(
      (url) => url.pathname === '/v1/audit/consents',
      async (ruta: Route) => {
        consultas.push(new URL(ruta.request().url()).searchParams);
        const siguiente = respuestas.length > 1 ? respuestas.shift()! : (respuestas[0] ?? { estado: 200, cuerpo: pagina() });
        await ruta.fulfill({
          status: siguiente.estado,
          contentType: 'application/json',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify(siguiente.cuerpo),
        });
      },
    );
    return consultas;
  }
}
