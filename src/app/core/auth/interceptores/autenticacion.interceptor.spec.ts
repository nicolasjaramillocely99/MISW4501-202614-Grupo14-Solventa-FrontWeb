import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { iniciarSesionComo, proveerSesionPrueba } from '@testing/sesion-pruebas';
import { firstValueFrom } from 'rxjs';

import { SesionService } from '../sesion.service';
import { autenticacionInterceptor, esDelApiGateway } from './autenticacion.interceptor';

const GATEWAY = 'http://localhost:8080';

describe('autenticacionInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let sesion: SesionService;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([autenticacionInterceptor])),
        provideHttpClientTesting(),
        ...proveerSesionPrueba(),
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
    'http://localhost:80801/v1/quotes',
    'https://otro-origen.example/v1/quotes',
  ])('nunca adjunta el token a %s', async (url) => {
    await iniciarSesionComo('operaciones');

    const respuesta = firstValueFrom(http.get(url));
    const peticion = backend.expectOne(url);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
    await respuesta;
  });

  it('un 401 del gateway termina la sesión y lleva a sesión expirada', async () => {
    await iniciarSesionComo('asesor');

    const error = await fallaCon(`${GATEWAY}/v1/quotes`, 401);

    expect(error.status).toBe(401);
    expect(sesion.autenticado()).toBe(false);
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
