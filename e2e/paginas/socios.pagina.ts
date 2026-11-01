import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Una respuesta simulada del servicio de socios. */
export interface RespuestaSocios {
  estado: number;
  cuerpo: unknown;
}

/** O10 / O11 · Socios comerciales y detalle del socio con sus credenciales (HU-W3.1-01). */
export class SociosPagina {
  readonly titulo: Locator;
  readonly indicadores: Locator;
  readonly filas: Locator;
  readonly credenciales: Locator;
  readonly historial: Locator;
  readonly aprobar: Locator;
  readonly rotar: Locator;
  readonly dialogoRotar: Locator;
  readonly dialogoSecreto: Locator;
  readonly secreto: Locator;
  readonly yaGuarde: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.indicadores = page.getByRole('region', { name: 'Indicadores de socios' });
    this.filas = page.locator('table tbody tr');
    this.credenciales = page.getByRole('region', { name: 'Credenciales de acceso' });
    this.historial = page.getByRole('region', { name: 'Historial de credenciales' });
    this.aprobar = page.getByRole('button', { name: 'Aprobar y generar credenciales' });
    this.rotar = page.getByRole('button', { name: 'Rotar credenciales' }).first();
    this.dialogoRotar = page.getByRole('dialog', { name: 'Rotar credenciales' });
    this.dialogoSecreto = page.getByRole('dialog', { name: 'Credenciales generadas' });
    this.secreto = page.getByTestId('secreto-valor');
    this.yaGuarde = page.getByRole('button', { name: 'Ya guardé el secreto' });
  }

  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /**
   * Simula las rutas de `/v1/partners*` por método y camino. Cada clave es `MÉTODO camino` (p. ej.
   * `GET /v1/partners`); devuelve las peticiones recibidas con su cuerpo.
   */
  async simular(respuestas: Record<string, RespuestaSocios>): Promise<{ ruta: string; cuerpo: unknown }[]> {
    const recibidas: { ruta: string; cuerpo: unknown }[] = [];
    await this.page.route(
      (url) => url.pathname.startsWith('/v1/partners'),
      async (ruta: Route) => {
        const peticion = ruta.request();
        const clave = `${peticion.method()} ${new URL(peticion.url()).pathname}`;
        recibidas.push({ ruta: clave, cuerpo: peticion.postDataJSON() });
        const respuesta = respuestas[clave] ?? { estado: 404, cuerpo: { error: 'partner_not_found', message: 'not found' } };
        await ruta.fulfill({
          status: respuesta.estado,
          contentType: 'application/json',
          headers: { 'cache-control': 'no-store' },
          body: JSON.stringify(respuesta.cuerpo),
        });
      },
    );
    return recibidas;
  }
}
