import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CONFIGURACION_PRUEBAS } from '@testing/configuracion-pruebas';

import {
  CognitoProveedorIdentidadService,
  urlCognito,
} from './cognito-proveedor-identidad.service';
import { ErrorIdentidad } from './proveedor-identidad';

// Las pruebas unitarias compilan con la configuración de desarrollo:
// la URL y el cliente salen del ambiente.
const URL_COGNITO = urlCognito(CONFIGURACION_PRUEBAS.cognito);
const CLIENTE = CONFIGURACION_PRUEBAS.cognito.clienteId;

describe('urlCognito', () => {
  it('usa el endpoint regional de AWS si el ambiente no define otro', () => {
    expect(urlCognito({ region: 'us-east-2' })).toBe(
      'https://cognito-idp.us-east-2.amazonaws.com/',
    );
  });

  it('usa el endpoint configurado (p. ej. el emulador local)', () => {
    const configuracion = { region: 'us-east-2', endpoint: 'http://localhost:5100/' };
    expect(urlCognito(configuracion)).toBe('http://localhost:5100/');
  });
});

describe('CognitoProveedorIdentidadService', () => {
  let servicio: CognitoProveedorIdentidadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(CognitoProveedorIdentidadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function errorCognito(tipo: string, status = 400) {
    return { body: { __type: tipo, message: 'mensaje de Cognito' }, opciones: { status, statusText: 'Error' } };
  }

  async function motivoDe(promesa: Promise<unknown>): Promise<string> {
    try {
      await promesa;
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorIdentidad);
      return (error as ErrorIdentidad).motivo;
    }
    throw new Error('se esperaba un ErrorIdentidad');
  }

  it('inicia sesión con USER_PASSWORD_AUTH en el endpoint del ambiente y devuelve los tres tokens', async () => {
    const resultado = servicio.iniciarSesion('laura@solventa.co', 'secreto-de-prueba');

    const peticion = http.expectOne(URL_COGNITO);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.headers.get('X-Amz-Target')).toBe(
      'AWSCognitoIdentityProviderService.InitiateAuth',
    );
    expect(peticion.request.headers.get('Content-Type')).toBe('application/x-amz-json-1.1');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    expect(peticion.request.body).toEqual({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENTE,
      AuthParameters: { USERNAME: 'laura@solventa.co', PASSWORD: 'secreto-de-prueba' },
    });
    peticion.flush({
      AuthenticationResult: { IdToken: 'id', AccessToken: 'acceso', RefreshToken: 'renovacion' },
    });

    expect(await resultado).toEqual({
      idToken: 'id',
      accessToken: 'acceso',
      refreshToken: 'renovacion',
    });
  });

  it('renueva con REFRESH_TOKEN_AUTH (sin token de renovación nuevo)', async () => {
    const resultado = servicio.refrescar('renovacion');

    const peticion = http.expectOne(URL_COGNITO);
    expect(peticion.request.body).toEqual({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENTE,
      AuthParameters: { REFRESH_TOKEN: 'renovacion' },
    });
    peticion.flush({ AuthenticationResult: { IdToken: 'id-2', AccessToken: 'acceso-2' } });

    expect(await resultado).toEqual({ idToken: 'id-2', accessToken: 'acceso-2' });
  });

  it('revoca el token de renovación con RevokeToken', async () => {
    const resultado = servicio.revocar('renovacion');

    const peticion = http.expectOne(URL_COGNITO);
    expect(peticion.request.headers.get('X-Amz-Target')).toBe(
      'AWSCognitoIdentityProviderService.RevokeToken',
    );
    expect(peticion.request.body).toEqual({ Token: 'renovacion', ClientId: CLIENTE });
    peticion.flush({});

    await expect(resultado).resolves.toBeUndefined();
  });

  it.each([
    ['NotAuthorizedException', 'credenciales-invalidas'],
    ['UserNotFoundException', 'credenciales-invalidas'],
    ['com.amazonaws.cognito#NotAuthorizedException', 'credenciales-invalidas'],
    ['UserNotConfirmedException', 'accion-requerida'],
    ['PasswordResetRequiredException', 'accion-requerida'],
    ['InvalidParameterException', 'servicio-no-disponible'],
  ])('traduce %s al iniciar sesión en %s', async (tipo, motivo) => {
    const resultado = motivoDe(servicio.iniciarSesion('a@b.co', 'x'));
    const { body, opciones } = errorCognito(tipo);
    http.expectOne(URL_COGNITO).flush(body, opciones);

    expect(await resultado).toBe(motivo);
  });

  it('un token de renovación rechazado es una sesión inválida', async () => {
    const resultado = motivoDe(servicio.refrescar('vencido'));
    const { body, opciones } = errorCognito('NotAuthorizedException');
    http.expectOne(URL_COGNITO).flush(body, opciones);

    expect(await resultado).toBe('sesion-invalida');
  });

  it('un error 5xx, de red o sin cuerpo es servicio no disponible', async () => {
    const r1 = motivoDe(servicio.iniciarSesion('a@b.co', 'x'));
    http.expectOne(URL_COGNITO).flush('caído', { status: 503, statusText: 'Service Unavailable' });
    expect(await r1).toBe('servicio-no-disponible');

    const r2 = motivoDe(servicio.iniciarSesion('a@b.co', 'x'));
    http.expectOne(URL_COGNITO).error(new ProgressEvent('error'));
    expect(await r2).toBe('servicio-no-disponible');

    const r3 = motivoDe(servicio.iniciarSesion('a@b.co', 'x'));
    http.expectOne(URL_COGNITO).flush(null, { status: 400, statusText: 'Bad Request' });
    expect(await r3).toBe('servicio-no-disponible');
  });

  it('un reto pendiente (p. ej. NEW_PASSWORD_REQUIRED) requiere acción fuera del portal', async () => {
    const resultado = motivoDe(servicio.iniciarSesion('a@b.co', 'x'));
    http.expectOne(URL_COGNITO).flush({ ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 's' });

    expect(await resultado).toBe('accion-requerida');
  });

  it('una respuesta sin tokens es servicio no disponible', async () => {
    const resultado = motivoDe(servicio.iniciarSesion('a@b.co', 'x'));
    http.expectOne(URL_COGNITO).flush({ AuthenticationResult: { AccessToken: 'solo-acceso' } });

    expect(await resultado).toBe('servicio-no-disponible');
  });
});
