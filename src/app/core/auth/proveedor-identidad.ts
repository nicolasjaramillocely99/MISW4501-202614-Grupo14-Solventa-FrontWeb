/** Tokens que entrega el proveedor de identidad. */
export interface TokensIdentidad {
  readonly idToken: string;
  readonly accessToken: string;
  /** Lo entrega el inicio de sesión; la renovación normalmente no lo rota. */
  readonly refreshToken?: string;
}

/**
 * Motivo de un error de identidad, para que la pantalla muestre el estado correcto:
 * - `credenciales-invalidas`: correo o contraseña incorrectos (mensaje genérico, sin revelar cuál).
 * - `accion-requerida`: la cuenta necesita un paso que el portal aún no ofrece (p. ej. cambiar la contraseña).
 * - `sin-rol`: el usuario no pertenece a ninguno de los cuatro grupos del portal.
 * - `sesion-invalida`: el token de renovación venció o fue revocado.
 * - `servicio-no-disponible`: sin conexión o error del proveedor.
 */
export type MotivoErrorIdentidad =
  | 'credenciales-invalidas'
  | 'accion-requerida'
  | 'sin-rol'
  | 'sesion-invalida'
  | 'servicio-no-disponible';

export class ErrorIdentidad extends Error {
  constructor(readonly motivo: MotivoErrorIdentidad) {
    super(`Error de identidad: ${motivo}`);
    this.name = 'ErrorIdentidad';
  }
}

/**
 * Puerto hacia el proveedor de identidad (Amazon Cognito User Pool). Las páginas y la sesión dependen de
 * esta abstracción, no de Cognito: cambiar a otra implementación (p. ej. Amplify) no toca las pantallas.
 * Se usa también como token de inyección.
 */
export abstract class ProveedorIdentidad {
  /** Inicia sesión con correo y contraseña. */
  abstract iniciarSesion(correo: string, contrasena: string): Promise<TokensIdentidad>;
  /** Obtiene tokens nuevos con el token de renovación. */
  abstract refrescar(refreshToken: string): Promise<TokensIdentidad>;
  /** Revoca el token de renovación al cerrar sesión. */
  abstract revocar(refreshToken: string): Promise<void>;
}
