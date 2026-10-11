import { DICCIONARIOS } from '@testing/transloco-pruebas';

/** Rutas de todas las hojas de un diccionario (`acceso.iniciarSesion.titulo`, …). */
function claves(objeto: object, prefijo = ''): string[] {
  return Object.entries(objeto).flatMap(([clave, valor]) => {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave;
    return valor !== null && typeof valor === 'object' ? claves(valor as object, ruta) : [ruta];
  });
}

describe('diccionarios de public/i18n', () => {
  it('es-CO y en-US tienen exactamente las mismas claves', () => {
    expect(claves(DICCIONARIOS['en-US']).sort()).toEqual(claves(DICCIONARIOS['es-CO']).sort());
  });

  it('ningún texto está vacío', () => {
    for (const diccionario of Object.values(DICCIONARIOS)) {
      const vacios = claves(diccionario).filter((ruta) => {
        const valor = ruta
          .split('.')
          .reduce<unknown>((nodo, parte) => (nodo as Record<string, unknown>)[parte], diccionario);
        return typeof valor !== 'string' || valor.trim() === '';
      });
      expect(vacios).toEqual([]);
    }
  });
});
