import { crearJwtPrueba } from '@testing/sesion-pruebas';

import { decodificarJwt } from './decodificar-jwt';
import { rolDesdeGrupos } from './modelos/rol';

describe('decodificarJwt', () => {
  it('lee las claims del segmento central, incluidos caracteres no ASCII', () => {
    const token = crearJwtPrueba({ sub: 'abc', name: 'Andrés Ruiz', 'cognito:groups': ['operations'] });

    expect(decodificarJwt(token)).toEqual({
      sub: 'abc',
      name: 'Andrés Ruiz',
      'cognito:groups': ['operations'],
    });
  });

  it.each([
    ['vacío', ''],
    ['sin firma', 'a.b'],
    ['segmento de claims vacío', 'a..c'],
    ['claims que no son JSON', 'a.bm8tanNvbg.c'],
  ])('rechaza un token %s', (_caso, token) => {
    expect(() => decodificarJwt(token)).toThrow();
  });

  it('rechaza claims que no son un objeto', () => {
    const arreglo = crearJwtPrueba({}).replace(/^[^.]+\.[^.]+/, (inicio) => {
      const [encabezado] = inicio.split('.');
      return `${encabezado}.${btoa('[1,2]')}`;
    });
    expect(() => decodificarJwt(arreglo)).toThrow('objeto de claims');
  });
});

describe('rolDesdeGrupos', () => {
  it.each([
    ['insured', 'asegurado'],
    ['advisor', 'asesor'],
    ['operations', 'operaciones'],
    ['partner', 'socio'],
  ])('el grupo %s es el rol %s', (grupo, rol) => {
    expect(rolDesdeGrupos([grupo])).toBe(rol);
  });

  it('ignora grupos desconocidos o heredados del prototipo de objetos', () => {
    expect(rolDesdeGrupos(['admin', 'toString', 'constructor'])).toBeNull();
    expect(rolDesdeGrupos(['admin', 'advisor'])).toBe('asesor');
    expect(rolDesdeGrupos([])).toBeNull();
  });
});
