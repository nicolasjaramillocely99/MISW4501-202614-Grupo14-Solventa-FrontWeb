import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

import {
  ErrorIdentidad,
  MotivoErrorIdentidad,
  ProveedorIdentidad,
  TokensIdentidad,
} from './proveedor-identidad';

/** Respuesta de `InitiateAuth` del API de Cognito User Pools. */
interface RespuestaInitiateAuth {
  ChallengeName?: string;
  AuthenticationResult?: {
    IdToken?: string;
    AccessToken?: string;
    RefreshToken?: string;
  };
}

/** Errores de Cognito que indican que la cuenta necesita un paso fuera del portal. */
const ERRORES_ACCION_REQUERIDA = new Set([
  'UserNotConfirmedException',
  'PasswordResetRequiredException',
]);

/** Errores de Cognito que significan credenciales o token rechazados. */
const ERRORES_RECHAZO = new Set(['NotAuthorizedException', 'UserNotFoundException']);

/**
 * Configuración de Cognito de un ambiente (`src/environments/*.ts`). `endpoint` es opcional: solo lo
 * define un ambiente que usa otro servidor compatible con el API de Cognito (p. ej. el emulador local);
 * sin él se usa el endpoint regional de AWS.
 */
export interface ConfiguracionCognito {
  readonly region: string;
  readonly endpoint?: string;
}

/** URL del API JSON de Cognito User Pools para la configuración dada. */
export function urlCognito({ region, endpoint }: ConfiguracionCognito): string {
  return endpoint ?? `https://cognito-idp.${region}.amazonaws.com/`;
}

/**
 * Implementación de `ProveedorIdentidad` con el API JSON de Amazon Cognito User Pools (OIDC):
 * `InitiateAuth` con `USER_PASSWORD_AUTH` para iniciar sesión, `REFRESH_TOKEN_AUTH` para renovar y
 * `RevokeToken` al cerrar sesión. Las llamadas van directo al proveedor de identidad, fuera del camino de
 * las peticiones de negocio, y nunca llevan el JWT del usuario (el interceptor solo lo adjunta al API Gateway).
 */
@Injectable({ providedIn: 'root' })
export class CognitoProveedorIdentidadService extends ProveedorIdentidad {
  private readonly http = inject(HttpClient);
  private readonly url = urlCognito(environment.cognito);
  private readonly clienteId = environment.cognito.clienteId;

  async iniciarSesion(correo: string, contrasena: string): Promise<TokensIdentidad> {
    const respuesta = await this.llamar<RespuestaInitiateAuth>(
      'InitiateAuth',
      {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clienteId,
        AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
      },
      'credenciales-invalidas',
    );
    return this.tokensDe(respuesta);
  }

  async refrescar(refreshToken: string): Promise<TokensIdentidad> {
    const respuesta = await this.llamar<RespuestaInitiateAuth>(
      'InitiateAuth',
      {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clienteId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      },
      'sesion-invalida',
    );
    return this.tokensDe(respuesta);
  }

  async revocar(refreshToken: string): Promise<void> {
    await this.llamar<unknown>(
      'RevokeToken',
      { Token: refreshToken, ClientId: this.clienteId },
      'sesion-invalida',
    );
  }

  private async llamar<T>(
    operacion: 'InitiateAuth' | 'RevokeToken',
    cuerpo: object,
    motivoRechazo: MotivoErrorIdentidad,
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.post<T>(this.url, cuerpo, {
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': `AWSCognitoIdentityProviderService.${operacion}`,
          },
        }),
      );
    } catch (error) {
      throw new ErrorIdentidad(motivoDelError(error, motivoRechazo));
    }
  }

  private tokensDe(respuesta: RespuestaInitiateAuth): TokensIdentidad {
    if (respuesta.ChallengeName) {
      // Retos como NEW_PASSWORD_REQUIRED o MFA no tienen pantalla en el portal (D-13).
      throw new ErrorIdentidad('accion-requerida');
    }
    const resultado = respuesta.AuthenticationResult;
    if (!resultado?.IdToken || !resultado.AccessToken) {
      throw new ErrorIdentidad('servicio-no-disponible');
    }
    return {
      idToken: resultado.IdToken,
      accessToken: resultado.AccessToken,
      ...(resultado.RefreshToken ? { refreshToken: resultado.RefreshToken } : {}),
    };
  }
}

/** Traduce el error HTTP de Cognito (`{"__type": "NotAuthorizedException", …}`) a un motivo del portal. */
function motivoDelError(error: unknown, motivoRechazo: MotivoErrorIdentidad): MotivoErrorIdentidad {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return 'servicio-no-disponible';
  }
  const cuerpo: unknown = error.error;
  const tipo =
    cuerpo !== null && typeof cuerpo === 'object' && '__type' in cuerpo
      ? String(cuerpo.__type).split('#').pop()
      : undefined;

  if (tipo && ERRORES_RECHAZO.has(tipo)) {
    return motivoRechazo;
  }
  if (tipo && ERRORES_ACCION_REQUERIDA.has(tipo)) {
    return 'accion-requerida';
  }
  return 'servicio-no-disponible';
}
