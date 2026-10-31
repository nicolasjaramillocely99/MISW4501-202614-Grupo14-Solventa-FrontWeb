/**
 * SHA-256 del contenido de un archivo, en minúsculas y hexadecimal: el que `POST /v1/claims/supports` pide declarar
 * y que S3 y el backend vuelven a comprobar al confirmar la subida.
 */
export async function calcularSha256(archivo: Blob): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return Array.from(new Uint8Array(resumen), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
