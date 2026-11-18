import { Locator, Page } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** O2 · Endosos: la bandeja del analista con sus indicadores, filtros y tabla (HU-W1.4-02). */
export class BandejaEndososPagina {
  readonly titulo: Locator;
  readonly indicadores: Locator;
  readonly estado: Locator;
  readonly tabla: Locator;
  readonly filas: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.indicadores = page.getByRole('region', { name: 'Indicadores de los endosos' });
    this.estado = page.getByLabel('Estado', { exact: true });
    this.tabla = page.getByRole('table', { name: 'Solicitudes de modificación' });
    this.filas = this.tabla.locator('tbody tr');
  }

  /** *Revisar* de una solicitud radicada. */
  revisar(solicitud: string): Locator {
    return this.page.getByRole('button', { name: `Revisar la solicitud ${solicitud}` });
  }

  /** *Continuar* de una solicitud en revisión o no aplicada sin devolver. */
  continuar(solicitud: string): Locator {
    return this.page.getByRole('link', { name: `Continuar la solicitud ${solicitud}` });
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta = '/originacion/endosos', rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
