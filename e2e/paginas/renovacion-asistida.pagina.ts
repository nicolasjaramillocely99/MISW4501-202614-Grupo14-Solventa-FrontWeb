import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { RespuestaSimulada } from './cotizacion-asistida.pagina';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Una respuesta o una lista que se consume en orden y repite la última. */
type Respuestas = RespuestaSimulada | RespuestaSimulada[];

/** Guion del servicio de originación para HU-W1.5-03; lo no definido responde 503. */
export interface GuionRenovacionAsistida {
  /** `GET /v1/policies/{id}/assisted-renewal`. */
  vista?: Respuestas;
  /** `POST …/assisted-renewal/requotes`. */
  recotizar?: Respuestas;
  /** `POST …/assisted-renewal/consent`. */
  codigo?: Respuestas;
  /** `POST …/assisted-renewal/formalization`. */
  formalizar?: Respuestas;
  /** `GET /v1/policies/{id}/issuance-status` de la póliza nueva. */
  emision?: Respuestas;
}

/** Peticiones recibidas por el gateway simulado, con los cuerpos enviados. */
export interface LlamadasRenovacionAsistida {
  vistas: number;
  recotizaciones: unknown[];
  codigos: unknown[];
  formalizaciones: unknown[];
  emisiones: number;
}

/** S7 · Renovación asistida con recotización y S7b · Renovación formalizada (HU-W1.5-03). */
export class RenovacionAsistidaPagina {
  readonly titulo: Locator;
  readonly subtitulo: Locator;
  readonly recotizar: Locator;
  readonly reintentar: Locator;
  readonly formalizar: Locator;
  readonly medio: Locator;
  readonly fecha: Locator;
  readonly referencia: Locator;
  readonly codigo: Locator;
  readonly enviarCodigo: Locator;
  readonly reenviarCodigo: Locator;
  readonly casillaAceptacion: Locator;
  readonly casillaConsentimiento: Locator;
  readonly comparativo: Locator;
  readonly trazabilidad: Locator;
  readonly emision: Locator;
  readonly prima: Locator;
  readonly alerta: Locator;
  readonly volverARenovaciones: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.subtitulo = page.locator('.pagina__subtitulo');
    this.recotizar = page.getByRole('button', { name: /^(Recotizar|Recotizando…)$/ });
    this.reintentar = page.getByRole('button', { name: 'Reintentar' });
    this.formalizar = page.getByRole('button', { name: /^(Formalizar renovación|Formalizando…)$/ });
    this.medio = page.getByLabel('Medio por el que aceptó');
    this.fecha = page.getByLabel('Fecha y hora');
    this.referencia = page.getByLabel('Referencia');
    this.codigo = page.getByLabel('Código de 6 dígitos');
    this.enviarCodigo = page.getByRole('button', { name: 'Enviar código' });
    this.reenviarCodigo = page.getByRole('button', { name: 'Reenviar código' });
    this.casillaAceptacion = page.getByRole('checkbox', { name: /El cliente aceptó las condiciones recotizadas/ });
    this.casillaConsentimiento = page.getByRole('checkbox', { name: /El cliente autorizó consultar sus datos financieros/ });
    this.comparativo = page.getByRole('region', { name: 'Condiciones vigentes y recotizadas' });
    this.trazabilidad = page.locator('app-trazabilidad-recotizacion');
    this.emision = page.locator('app-estado-cobro-renovacion');
    this.prima = page.getByRole('region', { name: 'Nueva prima mensual' });
    this.alerta = page.getByRole('alert');
    this.volverARenovaciones = page.getByRole('button', { name: 'Volver a renovaciones' });
  }

  /** Responde las rutas de la renovación asistida según el guion y cuenta las llamadas. */
  async simularGateway(guion: GuionRenovacionAsistida): Promise<LlamadasRenovacionAsistida> {
    const llamadas: LlamadasRenovacionAsistida = { vistas: 0, recotizaciones: [], codigos: [], formalizaciones: [], emisiones: 0 };
    const elegir = (respuestas: Respuestas | undefined, turno: number) =>
      Array.isArray(respuestas) ? respuestas[Math.min(turno, respuestas.length - 1)] : respuestas;
    const responder = (ruta: Route, respuesta: RespuestaSimulada | undefined) =>
      ruta.fulfill({
        status: respuesta?.estado ?? 503,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta?.cuerpo ?? { error: 'renewal_unavailable', message: 'no simulado' }),
      });
    const cuerpo = (ruta: Route): unknown => {
      const texto = ruta.request().postData();
      return texto ? JSON.parse(texto) : null;
    };

    await this.page.route('**/v1/policies/*/assisted-renewal', async (ruta) => {
      await responder(ruta, elegir(guion.vista, llamadas.vistas++));
    });
    await this.page.route('**/v1/policies/*/assisted-renewal/requotes', async (ruta) => {
      llamadas.recotizaciones.push(cuerpo(ruta));
      await responder(ruta, elegir(guion.recotizar, llamadas.recotizaciones.length - 1));
    });
    await this.page.route('**/v1/policies/*/assisted-renewal/consent', async (ruta) => {
      llamadas.codigos.push(cuerpo(ruta));
      await responder(ruta, elegir(guion.codigo, llamadas.codigos.length - 1));
    });
    await this.page.route('**/v1/policies/*/assisted-renewal/formalization', async (ruta) => {
      llamadas.formalizaciones.push(cuerpo(ruta));
      await responder(ruta, elegir(guion.formalizar, llamadas.formalizaciones.length - 1));
    });
    await this.page.route('**/v1/policies/*/issuance-status', async (ruta) => {
      await responder(ruta, elegir(guion.emision, llamadas.emisiones++));
    });
    return llamadas;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asesor'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /** Registra la aceptación por llamada grabada con su referencia y la casilla del cobro. */
  async aceptarPorLlamada(referencia = 'GRAB-2026-88931'): Promise<void> {
    await this.referencia.fill(referencia);
    await this.casillaAceptacion.check();
  }

  /** Una fila (fuente o motor) del panel de la recotización. */
  fuente(nombre: string): Locator {
    return this.trazabilidad.getByRole('listitem').filter({ hasText: nombre });
  }

  /** Un paso del panel del cobro y la emisión, por el nombre con que empieza (otro paso puede mencionarlo). */
  paso(nombre: string): Locator {
    return this.emision.getByRole('listitem').filter({ hasText: new RegExp('^\\s*' + nombre) });
  }
}
