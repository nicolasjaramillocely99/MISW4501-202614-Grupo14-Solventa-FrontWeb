import { Rol } from './rol';

/** Usuario autenticado, leído de las claims del ID token de Cognito. */
export interface UsuarioSesion {
  /** `sub`: identificador estable del usuario (titularidad de sus recursos). */
  readonly id: string;
  readonly correo: string;
  /** `name` si el usuario lo tiene; si no, el correo. */
  readonly nombre: string;
  readonly rol: Rol;
  /** `custom:partner_id`: socio al que pertenece un usuario del portal del socio; `null` en los demás roles. */
  readonly socioId: string | null;
}

/** Sesión activa. Los tokens viven solo en memoria; el token de renovación va en `sessionStorage`. */
export interface Sesion {
  readonly usuario: UsuarioSesion;
  /** Token que se envía al API Gateway en `Authorization: Bearer` (el authorizer usa el ID token). */
  readonly idToken: string;
  readonly accessToken: string;
  /** Vencimiento del ID token, en milisegundos desde la época. */
  readonly expiraEn: number;
}
