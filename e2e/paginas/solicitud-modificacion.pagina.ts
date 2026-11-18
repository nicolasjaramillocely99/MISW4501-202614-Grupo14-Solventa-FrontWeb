import { Locator, Page, Route } from '@playwright/test';

import { CONTRASENA_PRUEBA, RolPrueba, USUARIOS_PRUEBA } from '../fixtures/sesion-por-rol';
import { BILLETERA, POLIZA, condiciones, pagina, solicitud } from '../fixtures/solicitudes-modificacion';
import { InicioSesionPagina } from './inicio-sesion.pagina';

/** Una respuesta del API Gateway simulado. */
export interface RespuestaSolicitud {
  estado: number;
  cuerpo: unknown;
}

/** Lo que responde el gateway simulado; lo que falta usa los datos de `fixtures/solicitudes-modificacion`. */
export interface GuionSolicitudes {
  condiciones?: RespuestaSolicitud;
  /** Respuestas de cada `POST`, en orden; sin ellas, 201 con una solicitud radicada del tipo enviado. */
  radicar?: RespuestaSolicitud[];
  /** Detalle por identificador; sin él, 404. */
  detalles?: Record<string, RespuestaSolicitud>;
  /** La lista: una respuesta fija o, sin ella, el filtro del servicio sobre las seis solicitudes. */
  lista?: RespuestaSolicitud;
}

/**
 * A1 (entrada), A3 · Solicitar una modificación, A3b · Solicitud radicada y A11 · Mis solicitudes (HU-W1.4-01), con el
 * API Gateway simulado por `page.route`.
 */
export class SolicitudModificacionPagina {
  readonly titulo: Locator;
  readonly radicar: Locator;
  readonly nombre: Locator;
  readonly parentesco: Locator;
  readonly tipoDocumento: Locator;
  readonly numeroDocumento: Locator;
  readonly participacion: Locator;
  readonly agregar: Locator;
  readonly tabla: Locator;
  readonly filas: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole('heading', { level: 1 });
    this.radicar = page.getByRole('button', { name: /Radicar solicitud|Radicando/ });
    this.nombre = page.getByLabel('Nombre completo');
    this.parentesco = page.getByLabel('Parentesco');
    this.tipoDocumento = page.getByLabel('Tipo de documento');
    this.numeroDocumento = page.getByLabel('Número de documento');
    this.participacion = page.getByLabel('Participación (%)');
    this.agregar = page.getByRole('button', { name: 'Agregar beneficiario' });
    this.tabla = page.getByRole('table', { name: 'Solicitudes de modificación' });
    this.filas = this.tabla.locator('tbody tr');
  }

  tipo(nombre: string): Locator {
    return this.page.getByRole('radio', { name: new RegExp(nombre) });
  }

  async escribirBeneficiario(nombre: string, documento: string, participacion: string): Promise<void> {
    await this.nombre.fill(nombre);
    await this.parentesco.selectOption('child');
    await this.tipoDocumento.selectOption('TI');
    await this.numeroDocumento.fill(documento);
    await this.participacion.fill(participacion);
    await this.participacion.blur();
  }

  /** Simula el gateway; devuelve los cuerpos de los `POST` y las consultas de la lista, en orden. */
  async simular(guion: GuionSolicitudes = {}): Promise<{ radicadas: unknown[]; consultas: URLSearchParams[] }> {
    const radicadas: unknown[] = [];
    const consultas: URLSearchParams[] = [];
    const responder = (ruta: Route, r: RespuestaSolicitud) =>
      ruta.fulfill({ status: r.estado, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(r.cuerpo) });
    const radicar = [...(guion.radicar ?? [])];
    let numero = 60;

    await this.page.route((url) => url.pathname === '/v1/policies', (ruta) => responder(ruta, { estado: 200, cuerpo: BILLETERA }));
    await this.page.route(
      (url) => url.pathname.endsWith('/current-terms'),
      (ruta) => responder(ruta, guion.condiciones ?? { estado: 200, cuerpo: condiciones() }),
    );
    await this.page.route(
      (url) => /^\/v1\/policies\/[^/]+\/change-requests$/.test(url.pathname),
      async (ruta) => {
        const cuerpo = ruta.request().postDataJSON() as Record<string, unknown>;
        radicadas.push(cuerpo);
        numero += 1;
        const fija = radicar.shift();
        await responder(
          ruta,
          fija ?? { estado: 201, cuerpo: solicitud(`SOL-MOD-2026-00${numero}`, { change_type: cuerpo['change_type'] as string }) },
        );
      },
    );
    await this.page.route(
      (url) => url.pathname === '/v1/policies/change-requests',
      async (ruta) => {
        const params = new URL(ruta.request().url()).searchParams;
        consultas.push(params);
        await responder(ruta, guion.lista ?? { estado: 200, cuerpo: pagina(params) });
      },
    );
    await this.page.route(
      (url) => url.pathname.startsWith('/v1/policies/change-requests/'),
      (ruta) => {
        const id = decodeURIComponent(new URL(ruta.request().url()).pathname.split('/').pop() ?? '');
        const radicada = /^SOL-MOD-2026-006\d$/.test(id) ? { estado: 200, cuerpo: solicitud(id) } : undefined;
        return responder(
          ruta,
          guion.detalles?.[id] ?? radicada ?? { estado: 404, cuerpo: { error: 'change_request_not_found', message: 'not found' } },
        );
      },
    );
    return { radicadas, consultas };
  }

  /** Abre una ruta del portal; sin sesión el guard lleva al inicio de sesión y, al entrar, regresa a ella. */
  async abrirComo(ruta: string, rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.page.goto(ruta);
    await new InicioSesionPagina(this.page).ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);
  }

  /** A3 de la póliza de prueba. */
  async abrirModificar(rol: RolPrueba = 'asegurado'): Promise<void> {
    await this.abrirComo(`/originacion/polizas/${POLIZA}/modificar`, rol);
  }
}
