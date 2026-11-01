import { Locator, Page, Route } from '@playwright/test';

import { CONTEXTO_ALIADO, PERFIL_RIESGO, RECIBO_CONSENTIMIENTO, TERMINOS_VIGENTES, codificarContexto } from '../fixtures/contexto-aliado';

interface Respuesta {
  estado: number;
  cuerpo: unknown;
}

/** Paso 1 del canal embebido: consentimiento explícito (E1, HU-W1.2-01). */
export class ConsentimientoPagina {
  readonly titulo: Locator;
  readonly alerta: Locator;
  readonly casillaFuentes: Locator;
  readonly casillaPolitica: Locator;
  readonly autorizar: Locator;
  readonly ahoraNo: Locator;
  readonly volverAutorizar: Locator;
  readonly reintentar: Locator;

  /** Cuerpos recibidos en `POST /v1/audit/consents`. */
  readonly consentimientos: unknown[] = [];
  /** Peticiones que llegaron a `/v1/audit/consents` y `/v1/risk-profiles/*`, de cualquier método. */
  readonly peticionesSensibles: string[] = [];
  /** Cuerpos recibidos en `POST /v1/risk-profiles/resolve`. */
  readonly perfiles: unknown[] = [];

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.alerta = page.getByRole('alert');
    this.casillaFuentes = page.getByRole('checkbox', { name: /Autorizo a Solventa a consultar mis datos/ });
    this.casillaPolitica = page.getByRole('checkbox', { name: /política de tratamiento de datos personales/ });
    this.autorizar = page.getByRole('button', { name: 'Autorizar y continuar' });
    this.ahoraNo = page.getByRole('button', { name: 'Ahora no' });
    this.volverAutorizar = page.getByRole('button', { name: 'Volver a autorizar' });
    this.reintentar = page.getByRole('button', { name: 'Reintentar' });
  }

  /**
   * Simula el API Gateway: términos, registro del consentimiento y perfil de riesgo. Cada respuesta se puede
   * cambiar; `esperarTerminos` retiene la respuesta de los términos para ver el estado «cargando».
   */
  async simularGateway(
    opciones: { terminos?: Respuesta; consentimiento?: Respuesta; perfil?: Respuesta; esperarTerminos?: Promise<void> } = {},
  ): Promise<void> {
    const terminos = opciones.terminos ?? { estado: 200, cuerpo: TERMINOS_VIGENTES };
    const consentimiento = opciones.consentimiento ?? { estado: 201, cuerpo: RECIBO_CONSENTIMIENTO };
    const perfil = opciones.perfil ?? { estado: 200, cuerpo: PERFIL_RIESGO };

    await this.page.route('**/v1/audit/consent-terms/current', async (ruta: Route) => {
      if (opciones.esperarTerminos) {
        await opciones.esperarTerminos;
      }
      await responder(ruta, terminos);
    });
    await this.page.route('**/v1/audit/consents', async (ruta: Route) => {
      this.peticionesSensibles.push(`${ruta.request().method()} /v1/audit/consents`);
      this.consentimientos.push(ruta.request().postDataJSON());
      await responder(ruta, consentimiento);
    });
    await this.page.route('**/v1/risk-profiles/**', async (ruta: Route) => {
      this.peticionesSensibles.push(`${ruta.request().method()} ${new URL(ruta.request().url()).pathname}`);
      this.perfiles.push(ruta.request().postDataJSON());
      await responder(ruta, perfil);
    });
  }

  async abrir(contexto: unknown = CONTEXTO_ALIADO): Promise<void> {
    await this.page.goto(`/embebido/consentimiento?contexto=${contexto === null ? '' : codificarContexto(contexto)}`);
  }

  /** Abre con un valor crudo en `?contexto=` (p. ej. un base64 roto). */
  async abrirConValor(valor: string): Promise<void> {
    await this.page.goto(`/embebido/consentimiento?contexto=${valor}`);
  }

  async marcarAmbas(): Promise<void> {
    await this.casillaFuentes.check();
    await this.casillaPolitica.check();
  }
}

async function responder(ruta: Route, respuesta: Respuesta): Promise<void> {
  await ruta.fulfill({
    status: respuesta.estado,
    contentType: 'application/json',
    body: JSON.stringify(respuesta.cuerpo),
  });
}
