import { Locator, Page, Route } from '@playwright/test';

/** Paso 2 del canal embebido: cálculo del perfil de riesgo (E2 / E2b, HU-W1.2-02). */
export class PerfilRiesgoPagina {
  readonly titulo: Locator;
  readonly alerta: Locator;
  readonly verOferta: Locator;
  readonly cancelar: Locator;
  readonly reintentar: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.alerta = page.getByRole('alert');
    this.verOferta = page.getByRole('link', { name: 'Ver mi oferta' });
    this.cancelar = page.getByRole('link', { name: 'Cancelar' });
    this.reintentar = page.getByRole('button', { name: 'Reintentar' });
  }

  /** Responde `POST /v1/risk-profiles/resolve` del API Gateway; devuelve el cuerpo recibido. */
  async simularGateway(
    respuesta: { estado: number; cuerpo: unknown },
    esperar?: Promise<void>,
  ): Promise<{ cuerpos: unknown[] }> {
    const recibidos: unknown[] = [];
    await this.page.route('**/v1/risk-profiles/resolve', async (ruta: Route) => {
      recibidos.push(ruta.request().postDataJSON());
      if (esperar) {
        await esperar;
      }
      await ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        body: JSON.stringify(respuesta.cuerpo),
      });
    });
    return { cuerpos: recibidos };
  }

  async abrir(consentimiento = true): Promise<void> {
    await this.page.goto(`/embebido/perfil-riesgo/cli-1?consentimiento=${consentimiento}`);
  }
}
