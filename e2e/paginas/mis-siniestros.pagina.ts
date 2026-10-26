import { Locator, Page } from '@playwright/test';

/** A7 mínima · Mis siniestros (HU-W2.1-01). El gateway lo simula `RadicacionSiniestroPagina.simularGateway`. */
export class MisSiniestrosPagina {
  readonly titulo: Locator;
  readonly tabla: Locator;
  readonly poliza: Locator;
  readonly desde: Locator;
  readonly cargarMas: Locator;
  readonly radicar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.tabla = page.getByRole('table', { name: 'Siniestros radicados' });
    this.poliza = page.getByLabel('Póliza', { exact: true });
    this.desde = page.getByLabel('Desde');
    this.cargarMas = page.getByRole('button', { name: 'Cargar más' });
    this.radicar = page.getByRole('link', { name: 'Radicar un siniestro' });
  }

  /** Fila de un caso por su número de radicado. */
  fila(numeroRadicado: string): Locator {
    return this.tabla.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: numeroRadicado }) });
  }
}
