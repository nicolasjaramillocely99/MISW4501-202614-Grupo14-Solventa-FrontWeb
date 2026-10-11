import { Page, Request, Route } from '@playwright/test';

import { environment as ambienteLocal } from '../../src/environments/environment.development';

/**
 * Cognito y gateway simulados para las E2E del acceso (HA-S01): `page.route` responde el API JSON de
 * Cognito User Pools sin salir a la red. Los tokens son de prueba, **sin firma real**: el portal solo lee
 * sus claims (la firma la verifica el API Gateway, que aquí no interviene).
 */

export type RolPrueba = 'asegurado' | 'asesor' | 'operaciones' | 'socio';

export const ROLES_PRUEBA: readonly RolPrueba[] = ['asegurado', 'asesor', 'operaciones', 'socio'];

/** Contraseña de prueba de los usuarios simulados (no existe en ningún user pool). */
export const CONTRASENA_PRUEBA = 'Clave-de-prueba-2026';

interface UsuarioPrueba {
  readonly correo: string;
  readonly nombre: string;
  readonly grupo: string;
}

/** Usuarios de prueba por rol, con los nombres de los frames del prototipo. */
export const USUARIOS_PRUEBA: Readonly<Record<RolPrueba, UsuarioPrueba>> = {
  asegurado: { correo: 'carolina.perez@solventa.co', nombre: 'Carolina Pérez', grupo: 'insured' },
  asesor: { correo: 'laura.gomez@solventa.co', nombre: 'Laura Gómez', grupo: 'advisor' },
  operaciones: { correo: 'andres.ruiz@solventa.co', nombre: 'Andrés Ruiz', grupo: 'operations' },
  socio: { correo: 'portal@banco-aliado.co', nombre: 'Banco Aliado', grupo: 'partner' },
};

/**
 * Endpoints de Cognito que se interceptan: el regional de AWS (staging y producción) y el del ambiente
 * local, que apunta al emulador (`cognito.endpoint`). Así estas pruebas nunca dependen de él.
 */
export const URLS_COGNITO: readonly string[] = [
  'https://cognito-idp.us-east-2.amazonaws.com/',
  ambienteLocal.cognito.endpoint,
];

const esCognito = (url: URL): boolean => URLS_COGNITO.includes(url.href);

const CABECERAS_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-amz-target, x-amz-user-agent',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function base64Url(texto: string): string {
  return Buffer.from(texto, 'utf8').toString('base64url');
}

function jwtPrueba(claims: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'RS256', kid: 'llave-de-prueba', typ: 'JWT' })),
    base64Url(JSON.stringify(claims)),
    'firma-de-prueba',
  ].join('.');
}

function resultadoAutenticacion(rol: RolPrueba, conRenovacion: boolean) {
  const usuario = USUARIOS_PRUEBA[rol];
  const ahora = Math.floor(Date.now() / 1000);
  return {
    AuthenticationResult: {
      IdToken: jwtPrueba({
        sub: `sub-${rol}`,
        email: usuario.correo,
        name: usuario.nombre,
        'cognito:groups': [usuario.grupo],
        ...(rol === 'socio' ? { 'custom:partner_id': 'socio-001' } : {}),
        token_use: 'id',
        iat: ahora,
        exp: ahora + 300,
      }),
      AccessToken: jwtPrueba({ sub: `sub-${rol}`, token_use: 'access', exp: ahora + 300 }),
      ...(conRenovacion ? { RefreshToken: `renovacion-${rol}` } : {}),
      ExpiresIn: 300,
      TokenType: 'Bearer',
    },
  };
}

/** Estado del Cognito simulado: qué llamadas recibió y si la renovación debe fallar. */
export interface CognitoSimulado {
  /** Operaciones recibidas (`InitiateAuth:USER_PASSWORD_AUTH`, `RevokeToken`, …). */
  readonly llamadas: string[];
  /** Si es `true`, el token de renovación se trata como vencido o revocado. */
  renovacionRechazada: boolean;
}

async function responder(route: Route, status: number, cuerpo: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/x-amz-json-1.1',
    headers: CABECERAS_CORS,
    body: JSON.stringify(cuerpo),
  });
}

function rolDeRenovacion(token: unknown): RolPrueba | undefined {
  return ROLES_PRUEBA.find((rol) => token === `renovacion-${rol}`);
}

/** Intercepta Cognito en la página. Devuelve el estado para inspeccionarlo o cambiarlo durante la prueba. */
export async function simularCognito(page: Page): Promise<CognitoSimulado> {
  const estado: CognitoSimulado = { llamadas: [], renovacionRechazada: false };

  await page.route(esCognito, async (route: Route, request: Request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CABECERAS_CORS });
      return;
    }
    const operacion = (request.headers()['x-amz-target'] ?? '').split('.').pop() ?? '';
    const cuerpo = (request.postDataJSON() ?? {}) as {
      AuthFlow?: string;
      AuthParameters?: Record<string, string>;
      Token?: string;
    };
    estado.llamadas.push(cuerpo.AuthFlow ? `${operacion}:${cuerpo.AuthFlow}` : operacion);

    if (operacion === 'RevokeToken') {
      await responder(route, 200, {});
      return;
    }
    if (cuerpo.AuthFlow === 'USER_PASSWORD_AUTH') {
      const rol = ROLES_PRUEBA.find(
        (r) => USUARIOS_PRUEBA[r].correo === cuerpo.AuthParameters?.['USERNAME'],
      );
      if (rol && cuerpo.AuthParameters?.['PASSWORD'] === CONTRASENA_PRUEBA) {
        await responder(route, 200, resultadoAutenticacion(rol, true));
      } else {
        await responder(route, 400, {
          __type: 'NotAuthorizedException',
          message: 'Incorrect username or password.',
        });
      }
      return;
    }
    if (cuerpo.AuthFlow === 'REFRESH_TOKEN_AUTH') {
      const rol = rolDeRenovacion(cuerpo.AuthParameters?.['REFRESH_TOKEN']);
      if (rol && !estado.renovacionRechazada) {
        await responder(route, 200, resultadoAutenticacion(rol, false));
      } else {
        await responder(route, 400, {
          __type: 'NotAuthorizedException',
          message: 'Refresh Token has been revoked',
        });
      }
      return;
    }
    await responder(route, 400, { __type: 'InvalidParameterException', message: 'No simulado' });
  });

  return estado;
}
