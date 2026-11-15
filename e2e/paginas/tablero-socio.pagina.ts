import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Resumen simulado de un rango (la conversión la calcula el backend). */
export interface ResumenSimulado {
  cotizaciones: number;
  polizas: number;
  conversion: number;
}

/** B1 · Tablero de integración del socio comercial (HU-W3.2-01). */
export class TableroSocioPagina {
  readonly titulo: Locator;
  readonly subtitulo: Locator;
  readonly cotizaciones: Locator;
  readonly polizas: Locator;
  readonly conversion: Locator;
  readonly vacio: Locator;
  readonly aislamiento: Locator;
  readonly formularioPersonalizado: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.subtitulo = page.locator('.pagina__descripcion');
    this.cotizaciones = page.getByTestId('tarjeta-cotizaciones');
    this.polizas = page.getByTestId('tarjeta-polizas');
    this.conversion = page.getByTestId('tarjeta-conversion');
    this.vacio = page.getByRole('region', { name: 'Sin cotizaciones en el rango seleccionado' });
    this.aislamiento = page.getByRole('complementary', { name: 'Aislamiento de datos' });
    this.formularioPersonalizado = page.getByRole('form', { name: 'Rango personalizado' });
  }

  rango(nombre: string): Locator {
    return this.page.getByRole('button', { name: nombre, exact: true });
  }

  async abrirComoSocio(): Promise<void> {
    await this.page.goto('/socios/tablero');
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA.socio.correo, CONTRASENA_PRUEBA);
  }

  /**
   * Simula `GET /v1/partner-metrics/summary`: responde el resumen de la clave `desde..hasta` y ceros para cualquier
   * otro rango. Devuelve los parámetros de cada consulta, para comprobar que el socio nunca viaja (CA-4).
   */
  async simular(resumenes: Record<string, ResumenSimulado>): Promise<URLSearchParams[]> {
    const recibidas: URLSearchParams[] = [];
    await this.page.route(
      (url) => url.pathname === '/v1/partner-metrics/summary',
      async (ruta: Route) => {
        const parametros = new URL(ruta.request().url()).searchParams;
        recibidas.push(parametros);
        const desde = parametros.get('from') ?? '';
        const hasta = parametros.get('to') ?? '';
        const r = resumenes[`${desde}..${hasta}`] ?? { cotizaciones: 0, polizas: 0, conversion: 0 };
        await ruta.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify({
            partner_id: 'socio-001',
            from: desde,
            to: hasta,
            quotes_requested: r.cotizaciones,
            policies_issued: r.polizas,
            conversion_rate: r.conversion,
          }),
        });
      },
    );
    return recibidas;
  }
}
