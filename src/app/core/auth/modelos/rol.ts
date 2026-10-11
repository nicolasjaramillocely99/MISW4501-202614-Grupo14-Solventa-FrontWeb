/** Los cuatro roles humanos del portal (HA-S01). La URL nunca lleva el rol: se restringe con guards. */
export type Rol = 'asegurado' | 'asesor' | 'operaciones' | 'socio';

export const ROLES: readonly Rol[] = ['asegurado', 'asesor', 'operaciones', 'socio'];

/**
 * Grupo del user pool de Cognito (claim `cognito:groups`) → rol del portal. Los nombres de los grupos
 * son los mismos que usa `pkg/security` en el backend: `insured`, `advisor`, `operations` y `partner`.
 */
export const GRUPO_A_ROL: ReadonlyMap<string, Rol> = new Map<string, Rol>([
  ['insured', 'asegurado'],
  ['advisor', 'asesor'],
  ['operations', 'operaciones'],
  ['partner', 'socio'],
]);

/**
 * Rol del usuario a partir de sus grupos. Cada usuario pertenece a un solo grupo, asignado al
 * aprovisionarlo; los grupos que no son un rol humano se ignoran y nunca dan acceso.
 */
export function rolDesdeGrupos(grupos: readonly string[]): Rol | null {
  for (const grupo of grupos) {
    const rol = GRUPO_A_ROL.get(grupo);
    if (rol) {
      return rol;
    }
  }
  return null;
}
