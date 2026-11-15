import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** B3 · Desempeño técnico de la API del socio comercial (HU-W3.2-03). */
export class DesempenoSocioPagina {
  readonly titulo: Locator;
  readonly estado: Locator;
  readonly disponibilidad: Locator;
  readonly p95: Locator;
  readonly incidentes: Locator;
  readonly sinIncidentes: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.estado = page.getByTestId('estado-api');
    this.disponibilidad = page.getByTestId('tarjeta-disponibilidad');
    this.p95 = page.getByTestId('tarjeta-p95');
    this.incidentes = page.getByTestId('incidente');
    this.sinIncidentes = page.getByTestId('sin-incidentes');
  }

  periodo(nombre: string): Locator {
    return this.page.getByRole('button', { name: nombre, exact: true });
  }

  async abrirComoSocio(): Promise<void> {
    await this.page.goto('/socios/tablero/desempeno');
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA.socio.correo, CONTRASENA_PRUEBA);
  }

  /**
   * Simula `GET /v1/partner-performance`: responde el cuerpo del periodo pedido (`today`, `7d`, `30d`). Devuelve los
   * periodos recibidos.
   */
  async simular(porPeriodo: Record<string, unknown>): Promise<string[]> {
    const recibidos: string[] = [];
    await this.page.route(
      (url) => url.pathname === '/v1/partner-performance',
      async (ruta: Route) => {
        const periodo = new URL(ruta.request().url()).searchParams.get('period') ?? '';
        recibidos.push(periodo);
        await ruta.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify(porPeriodo[periodo]),
        });
      },
    );
    return recibidos;
  }
}
