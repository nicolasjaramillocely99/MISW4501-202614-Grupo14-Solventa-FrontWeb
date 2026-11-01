import { Locator, Page } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** A8 mínima · Detalle del siniestro del asegurado (HU-W2.2-01). El gateway lo simulan `RadicacionSiniestroPagina` y `simularTriage`. */
export class DetalleSiniestroPagina {
  readonly titulo: Locator;
  readonly etapas: Locator;
  readonly datos: Locator;
  readonly migas: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.etapas = page.getByRole('region', { name: 'Etapas del siniestro' });
    this.datos = page.getByRole('region', { name: 'Datos reportados' });
    this.migas = page.getByRole('link', { name: 'Mis siniestros' });
  }

  async abrirComo(ruta: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /** Dato de «Datos reportados» por su etiqueta. */
  dato(etiqueta: string): Locator {
    return this.datos.locator('dt', { hasText: etiqueta }).locator('xpath=following-sibling::dd[1]');
  }
}
