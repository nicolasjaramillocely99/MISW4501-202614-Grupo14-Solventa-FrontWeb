import { Locator, Page } from '@playwright/test';

/** O4 · Historial de endosos de la póliza, de solo lectura (HU-W1.4-02). */
export class HistorialEndososPagina {
  readonly titulo: Locator;
  readonly tabla: Locator;
  readonly filas: Locator;
  readonly vacio: Locator;

  constructor(page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.tabla = page.getByRole('table', { name: 'Entradas del historial' });
    this.filas = this.tabla.locator('tbody tr');
    this.vacio = page.getByRole('heading', { name: 'Esta póliza no tiene endosos' });
  }
}
