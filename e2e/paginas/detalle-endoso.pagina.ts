import { Locator, Page } from '@playwright/test';

/** O3 · Detalle del endoso y O3b · Endoso no aplicado (HU-W1.4-02). */
export class DetalleEndosoPagina {
  readonly titulo: Locator;
  readonly insignia: Locator;
  readonly cambios: Locator;
  readonly aplicar: Locator;
  readonly rechazar: Locator;
  readonly devolver: Locator;
  readonly verHistorial: Locator;
  readonly volverBandeja: Locator;
  readonly observaciones: Locator;
  readonly aviso: Locator;
  readonly alerta: Locator;
  readonly poliza: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.insignia = page.locator('.encabezado app-insignia-estado');
    this.cambios = page.getByRole('table', { name: 'Cambio solicitado' }).locator('tbody tr');
    this.aplicar = page.getByRole('button', { name: 'Aplicar endoso' });
    this.rechazar = page.getByRole('button', { name: 'Rechazar' });
    this.devolver = page.getByRole('button', { name: 'Devolver al asegurado' });
    this.verHistorial = page.getByRole('link', { name: 'Ver historial' });
    this.volverBandeja = page.getByRole('link', { name: 'Volver a la bandeja' });
    this.observaciones = page.getByRole('textbox', { name: /^Observaciones/ });
    this.aviso = page.getByRole('status');
    this.alerta = page.getByRole('alert');
    this.poliza = page.getByRole('region', { name: 'Póliza' });
  }

  /** Una validación de negocio por su título. */
  validacion(titulo: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: titulo });
  }
}
