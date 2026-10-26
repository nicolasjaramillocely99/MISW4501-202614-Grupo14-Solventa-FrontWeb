import { Locator, Page } from '@playwright/test';

/** O14 provisional · Búsqueda de un consentimiento por identificador (HU-W4.2-02 F1). */
export class BusquedaConsentimientoPagina {
  readonly titulo: Locator;
  readonly identificador: Locator;
  readonly buscar: Locator;
  readonly limpiar: Locator;
  readonly reintentar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.identificador = page.getByLabel('Identificador del consentimiento');
    this.buscar = page.getByRole('button', { name: 'Buscar' });
    this.limpiar = page.getByRole('button', { name: 'Limpiar búsqueda' });
    this.reintentar = page.getByRole('button', { name: 'Reintentar' });
  }

  async buscarPor(identificador: string): Promise<void> {
    await this.identificador.fill(identificador);
    await this.buscar.click();
  }
}
