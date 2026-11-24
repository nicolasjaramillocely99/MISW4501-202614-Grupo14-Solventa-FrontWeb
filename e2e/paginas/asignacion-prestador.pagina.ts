import { Page, Route } from '@playwright/test';

import { PRESTADORES, TESELA_VACIA } from '../fixtures/asignacion';
import { DETALLE } from '../fixtures/evaluacion';
import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from './inicio-sesion.pagina';

type Cuerpo = Record<string, unknown>;

/** Lo que el gateway simulado recibió. */
export interface TraficoAsignacion {
  /** Cuerpo de cada búsqueda (`null` = sin cuerpo). */
  busquedas: (Cuerpo | null)[];
  asignaciones: Cuerpo[];
  ubicaciones: Cuerpo[];
  disponibilidades: { id: string; cuerpo: Cuerpo }[];
  /** Consultas de `GET /v1/claims/providers` (`?specialty=&availability=`). */
  consultasPrestadores: string[];
  lecturas: number;
}

/** Error del contrato: `{ status, error }`. */
export interface ErrorSimulado {
  status: number;
  error: string;
  fields?: { field: string; code: string }[];
}

/** Respuestas del gateway simulado. Cada escritura cambia la asignación que devuelven las lecturas siguientes. */
export interface GuionAsignacion {
  /** Lecturas de `GET …/assignment` en orden; la última se repite. */
  lecturas: (Cuerpo | ErrorSimulado)[];
  politica?: Cuerpo | ErrorSimulado;
  trasBuscar?: (cuerpo: Cuerpo | null) => Cuerpo | ErrorSimulado;
  trasAsignar?: Cuerpo | ErrorSimulado;
  trasUbicar?: Cuerpo | ErrorSimulado;
  /** Si fallan las teselas de OpenStreetMap. */
  sinTeselas?: boolean;
}

const esError = (r: Cuerpo | ErrorSimulado): r is ErrorSimulado =>
  typeof r['error'] === 'string' && typeof r['status'] === 'number';

/** O7 · Asignar prestador, O7b · Pendiente de asignación y la administración de prestadores (HU-W2.3-01). */
export class AsignacionPrestadorPagina {
  constructor(private readonly page: Page) {}

  /** Simula las rutas de la asignación y de los prestadores de `claims`, el detalle de O6 y las teselas del mapa. */
  async simularGateway(guion: GuionAsignacion): Promise<TraficoAsignacion> {
    const trafico: TraficoAsignacion = {
      busquedas: [],
      asignaciones: [],
      ubicaciones: [],
      disponibilidades: [],
      consultasPrestadores: [],
      lecturas: 0,
    };
    const lecturas = [...guion.lecturas];
    let actual: Cuerpo | ErrorSimulado = lecturas[0];
    let prestadores = PRESTADORES.map((p) => ({ ...p })) as Cuerpo[];
    const json = (ruta: Route, estado: number, cuerpo: unknown) =>
      ruta.fulfill({
        status: estado,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(cuerpo),
      });
    const responder = (ruta: Route, estado: number, r: Cuerpo | ErrorSimulado) =>
      esError(r)
        ? json(ruta, r.status, { error: r.error, message: 'simulado', fields: r.fields })
        : json(ruta, estado, r);
    const escribir = (ruta: Route, r: Cuerpo | ErrorSimulado | undefined) => {
      if (r && !esError(r)) {
        actual = r;
        lecturas.length = 0;
      }
      return responder(ruta, 201, r ?? { status: 500, error: 'sin_guion' });
    };

    await this.page.route('https://tile.openstreetmap.org/**', (ruta) =>
      guion.sinTeselas
        ? ruta.abort()
        : ruta.fulfill({ status: 200, contentType: 'image/png', body: TESELA_VACIA }),
    );
    await this.page.route('**/v1/claims/*/evaluation', (ruta) => json(ruta, 200, DETALLE));
    await this.page.route(
      (url) => url.pathname === '/v1/claims/assignment-policy',
      (ruta) =>
        responder(ruta, 200, guion.politica ?? { status: 503, error: 'claims_unavailable' }),
    );
    await this.page.route(
      (url) => url.pathname === '/v1/claims/providers',
      (ruta) => {
        const url = new URL(ruta.request().url());
        trafico.consultasPrestadores.push(url.search);
        const especialidad = url.searchParams.get('specialty');
        const disponibilidad = url.searchParams.get('availability');
        const items = prestadores.filter(
          (p) =>
            (!especialidad || (p['specialties'] as string[]).includes(especialidad)) &&
            (!disponibilidad || p['availability'] === disponibilidad),
        );
        return json(ruta, 200, { items });
      },
    );
    await this.page.route('**/v1/claims/providers/*/availability', (ruta) => {
      const id = new URL(ruta.request().url()).pathname.split('/')[4];
      const cuerpo = ruta.request().postDataJSON() as Cuerpo;
      trafico.disponibilidades.push({ id, cuerpo });
      prestadores = prestadores.map((p) =>
        p['id'] === id
          ? {
              ...p,
              availability: cuerpo['availability'],
              unavailable_until: cuerpo['unavailable_until'] ?? null,
              busy_claim_id: null,
              updated_by: 'andres.ruiz@solventa.example',
            }
          : p,
      );
      return json(
        ruta,
        200,
        prestadores.find((p) => p['id'] === id),
      );
    });
    await this.page.route('**/v1/claims/*/assignment', (ruta) => {
      if (ruta.request().method() === 'POST') {
        trafico.asignaciones.push(ruta.request().postDataJSON() as Cuerpo);
        return escribir(ruta, guion.trasAsignar);
      }
      trafico.lecturas++;
      if (lecturas.length > 0) {
        actual = lecturas.length > 1 ? (lecturas.shift() as Cuerpo) : lecturas[0];
      }
      return responder(ruta, 200, actual);
    });
    await this.page.route('**/v1/claims/*/provider-searches', (ruta) => {
      const texto = ruta.request().postData();
      const cuerpo = texto ? (JSON.parse(texto) as Cuerpo | null) : null;
      trafico.busquedas.push(cuerpo);
      return escribir(ruta, guion.trasBuscar?.(cuerpo));
    });
    await this.page.route('**/v1/claims/*/incident-location', (ruta) => {
      trafico.ubicaciones.push(ruta.request().postDataJSON() as Cuerpo);
      return escribir(ruta, guion.trasUbicar);
    });
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

  /** El lienzo de Leaflet (región «Mapa del incidente y de los prestadores»). */
  mapa() {
    return this.page.getByRole('region', { name: 'Mapa del incidente y de los prestadores' });
  }

  /** Confirma en el diálogo la asignación que se pidió. */
  async confirmarAsignacion(): Promise<void> {
    await this.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirmar asignación' })
      .click();
  }
}
