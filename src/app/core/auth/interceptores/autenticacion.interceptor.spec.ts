import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import {
  ProveedorIdentidadFalso,
  crearProveedorIdentidadFalso,
  crearTokensPrueba,
  iniciarSesionComo,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';
import { firstValueFrom } from 'rxjs';

import { SesionService } from '../sesion.service';
import { autenticacionInterceptor, esDelApiGateway } from './autenticacion.interceptor';

const GATEWAY = environment.apiGatewayUrl.replace(/\/+$/, '');

describe('autenticacionInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let sesion: SesionService;
  let navegar: ReturnType<typeof vi.spyOn>;
  let proveedor: ProveedorIdentidadFalso;

  beforeEach(() => {
    proveedor = crearProveedorIdentidadFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([autenticacionInterceptor])),
        provideHttpClientTesting(),
        ...proveerSesionPrueba(proveedor),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    sessionStorage.clear();
  });

  async function fallaCon(url: string, status: number): Promise<HttpErrorResponse> {
    const respuesta = firstValueFrom(http.get(url));
    backend.expectOne(url).flush({ error: 'x', message: 'y' }, { status, statusText: 'Error' });
    try {
      await respuesta;
    } catch (error) {
      return error as HttpErrorResponse;
    }
    throw new Error('se esperaba un error HTTP');
  }

  it('adjunta el ID token a las peticiones al API Gateway', async () => {
    await iniciarSesionComo('asesor');

    const respuesta = firstValueFrom(http.get(`${GATEWAY}/v1/quotes`));
    const peticion = backend.expectOne(`${GATEWAY}/v1/quotes`);
    expect(peticion.request.headers.get('Authorization')).toBe(`Bearer ${sesion.idToken()}`);
    peticion.flush({});
    await respuesta;
  });

  it('no adjunta nada sin sesión', async () => {
    const respuesta = firstValueFrom(http.get(`${GATEWAY}/v1/quotes`));
    const peticion = backend.expectOne(`${GATEWAY}/v1/quotes`);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
    await respuesta;
  });

  it.each([
    'https://cognito-idp.us-east-2.amazonaws.com/',
    'i18n/es-CO.json',
    `${GATEWAY}1/v1/quotes`,
    'https://otro-origen.example/v1/quotes',
  ])('nunca adjunta el token a %s', async (url) => {
    await iniciarSesionComo('operaciones');

    const respuesta = firstValueFrom(http.get(url));
    const peticion = backend.expectOne(url);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
    await respuesta;
  });

  it('un 401 sin poder renovar el token termina la sesión y lleva a sesión expirada', async () => {
    await iniciarSesionComo('asesor');
    proveedor.refrescar.mockRejectedValueOnce(new Error('renovación revocada'));

    const error = await fallaCon(`${GATEWAY}/v1/quotes`, 401);

    expect(error.status).toBe(401);
    expect(sesion.autenticado()).toBe(false);
    expect(sesion.expirada()).toBe(true);
    expect(navegar).toHaveBeenCalledWith('/acceso/sesion-expirada');
  });

  it('un 401 renueva el token y reintenta la petición una vez con el token nuevo', async () => {
    await iniciarSesionComo('asegurado');
    const tokensNuevos = crearTokensPrueba('asegurado', { claims: { renovado: true } });
    proveedor.refrescar.mockResolvedValueOnce(tokensNuevos);
    const url = `${GATEWAY}/v1/acceptances/a-1`;

    const respuesta = firstValueFrom(http.get(url));
    backend
      .expectOne(url)
      .flush({ error: 'unauthorized', message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    const reintento = await vi.waitFor(() => backend.expectOne(url));

    expect(proveedor.refrescar).toHaveBeenCalledWith('renovacion-asegurado');
    expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${tokensNuevos.idToken}`);
    reintento.flush({ ok: true });
    expect(await respuesta).toEqual({ ok: true });
    expect(sesion.autenticado()).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si el reintento vuelve a dar 401 no reintenta más y lleva a sesión expirada', async () => {
    await iniciarSesionComo('asegurado');
    proveedor.refrescar.mockResolvedValueOnce(crearTokensPrueba('asegurado'));
    const url = `${GATEWAY}/v1/acceptances/a-1`;

    const respuesta = firstValueFrom(http.get(url));
    backend
      .expectOne(url)
      .flush({ error: 'unauthorized', message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    const reintento = await vi.waitFor(() => backend.expectOne(url));
    reintento.flush({ error: 'unauthorized', message: 'x' }, { status: 401, statusText: 'Unauthorized' });

    await expect(respuesta).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(proveedor.refrescar).toHaveBeenCalledTimes(1);
    expect(sesion.expirada()).toBe(true);
    expect(navegar).toHaveBeenCalledWith('/acceso/sesion-expirada');
  });

  it('un 403 del gateway lleva a acceso no autorizado sin cerrar la sesión', async () => {
    await iniciarSesionComo('asegurado');

    const error = await fallaCon(`${GATEWAY}/v1/claims/otro`, 403);

    expect(error.status).toBe(403);
    expect(sesion.autenticado()).toBe(true);
    expect(navegar).toHaveBeenCalledWith('/acceso/no-autorizado');
  });

  it('otros errores del gateway solo se propagan', async () => {
    await iniciarSesionComo('asesor');

    expect((await fallaCon(`${GATEWAY}/v1/quotes`, 503)).status).toBe(503);
    expect(sesion.autenticado()).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un 401 de otro origen no toca la sesión', async () => {
    await iniciarSesionComo('asesor');

    await fallaCon('https://otro-origen.example/x', 401);

    expect(sesion.autenticado()).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });
});

describe('esDelApiGateway', () => {
  it.each([
    ['https://api.solventa.co', 'https://api.solventa.co', true],
    ['https://api.solventa.co/v1/x', 'https://api.solventa.co/', true],
    ['https://api.solventa.co?x=1', 'https://api.solventa.co', true],
    ['https://api.solventa.com/v1/x', 'https://api.solventa.co', false],
    ['https://api.solventa.co.evil.example/x', 'https://api.solventa.co', false],
    ['PENDIENTE/v1/x', 'PENDIENTE', false],
  ])('%s con base %s → %s', (url, base, esperado) => {
    expect(esDelApiGateway(url, base)).toBe(esperado);
  });
});
