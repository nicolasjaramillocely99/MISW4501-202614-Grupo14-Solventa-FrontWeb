/**
 * «16/09/2026»: la fecha corta de las pantallas de la solicitud de modificación (A3 y A11, HU-W1.4-01), en el orden del
 * idioma y la zona horaria del usuario. Una fecha ilegible queda vacía.
 */
export function fechaCorta(iso: string, idioma: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(idioma, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(fecha);
}
