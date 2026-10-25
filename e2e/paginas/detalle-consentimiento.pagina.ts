import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { RespuestaConsentimiento, ok, parcial, reintentoEnCurso } from '../fixtures/consentimientos';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Lo que el portal pidió al gateway, en orden. */
export interface PeticionesConsentimiento {
  /** Ids consultados con `GET …/revocation`. */
  lecturas: string[];
  revocaciones: { id: string; claveIdempotencia: string | undefined; cuerpo: unknown }[];
  /** `cuerpo` es `null` cuando el reintento va sin cuerpo, como manda el contrato. */
  reintentos: { id: string; cuerpo: string | null; claveIdempotencia: string | undefined }[];
}

/** Respuestas del guion: cada petición consume la siguiente y la última se repite. */
export interface GuionConsentimiento {
  lecturas?: RespuestaConsentimiento[];
  revocaciones?: RespuestaConsentimiento[];
  reintentos?: RespuestaConsentimiento[];
}

function siguiente(respuestas: RespuestaConsentimiento[] | undefined, porDefecto: RespuestaConsentimiento): RespuestaConsentimiento {
  if (!respuestas || respuestas.length === 0) {
    return porDefecto;
  }
  return respuestas.length > 1 ? respuestas.shift()! : respuestas[0];
}

/** O15 / O15b / O15c · Detalle del consentimiento, confirmación y reintento de la revocación (HU-W4.2-02). */
export class DetalleConsentimientoPagina {
  readonly titulo: Locator;
  readonly estado: Locator;
  readonly revocar: Locator;
  readonly modal: Locator;
  readonly motivo: Locator;
  readonly referencia: Locator;
  readonly casillaRol: Locator;
  readonly revocarAhora: Locator;
  readonly cancelar: Locator;
  readonly reintentar: Locator;
  readonly entidades: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.estado = page.locator('app-insignia-estado').first();
    this.revocar = page.getByRole('button', { name: 'Revocar consentimiento' });
    this.modal = page.getByRole('dialog', { name: /Revocar el consentimiento de/ });
    this.motivo = this.modal.getByLabel('Motivo');
    this.referencia = this.modal.getByLabel('Referencia (ticket u orden)');
    this.casillaRol = this.modal.getByRole('checkbox', { name: /Confirmo que actúo como responsable de cumplimiento/ });
    this.revocarAhora = this.modal.getByRole('button', { name: /Revocar ahora|Revocando/ });
    this.cancelar = this.modal.getByRole('button', { name: 'Cancelar' });
    this.reintentar = page.getByRole('button', { name: /^Reintentar en / });
    this.entidades = page.getByRole('table', { name: 'Entidades financieras autorizadas' });
  }

  /**
   * Simula `GET …/revocation`, `POST …/revocations` y `POST …/revocation-retries` con el guion y devuelve lo que el
   * portal pidió. Sin guion responde un consentimiento sin revocar y un reintento sin efecto.
   */
  async simularGateway(guion: GuionConsentimiento): Promise<PeticionesConsentimiento> {
    const peticiones: PeticionesConsentimiento = { lecturas: [], revocaciones: [], reintentos: [] };
    await this.page.route('**/v1/audit/consents/**', async (ruta: Route) => {
      const peticion = ruta.request();
      const [, , , , id, accion] = new URL(peticion.url()).pathname.split('/').map(decodeURIComponent);
      let respuesta: RespuestaConsentimiento;
      if (accion === 'revocations' && peticion.method() === 'POST') {
        peticiones.revocaciones.push({
          id,
          claveIdempotencia: peticion.headers()['idempotency-key'],
          cuerpo: peticion.postDataJSON(),
        });
        respuesta = siguiente(guion.revocaciones, ok({}, 201));
      } else if (accion === 'revocation-retries' && peticion.method() === 'POST') {
        peticiones.reintentos.push({ id, cuerpo: peticion.postData(), claveIdempotencia: peticion.headers()['idempotency-key'] });
        respuesta = siguiente(guion.reintentos, ok({ retried_entities: ['banco-central'], state: reintentoEnCurso() }, 202));
      } else {
        peticiones.lecturas.push(id);
        respuesta = siguiente(guion.lecturas, ok(parcial()));
      }
      await ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });
    });
    return peticiones;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /** Llena el modal con una referencia y el motivo «Solicitud del cliente» y marca la casilla del rol. */
  async completarModal(referencia = 'TCK-2026-0412'): Promise<void> {
    await this.motivo.selectOption('customer_request');
    await this.referencia.fill(referencia);
    await this.casillaRol.check();
  }
}
