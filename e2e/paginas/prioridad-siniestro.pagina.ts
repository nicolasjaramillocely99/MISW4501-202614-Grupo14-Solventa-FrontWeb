import { Locator, Page } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** O6 reducida · Prioridad del siniestro del analista (HU-W2.2-01). El gateway lo simula `simularTriage`. */
export class PrioridadSiniestroPagina {
  readonly titulo: Locator;
  readonly tarjeta: Locator;
  readonly historial: Locator;
  readonly migas: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.tarjeta = page.getByRole('region', { name: 'Prioridad', exact: true });
    this.historial = page.getByRole('region', { name: 'Historial de prioridad' });
    this.migas = page.getByRole('link', { name: 'Cola de siniestros' });
  }

  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /** Dato de la tarjeta «Prioridad» por su etiqueta. */
  dato(etiqueta: string): Locator {
    return this.tarjeta.locator('dt', { hasText: etiqueta }).locator('xpath=following-sibling::dd[1]');
  }
}
