/**
 * Conversión entre el valor de un `<input type="datetime-local">` («2026-09-15T09:30», hora local, sin zona) y el
 * instante ISO 8601 que espera el backend (HU-W2.3-02). El navegador interpreta el valor en la zona del usuario.
 */

const dos = (n: number): string => String(n).padStart(2, '0');

/** El instante como valor de `datetime-local`, en la hora local y al minuto. */
export function aFechaHoraLocal(instante: Date): string {
  return (
    `${instante.getFullYear()}-${dos(instante.getMonth() + 1)}-${dos(instante.getDate())}` +
    `T${dos(instante.getHours())}:${dos(instante.getMinutes())}`
  );
}

/** El valor de `datetime-local` como ISO 8601 en UTC; `null` si está vacío o no es una fecha. */
export function desdeFechaHoraLocal(valor: string): string | null {
  if (!valor) {
    return null;
  }
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}
