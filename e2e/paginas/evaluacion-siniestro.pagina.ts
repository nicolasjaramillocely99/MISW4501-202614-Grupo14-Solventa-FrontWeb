import { Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { POLITICA_V1 } from '../fixtures/triage';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Lo que el gateway simulado recibió. */
export interface TraficoEvaluacion {
  /** Los filtros de cada lectura de la cola por prioridad (HU-W2.2-02). */
  consultasCola: URLSearchParams[];
  aprobaciones: unknown[];
  rechazos: unknown[];
  reintentos: unknown[];
}

/** Respuestas del gateway simulado: el detalle cambia según la decisión que se registre. */
export interface GuionEvaluacion {
  cola: unknown[];
  /** Indicadores de la cola (HU-W2.2-02); sin ellos, los de la cola que se pasa. */
  resumen?: Record<string, unknown>;
  excepciones: unknown[];
  /** El detalle antes de decidir. */
  detalle: Record<string, unknown>;
  /** La decisión que deja la aprobación (la siguiente lectura la trae). */
  trasAprobar?: Record<string, unknown>;
  trasRechazar?: Record<string, unknown>;
  trasReintentar?: Record<string, unknown>;
}

/** O5 mínima · Cola de siniestros, O6 · Evaluación y O6b · Pago fallido (HU-W2.2-03). */
export class EvaluacionSiniestroPagina {
  constructor(private readonly page: Page) {}

  /** Simula las rutas de operaciones de `claims`: la cola, las excepciones, el detalle y las tres decisiones. */
  async simularGateway(guion: GuionEvaluacion): Promise<TraficoEvaluacion> {
    const trafico: TraficoEvaluacion = { consultasCola: [], aprobaciones: [], rechazos: [], reintentos: [] };
    let detalle = guion.detalle;
    const json = (ruta: Route, estado: number, cuerpo: unknown) =>
      ruta.fulfill({ status: estado, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(cuerpo) });
    const decidir = (decision: Record<string, unknown>) => {
      detalle = { ...detalle, claim: { ...(detalle['claim'] as object), status: decision['status'] }, decision };
      return decision;
    };

    await this.page.route(
      (url) => url.pathname === '/v1/claims/evaluations',
      (ruta) => {
        trafico.consultasCola.push(new URL(ruta.request().url()).searchParams);
        return json(ruta, 200, {
          items: guion.cola,
          next_page_token: null,
          summary: guion.resumen ?? {
            total: guion.cola.length,
            matching: guion.cola.length,
            levels: [1, 2, 3].map((level) => ({ level, claims: 0 })),
            unassessed: 0,
            mean_resolution_days: null,
            decided_in_window: 0,
            window_days: 30,
          },
        });
      },
    );
    await this.page.route((url) => url.pathname === '/v1/claims/triage-policy', (ruta) => json(ruta, 200, POLITICA_V1));
    await this.page.route((url) => url.pathname === '/v1/claims/payment-exceptions', (ruta) =>
      json(ruta, 200, { items: guion.excepciones, next_page_token: null }),
    );
    await this.page.route('**/v1/claims/*/evaluation', (ruta) => json(ruta, 200, detalle));
    await this.page.route('**/v1/claims/*/approval', async (ruta) => {
      trafico.aprobaciones.push(ruta.request().postDataJSON());
      await json(ruta, 202, decidir(guion.trasAprobar!));
    });
    await this.page.route('**/v1/claims/*/rejection', async (ruta) => {
      trafico.rechazos.push(ruta.request().postDataJSON());
      await json(ruta, 200, decidir(guion.trasRechazar!));
    });
    await this.page.route('**/v1/claims/*/payout-retry', async (ruta) => {
      trafico.reintentos.push(ruta.request().postDataJSON());
      await json(ruta, 202, decidir(guion.trasReintentar!));
    });
    return trafico;
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'operaciones'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }
}
