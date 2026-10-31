import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { ArchivoPrueba } from '../fixtures/siniestros';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Origen simulado del *bucket* de S3 al que el navegador sube los soportes. */
const ORIGEN_S3 = 'https://evidencia.s3.test';

/** Respuesta simulada del API Gateway. */
export interface RespuestaSimulada {
  estado: number;
  cuerpo: unknown;
}

/**
 * Guion del servicio de siniestros (`claims`) para HU-W2.1-01. `radicaciones` responde los `POST` de la radicación en
 * orden (repite la última). Cada soporte se declara en el gateway, se sube con un `PUT` a S3 y se confirma: `soporte`
 * decide la respuesta de la declaración y `confirmacion` la de la confirmación, por el nombre del archivo (por omisión,
 * 201 con un `support_id` nuevo y 200). El `PUT` a S3 siempre responde 200. Se puede cambiar durante la prueba.
 */
export interface GuionSiniestros {
  opciones: RespuestaSimulada;
  soporte?: (nombreArchivo: string) => RespuestaSimulada | null;
  confirmacion?: (nombreArchivo: string) => RespuestaSimulada | null;
  radicaciones: RespuestaSimulada[];
  detalle: RespuestaSimulada;
  listado: RespuestaSimulada[];
}

/** Peticiones que recibió el gateway simulado. */
export interface LlamadasSiniestros {
  opciones: number;
  /** Nombre del archivo de cada soporte declarado. */
  soportes: string[];
  /** Cabeceras de cada `PUT` directo a S3 (que no debe llevar `Authorization`). */
  subidasS3: Record<string, string>[];
  /** `support_id` de cada confirmación. */
  confirmaciones: string[];
  radicaciones: { cuerpo: unknown; clave: string | undefined }[];
  detalles: string[];
  recibos: string[];
  /** Parámetros de cada consulta de «Mis siniestros». */
  listados: string[];
}

/** A6 / A6b · Radicar un siniestro con soportes y su confirmación (HU-W2.1-01). */
export class RadicacionSiniestroPagina {
  readonly titulo: Locator;
  readonly poliza: Locator;
  readonly tipo: Locator;
  readonly fecha: Locator;
  readonly lugar: Locator;
  readonly descripcion: Locator;
  readonly radicar: Locator;
  readonly soportes: Locator;
  readonly lateral: Locator;
  readonly antesDeRadicar: Locator;
  readonly descargar: Locator;
  readonly volver: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.poliza = page.getByLabel('Póliza afectada');
    this.tipo = page.getByLabel('Tipo de siniestro');
    this.fecha = page.getByLabel('Fecha y hora del hecho');
    this.lugar = page.getByLabel('Lugar del hecho');
    this.descripcion = page.getByLabel('Descripción de los hechos');
    this.radicar = page.getByRole('button', { name: 'Radicar siniestro' });
    this.soportes = page.getByRole('region', { name: 'Soportes' });
    this.lateral = page.getByRole('complementary', { name: 'Estado de la radicación' });
    this.antesDeRadicar = page.getByRole('region', { name: 'Antes de radicar' });
    this.descargar = page.getByRole('button', { name: 'Descargar radicado' });
    this.volver = page.getByRole('link', { name: 'Volver a mis siniestros' });
  }

  /** Responde todas las rutas `/v1/claims…` según el guion. */
  async simularGateway(guion: GuionSiniestros): Promise<LlamadasSiniestros> {
    const llamadas: LlamadasSiniestros = {
      opciones: 0,
      soportes: [],
      subidasS3: [],
      confirmaciones: [],
      radicaciones: [],
      detalles: [],
      recibos: [],
      listados: [],
    };
    let siguienteSoporte = 1;
    const declarados = new Map<string, { nombre: string; tipo: string; tamano: number; sha256: string }>();
    const responder = (ruta: Route, respuesta: RespuestaSimulada) =>
      ruta.fulfill({
        status: respuesta.estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(respuesta.cuerpo),
      });

    // El archivo va directo a S3 (otro origen): responde el preflight de CORS y el PUT firmado.
    await this.page.route(`${ORIGEN_S3}/**`, async (ruta) => {
      const peticion = ruta.request();
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'PUT,GET' };
      if (peticion.method() === 'PUT') {
        llamadas.subidasS3.push(await peticion.allHeaders());
      }
      await ruta.fulfill({ status: peticion.method() === 'OPTIONS' ? 204 : 200, headers: cors });
    });

    await this.page.route('**/v1/claims**', async (ruta) => {
      const peticion = ruta.request();
      const { pathname, searchParams } = new URL(peticion.url());
      const metodo = peticion.method();

      if (pathname === '/v1/claims/filing-options') {
        llamadas.opciones++;
        await responder(ruta, guion.opciones);
      } else if (pathname === '/v1/claims/supports' && metodo === 'POST') {
        const declaracion = peticion.postDataJSON() as {
          file_name: string;
          content_type: string;
          byte_size: number;
          sha256: string;
        };
        llamadas.soportes.push(declaracion.file_name);
        const respuesta = guion.soporte?.(declaracion.file_name) ?? null;
        const id = `sup-${String(siguienteSoporte++).padStart(32, '0')}`;
        declarados.set(id, {
          nombre: declaracion.file_name,
          tipo: declaracion.content_type,
          tamano: declaracion.byte_size,
          sha256: declaracion.sha256,
        });
        await responder(
          ruta,
          respuesta ?? {
            estado: 201,
            cuerpo: {
              support_id: id,
              file_name: declaracion.file_name,
              content_type: declaracion.content_type,
              byte_size: declaracion.byte_size,
              sha256: declaracion.sha256,
              upload_url: `${ORIGEN_S3}/supports/sub-asegurado/${id}?X-Amz-Signature=firma`,
              upload_headers: { 'Content-Type': declaracion.content_type },
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            },
          },
        );
      } else if (/^\/v1\/claims\/supports\/[^/]+\/confirmation$/.test(pathname) && metodo === 'POST') {
        const id = pathname.split('/')[4];
        llamadas.confirmaciones.push(id);
        const soporte = declarados.get(id);
        const respuesta = guion.confirmacion?.(soporte?.nombre ?? '') ?? null;
        await responder(
          ruta,
          respuesta ?? {
            estado: 200,
            cuerpo: {
              support_id: id,
              file_name: soporte?.nombre,
              content_type: soporte?.tipo,
              byte_size: soporte?.tamano,
              sha256: soporte?.sha256,
              confirmed_at: new Date().toISOString(),
            },
          },
        );
      } else if (pathname === '/v1/claims/web-filings' && metodo === 'POST') {
        llamadas.radicaciones.push({ cuerpo: peticion.postDataJSON(), clave: peticion.headers()['idempotency-key'] });
        const indice = Math.min(llamadas.radicaciones.length - 1, guion.radicaciones.length - 1);
        await responder(ruta, guion.radicaciones[indice]);
      } else if (pathname.endsWith('/filing-receipt')) {
        llamadas.recibos.push(pathname);
        await ruta.fulfill({
          status: 200,
          contentType: 'application/pdf',
          headers: { 'content-disposition': 'attachment; filename="radicado-SIN-2026-01712.pdf"' },
          body: Buffer.from('%PDF-1.7\n%radicado\n'),
        });
      } else if (pathname === '/v1/claims' && metodo === 'GET') {
        llamadas.listados.push(searchParams.toString());
        const indice = Math.min(llamadas.listados.length - 1, guion.listado.length - 1);
        await responder(ruta, guion.listado[indice]);
      } else if (metodo === 'GET') {
        llamadas.detalles.push(pathname);
        await responder(ruta, guion.detalle);
      } else {
        await ruta.fallback();
      }
    });
    return llamadas;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /** Elige la póliza y el tipo de siniestro por su texto. */
  async elegir(poliza: string, tipo: string): Promise<void> {
    await this.poliza.selectOption({ label: poliza });
    await this.tipo.selectOption({ label: tipo });
  }

  /** Diligencia la fecha (valor `datetime-local`), el lugar y la descripción. */
  async diligenciar(fechaLocal: string, lugar: string, descripcion: string): Promise<void> {
    await this.fecha.fill(fechaLocal);
    await this.lugar.fill(lugar);
    await this.descripcion.fill(descripcion);
  }

  /** Fila de un soporte por su nombre. */
  soporte(nombre: string): Locator {
    return this.soportes.getByRole('listitem').filter({ has: this.page.getByText(nombre, { exact: true }) }).first();
  }

  async subir(nombreSoporte: string, archivos: ArchivoPrueba | ArchivoPrueba[]): Promise<void> {
    await this.page.getByLabel(`Subir archivos de ${nombreSoporte}`).setInputFiles(archivos);
  }
}
