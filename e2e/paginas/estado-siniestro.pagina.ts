import { Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

export const ORIGEN_BUCKET = 'https://evidencia.s3.test';

/** Guion del gateway: lo que responde cada lectura; se puede cambiar durante la prueba para simular un cambio de etapa. */
export interface GuionEstado {
  listado: Record<string, unknown>;
  /** Si está, responde el listado según los filtros de la consulta; si no, siempre `listado`. */
  listadoPara?: (filtros: URLSearchParams) => Record<string, unknown>;
  caso: Record<string, unknown>;
  historial: Record<string, unknown>;
  triage: Record<string, unknown>;
}

/** Lo que el gateway simulado recibió. */
export interface TraficoEstado {
  listados: string[];
  historiales: number;
  descargas: string[];
}

/** A7 · Mis siniestros y A8 · Detalle y estado del siniestro (HU-W2.1-02). */
export class EstadoSiniestroPagina {
  constructor(private readonly page: Page) {}

  /** Simula las lecturas del asegurado: el listado, el caso, su historial, la prioridad y la descarga de un soporte. */
  async simularGateway(guion: GuionEstado): Promise<TraficoEstado> {
    const trafico: TraficoEstado = { listados: [], historiales: 0, descargas: [] };
    const json = (ruta: Route, cuerpo: unknown) =>
      ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(cuerpo),
      });

    // La descarga se abre en otra pestaña: el bucket se simula para todo el contexto.
    await this.page.context().route(`${ORIGEN_BUCKET}/**`, (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.7\n'),
      }),
    );
    await this.page.route('**/v1/claims**', async (ruta) => {
      const { pathname, searchParams } = new URL(ruta.request().url());
      if (pathname === '/v1/claims') {
        trafico.listados.push(searchParams.toString());
        await json(ruta, guion.listadoPara?.(searchParams) ?? guion.listado);
      } else if (pathname === '/v1/claims/filing-options') {
        await json(ruta, { catalog_version: 'claim-catalog-v1', policies: [] });
      } else if (pathname.endsWith('/history')) {
        trafico.historiales++;
        await json(ruta, guion.historial);
      } else if (pathname.endsWith('/triage')) {
        await json(ruta, guion.triage);
      } else if (pathname.endsWith('/download')) {
        const soporte = pathname.split('/')[5];
        trafico.descargas.push(soporte);
        await json(ruta, {
          support_id: soporte,
          file_name: 'croquis.pdf',
          content_type: 'application/pdf',
          byte_size: 482113,
          download_url: `${ORIGEN_BUCKET}/supports/sub-asegurado/${soporte}?X-Amz-Signature=get`,
          expires_at: new Date(Date.now() + 600_000).toISOString(),
        });
      } else {
        await json(ruta, guion.caso);
      }
    });
    return trafico;
  }

  async abrirComo(ruta: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA[rol].correo,
      CONTRASENA_PRUEBA,
    );
  }

  etapa(clave: string) {
    return this.page.locator(`[data-etapa="${clave}"]`);
  }
}
