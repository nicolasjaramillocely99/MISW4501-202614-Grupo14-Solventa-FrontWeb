import { Page, Route } from '@playwright/test';

import { PRESTADORES_ASISTENCIA, TESELA_VACIA } from '../fixtures/asistencias';
import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

type Cuerpo = Record<string, unknown>;

/** Error del contrato: `{ status, error }`. */
export interface ErrorSimulado {
  status: number;
  error: string;
  fields?: { field: string; code: string }[];
}

type Respuesta = Cuerpo | ErrorSimulado;

export type AccionAsistencia = 'attend' | 'need' | 'voice-location' | 'dispatch' | 'close';

/** Lo que el gateway simulado recibió. */
export interface TraficoAsistencias {
  lecturasBandeja: number;
  lecturasDetalle: number;
  /** Cada escritura: la acción, la solicitud y el cuerpo (`null` = sin cuerpo). */
  escrituras: { accion: AccionAsistencia; id: string; cuerpo: Cuerpo | null }[];
  /** Consultas de `GET /v1/claims/providers` (`?specialty=`). */
  consultasPrestadores: string[];
}

/** Respuestas del gateway simulado. Una escritura exitosa cambia el detalle que devuelven las lecturas siguientes. */
export interface GuionAsistencias {
  /** Lecturas de la bandeja en orden; la última se repite. */
  bandejas?: Respuesta[];
  /** Lecturas del detalle por solicitud, en orden; la última se repite. */
  detalles?: Record<string, Respuesta[]>;
  politica?: Respuesta;
  /** La respuesta de cada escritura. */
  tras?: Partial<Record<AccionAsistencia, Respuesta>>;
  /** Si fallan las teselas de OpenStreetMap. */
  sinTeselas?: boolean;
}

const esError = (r: Respuesta): r is ErrorSimulado =>
  typeof r['error'] === 'string' && typeof r['status'] === 'number';

/** O9 · Asistencias en sitio y O9b · Detalle de la asistencia (HU-W2.3-03). */
export class AsistenciasPagina {
  constructor(private readonly page: Page) {}

  /**
   * Simula la bandeja, el detalle, la política, el registro de prestadores y las teselas del mapa. Llamarlo otra vez
   * cambia el guion: las rutas registradas después tienen prioridad.
   */
  async simularGateway(guion: GuionAsistencias): Promise<TraficoAsistencias> {
    const trafico: TraficoAsistencias = {
      lecturasBandeja: 0,
      lecturasDetalle: 0,
      escrituras: [],
      consultasPrestadores: [],
    };
    const bandejas = [...(guion.bandejas ?? [])];
    const detalles = Object.fromEntries(
      Object.entries(guion.detalles ?? {}).map(([id, lista]) => [id, [...lista]]),
    );
    const json = (ruta: Route, estado: number, cuerpo: unknown) =>
      ruta.fulfill({
        status: estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(cuerpo),
      });
    const responder = (ruta: Route, r: Respuesta | undefined) => {
      if (!r) {
        return json(ruta, 500, { error: 'sin_guion', message: 'simulado' });
      }
      return esError(r)
        ? json(ruta, r.status, { error: r.error, message: 'simulado', fields: r.fields })
        : json(ruta, 200, r);
    };
    const siguiente = (lista: Respuesta[] | undefined) =>
      lista && lista.length > 1 ? lista.shift() : lista?.[0];

    await this.page.route('https://tile.openstreetmap.org/**', (ruta) =>
      guion.sinTeselas
        ? ruta.abort()
        : ruta.fulfill({ status: 200, contentType: 'image/png', body: TESELA_VACIA }),
    );
    await this.page.route(
      (url) => url.pathname === '/v1/claims/assistance-policy',
      (ruta) => responder(ruta, guion.politica ?? { status: 503, error: 'assistance_unavailable' }),
    );
    await this.page.route(
      (url) => url.pathname === '/v1/claims/providers',
      (ruta) => {
        const url = new URL(ruta.request().url());
        trafico.consultasPrestadores.push(url.search);
        const especialidad = url.searchParams.get('specialty');
        const items = PRESTADORES_ASISTENCIA.filter(
          (p) => !especialidad || p.specialties.includes(especialidad),
        );
        return json(ruta, 200, { items });
      },
    );
    await this.page.route(
      (url) => url.pathname.startsWith('/v1/claims/assistance-inbox'),
      (ruta) => {
        const partes = new URL(ruta.request().url()).pathname.split('/').slice(4);
        const [id, accion] = partes as [string | undefined, AccionAsistencia | undefined];
        if (!id) {
          trafico.lecturasBandeja++;
          return responder(ruta, siguiente(bandejas));
        }
        if (!accion) {
          trafico.lecturasDetalle++;
          return responder(ruta, siguiente(detalles[id]));
        }
        const texto = ruta.request().postData();
        trafico.escrituras.push({
          accion,
          id,
          cuerpo: texto ? (JSON.parse(texto) as Cuerpo | null) : null,
        });
        const respuesta = guion.tras?.[accion];
        if (respuesta && !esError(respuesta)) {
          detalles[id] = [respuesta];
        }
        return responder(ruta, respuesta);
      },
    );
    return trafico;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(
      USUARIOS_PRUEBA[rol].correo,
      CONTRASENA_PRUEBA,
    );
  }

  /** El mapa de la bandeja. */
  mapaBandeja() {
    return this.page.getByRole('region', { name: 'Mapa de las solicitudes abiertas' });
  }

  /** El mapa del detalle. */
  mapaDetalle() {
    return this.page.getByRole('region', {
      name: 'Mapa del asegurado y de los prestadores cercanos',
    });
  }

  fila(numero: string) {
    return this.page.getByRole('row', { name: new RegExp(numero) });
  }

  /** «Cerrar solicitud» del encabezado, que envía el formulario de cierre. */
  async cerrarSolicitud(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cerrar solicitud' }).click();
  }
}
