import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Respuesta simulada del API Gateway. */
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

/** Guion del servicio de originación para HU-W1.1-01. */
export interface GuionCotizacionAsistida {
  /** `GET /v1/customers?document_id=`. */
  cliente?: RespuestaSimulada;
  /** `POST /v1/assisted-quotes`. */
  crear?: RespuestaSimulada;
  /** `GET /v1/assisted-quotes/{id}`. */
  consultar?: RespuestaSimulada;
}

/** Peticiones recibidas por el gateway simulado. */
export interface LlamadasCotizacionAsistida {
  clientes: string[];
  creadas: unknown[];
  consultadas: string[];
}

/** S1 · Datos del cliente y S2 / S2b · Resultado de la cotización asistida (HU-W1.1-01). */
export class CotizacionAsistidaPagina {
  readonly titulo: Locator;
  readonly documento: Locator;
  readonly nombre: Locator;
  readonly correo: Locator;
  readonly nacimiento: Locator;
  readonly monto: Locator;
  readonly plazo: Locator;
  readonly consentimiento: Locator;
  readonly buscar: Locator;
  readonly cotizar: Locator;
  readonly alerta: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.documento = page.getByLabel('Documento de identidad');
    this.nombre = page.getByLabel('Nombre completo');
    this.correo = page.getByLabel('Correo electrónico');
    this.nacimiento = page.getByLabel('Fecha de nacimiento');
    this.monto = page.getByLabel('Monto asegurado (COP)');
    this.plazo = page.getByLabel('Plazo (meses)');
    this.consentimiento = page.getByRole('checkbox');
    this.buscar = page.getByRole('button', { name: 'Buscar cliente' });
    this.cotizar = page.getByRole('button', { name: 'Generar cotización' });
    this.alerta = page.getByRole('alert');
  }

  /** Responde las rutas de cotización asistida según el guion; lo no definido responde 503. */
  async simularGateway(guion: GuionCotizacionAsistida): Promise<LlamadasCotizacionAsistida> {
    const llamadas: LlamadasCotizacionAsistida = { clientes: [], creadas: [], consultadas: [] };
    const responder = (ruta: Route, respuesta: RespuestaSimulada | undefined) =>
      ruta.fulfill({
        status: respuesta?.estado ?? 503,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta?.cuerpo ?? { error: 'quote_unavailable', message: 'no simulado' }),
      });

    await this.page.route('**/v1/customers?*', async (ruta) => {
      llamadas.clientes.push(new URL(ruta.request().url()).searchParams.get('document_id') ?? '');
      await responder(ruta, guion.cliente);
    });
    await this.page.route('**/v1/assisted-quotes', async (ruta) => {
      llamadas.creadas.push(ruta.request().postDataJSON());
      await responder(ruta, guion.crear);
    });
    await this.page.route('**/v1/assisted-quotes/*', async (ruta) => {
      llamadas.consultadas.push(new URL(ruta.request().url()).pathname);
      await responder(ruta, guion.consultar);
    });
    return llamadas;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComoAsesor(ruta: string): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA.asesor.correo, CONTRASENA_PRUEBA);
  }

  async llenarDatos(valores: { documento?: string; nombre?: string; correo?: string; nacimiento?: string; monto?: string; plazo?: string } = {}): Promise<void> {
    await this.documento.fill(valores.documento ?? '1032456789');
    await this.nombre.fill(valores.nombre ?? 'Ana María Pérez');
    await this.correo.fill(valores.correo ?? 'ana@example.com');
    await this.nacimiento.fill(valores.nacimiento ?? '1990-05-20');
    await this.monto.fill(valores.monto ?? '250000000');
    await this.plazo.fill(valores.plazo ?? '180');
  }
}
