/** Claims de un JWT, sin tipar: cada consumidor valida las que usa. */
export type ClaimsJwt = Readonly<Record<string, unknown>>;

/**
 * Lee las claims de un JWT **sin verificar la firma**. El cliente solo las usa para mostrar el usuario y
 * elegir el menú; quien verifica la firma, el emisor y la vigencia es el authorizer del API Gateway (y los
 * servicios con `pkg/security`). Lanza un error si el token no tiene la forma `encabezado.claims.firma`.
 */
export function decodificarJwt(token: string): ClaimsJwt {
  const partes = token.split('.');
  if (partes.length !== 3 || !partes[1]) {
    throw new Error('El token no tiene la forma de un JWT.');
  }

  const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const bytes = Uint8Array.from(atob(relleno), (caracter) => caracter.charCodeAt(0));
  const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));

  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) {
    throw new Error('El token no contiene un objeto de claims.');
  }
  return claims as ClaimsJwt;
}
