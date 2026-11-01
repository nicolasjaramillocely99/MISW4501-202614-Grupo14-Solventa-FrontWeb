import { Locator, Page } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** O5 provisional · Cola de siniestros (HU-W2.2-01). El gateway lo simula `simularTriage` de `fixtures/triage.ts`. */
export class ColaSiniestrosPagina {
  readonly titulo: Locator;
  readonly regla: Locator;
  readonly indicadores: Locator;
  readonly campo: Locator;
  readonly buscar: Locator;
  readonly limpiar: Locator;
  readonly tabla: Locator;
  readonly errorCampo: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.regla = page.getByRole('region', { name: 'Cómo se calcula la prioridad' });
    this.indicadores = page.getByRole('region', { name: 'Objetivo de atención por nivel' });
    this.campo = page.getByLabel('Identificadores de caso');
    this.buscar = page.getByRole('button', { name: 'Buscar' });
    this.limpiar = page.getByRole('button', { name: 'Limpiar' });
    this.tabla = page.getByRole('table', { name: 'Prioridad de los siniestros consultados' });
    this.errorCampo = page.locator('#casos-error');
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  async buscarIds(ids: string[]): Promise<void> {
    await this.campo.fill(ids.join('\n'));
    await this.buscar.click();
  }

  /** Fila de un caso por su identificador. */
  fila(id: string): Locator {
    return this.tabla.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: id }) });
  }
}
