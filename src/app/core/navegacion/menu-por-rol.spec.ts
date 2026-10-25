import { DICCIONARIOS } from '@testing/transloco-pruebas';

import { ROLES } from '../auth/modelos/rol';
import { MENU_POR_ROL, RUTA_INICIO_POR_ROL, itemActivo } from './menu-por-rol';

function texto(clave: string): unknown {
  return clave
    .split('.')
    .reduce<unknown>((nodo, parte) => (nodo as Record<string, unknown> | undefined)?.[parte], DICCIONARIOS['es-CO']);
}

describe('MENU_POR_ROL', () => {
  it.each([
    ['asegurado', ['Inicio', 'Mis pólizas', 'Mis siniestros', 'Mis solicitudes', 'Mi perfil']],
    ['asesor', ['Inicio', 'Cotizaciones', 'Bandeja de decisión', 'Renovaciones', 'Siniestros']],
    [
      'operaciones',
      ['Inicio', 'Emisiones', 'Endosos', 'Siniestros', 'Asistencias', 'Socios', 'Auditoría', 'Consentimientos'],
    ],
    ['socio', ['Tablero', 'Desempeño técnico', 'Credenciales']],
  ] as const)('el menú de %s es el del prototipo', (rol, textos) => {
    expect(MENU_POR_ROL[rol].map((item) => texto(item.clave))).toEqual(textos);
  });

  it('no incluye «Por producto» (fuera de alcance) y todas las rutas son internas y únicas por rol', () => {
    for (const rol of ROLES) {
      const rutas = MENU_POR_ROL[rol].map((item) => item.ruta);
      expect(rutas.every((ruta) => ruta.startsWith('/'))).toBe(true);
      expect(new Set(rutas).size).toBe(rutas.length);
      expect(rutas).not.toContain('/socios/tablero/por-producto');
    }
  });

  it('todos los roles aterrizan en /inicio', () => {
    expect(ROLES.map((rol) => RUTA_INICIO_POR_ROL[rol])).toEqual(['/inicio', '/inicio', '/inicio', '/inicio']);
  });
});

describe('itemActivo', () => {
  const menu = MENU_POR_ROL.operaciones;

  it.each([
    ['/inicio', 'menu.inicio'],
    ['/siniestros/cola?prioridad=alta', 'menu.siniestros'],
    ['/auditoria/registro/123', 'menu.auditoria'],
    ['/socios#lista', 'menu.socios'],
  ])('%s activa %s', (url, clave) => {
    expect(itemActivo(menu, url)?.clave).toBe(clave);
  });

  it.each([
    ['/siniestros/radicar', 'menu.misSiniestros'],
    ['/siniestros/radicar?caso=8f14e45f', 'menu.misSiniestros'],
    ['/siniestros/mis-siniestros', 'menu.misSiniestros'],
  ])('para el asegurado %s activa %s (tambienEn, HU-W2.1-01)', (url, clave) => {
    expect(itemActivo(MENU_POR_ROL.asegurado, url)?.clave).toBe(clave);
  });

  it('tambienEn no activa el ítem con una ruta que solo comparte el prefijo de texto', () => {
    expect(itemActivo(MENU_POR_ROL.asegurado, '/siniestros/radicarx')).toBeNull();
  });

  it('una ruta que solo comparte el prefijo de texto no activa el ítem', () => {
    expect(itemActivo(menu, '/sociosx')).toBeNull();
    expect(itemActivo(menu, '/perfil')).toBeNull();
  });
});
