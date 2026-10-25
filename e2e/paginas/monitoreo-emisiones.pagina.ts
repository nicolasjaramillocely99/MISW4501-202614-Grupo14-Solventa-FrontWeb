import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Lo que el gateway simulado recibió, para verificar filtros y reintentos. */
export interface TraficoMonitoreo {
  /** Parámetros de cada `GET /v1/issuances`. */
  consultas: URLSearchParams[];
  /** Cuerpos de cada `POST …/retry`, con la aceptación. */
  reintentos: { aceptacion: string; nota: string }[];
}

/** Guion del gateway simulado. */
export interface GuionMonitoreo {
  /** Emisiones por estado filtrado; la clave vacía es «sin filtro de estado». */
  emisiones: Record<string, unknown[]>;
  conteos: Record<string, number>;
  acciones: unknown[];
}

/** O1 · Monitoreo de emisiones y O1b · Detalle de la excepción (HU-W1.3-04). */
export class MonitoreoEmisionesPagina {
  readonly titulo: Locator;
  readonly estado: Locator;
  readonly canal: Locator;
  readonly desde: Locator;
  readonly hasta: Locator;
  readonly actualizar: Locator;
  readonly dialogo: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.estado = page.getByLabel('Estado', { exact: true });
    this.canal = page.getByLabel('Canal', { exact: true });
    this.desde = page.getByLabel('Desde', { exact: true });
    this.hasta = page.getByLabel('Hasta', { exact: true });
    this.actualizar = page.getByRole('button', { name: 'Actualizar', exact: true });
    this.dialogo = page.getByRole('dialog');
  }

  /** Simula `GET /v1/issuances`, el historial y el reintento. Tras reintentar, la lista deja de tener las excepciones. */
  async simularGateway(guion: GuionMonitoreo): Promise<TraficoMonitoreo> {
    const trafico: TraficoMonitoreo = { consultas: [], reintentos: [] };
    let reintentada = false;
    const json = (ruta: Route, estado: number, cuerpo: unknown) =>
      ruta.fulfill({ status: estado, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(cuerpo) });

    await this.page.route((url) => url.pathname === '/v1/issuances', async (ruta) => {
      const params = new URL(ruta.request().url()).searchParams;
      trafico.consultas.push(params);
      const lista = guion.emisiones[params.get('status') ?? ''] ?? [];
      const visibles = reintentada ? lista.filter((e) => (e as { status: string }).status !== 'exception') : lista;
      await json(ruta, 200, { items: visibles, counts: guion.conteos });
    });
    await this.page.route('**/v1/issuances/*/actions', (ruta) => json(ruta, 200, { items: guion.acciones }));
    await this.page.route('**/v1/issuances/*/retry', async (ruta) => {
      const aceptacion = new URL(ruta.request().url()).pathname.split('/')[3];
      trafico.reintentos.push({ aceptacion, nota: (ruta.request().postDataJSON() as { note: string }).note });
      reintentada = true;
      await json(ruta, 202, { acceptance_id: aceptacion, action: 'resume' });
    });
    return trafico;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
