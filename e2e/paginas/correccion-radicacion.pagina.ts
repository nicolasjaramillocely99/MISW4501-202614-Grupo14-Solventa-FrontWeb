import { Page, Route } from '@playwright/test';

import {
  CASO_DEVUELTO,
  HISTORIAL_DEVUELTO,
  TRIAGE_SIN_NIVEL,
  reenviado,
} from '../fixtures/correccion';
import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { ArchivoPrueba } from '../fixtures/siniestros';
import { InicioSesionPagina } from './inicio-sesion.pagina';

const ORIGEN_S3 = 'https://evidencia.s3.test';

/** Lo que el gateway simulado recibió. */
export interface TraficoCorreccion {
  reenvios: Record<string, unknown>[];
  subidas: string[];
}

/** Cómo responde el reenvío: el 200 por defecto, o el estado y el cuerpo que se indiquen, en orden. */
export interface GuionCorreccion {
  respuestas?: { estado: number; cuerpo: unknown }[];
}

/** A9 · Edición de la radicación devuelta (HU-W2.1-04) y su entrada desde el detalle del siniestro (A8). */
export class CorreccionRadicacionPagina {
  constructor(private readonly page: Page) {}

  /**
   * Simula las rutas de `claims` del asegurado: el caso, su historial, la prioridad, la subida de soportes (declaración,
   * PUT a S3 y confirmación) y el reenvío.
   */
  async simularGateway(guion: GuionCorreccion = {}): Promise<TraficoCorreccion> {
    const trafico: TraficoCorreccion = { reenvios: [], subidas: [] };
    let caso: Record<string, unknown> = CASO_DEVUELTO;
    let historial: Record<string, unknown> = HISTORIAL_DEVUELTO;
    let siguiente = 100;
    const declarados = new Map<
      string,
      { nombre: string; tipo: string; tamano: number; sha256: string }
    >();
    const json = (ruta: Route, estado: number, cuerpo: unknown) =>
      ruta.fulfill({
        status: estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(cuerpo),
      });

    await this.page.route(`${ORIGEN_S3}/**`, (ruta) =>
      ruta.fulfill({
        status: ruta.request().method() === 'OPTIONS' ? 204 : 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'PUT,GET',
        },
      }),
    );

    await this.page.route('**/v1/claims/**', async (ruta) => {
      const peticion = ruta.request();
      const { pathname } = new URL(peticion.url());
      const metodo = peticion.method();

      if (pathname === '/v1/claims/supports' && metodo === 'POST') {
        const d = peticion.postDataJSON() as {
          file_name: string;
          content_type: string;
          byte_size: number;
          sha256: string;
        };
        const id = `sup-${String(siguiente++).padStart(32, '0')}`;
        declarados.set(id, {
          nombre: d.file_name,
          tipo: d.content_type,
          tamano: d.byte_size,
          sha256: d.sha256,
        });
        trafico.subidas.push(d.file_name);
        await json(ruta, 201, {
          support_id: id,
          file_name: d.file_name,
          content_type: d.content_type,
          byte_size: d.byte_size,
          sha256: d.sha256,
          upload_url: `${ORIGEN_S3}/supports/sub-asegurado/${id}?X-Amz-Signature=firma`,
          upload_headers: { 'Content-Type': d.content_type },
          expires_at: new Date(Date.now() + 600_000).toISOString(),
        });
      } else if (/^\/v1\/claims\/supports\/[^/]+\/confirmation$/.test(pathname)) {
        const id = pathname.split('/')[4];
        const s = declarados.get(id)!;
        await json(ruta, 200, {
          support_id: id,
          file_name: s.nombre,
          content_type: s.tipo,
          byte_size: s.tamano,
          sha256: s.sha256,
          confirmed_at: new Date().toISOString(),
        });
      } else if (pathname.endsWith('/resubmission') && metodo === 'POST') {
        const cuerpo = peticion.postDataJSON() as Record<string, unknown>;
        trafico.reenvios.push(cuerpo);
        const respuesta = guion.respuestas?.[trafico.reenvios.length - 1] ?? {
          estado: 200,
          cuerpo: reenviado(cuerpo),
        };
        if (respuesta.estado === 200) {
          caso = { ...caso, status: 'active' };
          historial = { ...historial, status: 'active', last_return: null };
        }
        await json(ruta, respuesta.estado, respuesta.cuerpo);
      } else if (pathname.endsWith('/history')) {
        await json(ruta, 200, historial);
      } else if (pathname.endsWith('/triage')) {
        await json(ruta, 200, TRIAGE_SIN_NIVEL);
      } else if (metodo === 'GET') {
        await json(ruta, 200, caso);
      } else {
        await ruta.fallback();
      }
    });
    return trafico;
  }

  async subir(etiqueta: string, archivos: ArchivoPrueba | ArchivoPrueba[]): Promise<void> {
    await this.page.getByLabel(etiqueta).setInputFiles(archivos);
  }

  fila(codigo: string) {
    return this.page.locator(`[data-codigo="${codigo}"]`);
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA[rol].correo,
      CONTRASENA_PRUEBA,
    );
  }
}
