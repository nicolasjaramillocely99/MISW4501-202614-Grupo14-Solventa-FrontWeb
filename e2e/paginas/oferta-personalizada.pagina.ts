import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

interface Respuesta {
  estado: number;
  cuerpo: unknown;
}

/**
 * Guion del servicio de originación para HU-W1.2-03. `ofertas` responde `GET /v1/offers/{id}` por identificador (una
 * función se evalúa en cada lectura, para cambiar el estado de la oferta durante la prueba).
 */
export interface GuionOferta {
  generar?: Respuesta;
  ofertas?: Record<string, Respuesta | (() => Respuesta)>;
  renovar?: Respuesta;
  aceptar?: Respuesta;
}

const SIN_ACEPTACION: Respuesta = {
  estado: 404,
  cuerpo: { error: 'acceptance_not_found', message: 'the acceptance does not exist' },
};

/** Paso 3 del canal embebido: la oferta personalizada (E3, E3b, E3c, E7 y el aviso de reemplazo, HU-W1.2-03). */
export class OfertaPersonalizadaPagina {
  readonly titulo: Locator;
  readonly terminos: Locator;
  readonly aceptar: Locator;
  readonly generarNueva: Locator;
  readonly verActualizada: Locator;

  /** Cuerpos recibidos en `POST /v1/offers`. */
  readonly generadas: unknown[] = [];
  /** Identificadores leídos con `GET /v1/offers/{id}`, en orden. */
  readonly consultadas: string[] = [];
  /** Identificadores renovados con `POST /v1/offers/{id}/renewal`. */
  readonly renovadas: string[] = [];
  /** Cuerpos recibidos en `POST /v1/offers/{id}/acceptance`. */
  readonly aceptadas: unknown[] = [];

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.terminos = page.getByRole('checkbox', { name: /Acepto las condiciones generales/ });
    this.aceptar = page.getByRole('button', { name: /Aceptar oferta y pagar/ });
    this.generarNueva = page.getByRole('button', { name: 'Generar una nueva oferta' });
    this.verActualizada = page.getByRole('link', { name: 'Ver mi oferta actualizada' });
  }

  async simularGateway(guion: GuionOferta): Promise<void> {
    const responder = (ruta: Route, respuesta: Respuesta) =>
      ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });
    const idDe = (ruta: Route, posicion: number) => new URL(ruta.request().url()).pathname.split('/')[posicion];

    await this.page.route('**/v1/offers', async (ruta: Route) => {
      this.generadas.push(ruta.request().postDataJSON());
      await responder(ruta, guion.generar ?? { estado: 500, cuerpo: null });
    });
    await this.page.route('**/v1/offers/*', async (ruta: Route) => {
      const id = idDe(ruta, 3);
      this.consultadas.push(id);
      const respuesta = guion.ofertas?.[id];
      await responder(
        ruta,
        typeof respuesta === 'function'
          ? respuesta()
          : (respuesta ?? { estado: 404, cuerpo: { error: 'offer_not_found', message: 'the offer does not exist' } }),
      );
    });
    await this.page.route('**/v1/offers/*/renewal', async (ruta: Route) => {
      this.renovadas.push(idDe(ruta, 3));
      await responder(ruta, guion.renovar ?? { estado: 500, cuerpo: null });
    });
    await this.page.route('**/v1/offers/*/acceptance', async (ruta: Route) => {
      if (ruta.request().method() === 'POST') {
        this.aceptadas.push(ruta.request().postDataJSON());
        await responder(ruta, guion.aceptar ?? { estado: 500, cuerpo: null });
      } else {
        await responder(ruta, SIN_ACEPTACION);
      }
    });
  }

  /** Abre la oferta; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a la oferta. */
  async abrirConSesion(ofertaId: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(`/embebido/oferta/${ofertaId}`);
    await this.iniciarSesion(rol);
  }

  async iniciarSesion(rol: RolPrueba = 'asegurado'): Promise<void> {
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
