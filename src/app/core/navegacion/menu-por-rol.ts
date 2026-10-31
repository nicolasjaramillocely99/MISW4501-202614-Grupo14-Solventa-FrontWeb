import {
  LucideActivity,
  LucideBuilding,
  LucideClipboardList,
  LucideDatabase,
  LucideFileClock,
  LucideFileText,
  LucideGauge,
  LucideIcon,
  LucideInbox,
  LucideKeyRound,
  LucideLayoutGrid,
  LucideMapPin,
  LucidePencil,
  LucideRefreshCw,
  LucideShield,
  LucideUser,
} from '@lucide/angular';

import { Rol } from '../auth/modelos/rol';

/** Ítem de la barra lateral del portal. */
export interface ItemMenu {
  /** Clave i18n del texto (`menu.*`). */
  readonly clave: string;
  /** Ruta de la pantalla (`docs/pantallas.md`). Las que aún no existen redirigen al inicio del rol. */
  readonly ruta: string;
  readonly icono: LucideIcon;
  /** Otras rutas (y sus hijas) que también activan el ítem, p. ej. la radicación dentro de «Mis siniestros». */
  readonly tambienEn?: readonly string[];
}

const INICIO: ItemMenu = { clave: 'menu.inicio', ruta: '/inicio', icono: LucideLayoutGrid };

/**
 * Menú completo del prototipo por rol (`layout/README.md`, tabla «Menús por rol»), sin «Por producto»
 * (HU-W3.2-02, fuera de alcance). Las rutas son las de `docs/pantallas.md`; mientras su historia no
 * exista, el comodín de `app.routes.ts` lleva al inicio del rol.
 */
export const MENU_POR_ROL: Readonly<Record<Rol, readonly ItemMenu[]>> = {
  asegurado: [
    INICIO,
    { clave: 'menu.misPolizas', ruta: '/originacion/polizas', icono: LucideShield },
    {
      clave: 'menu.misSiniestros',
      ruta: '/siniestros/mis-siniestros',
      icono: LucideClipboardList,
      // HU-W2.1-01: «Radicar un siniestro» vive dentro de «Mis siniestros» (A6 · migas «← Mis siniestros»).
      // HU-W2.2-01: también el detalle del caso, `/siniestros/:id` (A8 · migas «← Mis siniestros»).
      tambienEn: ['/siniestros/radicar', '/siniestros'],
    },
    { clave: 'menu.misSolicitudes', ruta: '/originacion/solicitudes', icono: LucideInbox },
    { clave: 'menu.miPerfil', ruta: '/perfil', icono: LucideUser },
  ],
  asesor: [
    INICIO,
    { clave: 'menu.cotizaciones', ruta: '/originacion/cotizaciones/nueva', icono: LucideFileText },
    { clave: 'menu.bandejaDecision', ruta: '/originacion/bandeja-decision', icono: LucideInbox },
    { clave: 'menu.renovaciones', ruta: '/originacion/renovaciones', icono: LucideRefreshCw },
    { clave: 'menu.siniestros', ruta: '/siniestros/revision', icono: LucideClipboardList },
  ],
  operaciones: [
    INICIO,
    { clave: 'menu.emisiones', ruta: '/originacion/emisiones', icono: LucideActivity },
    { clave: 'menu.endosos', ruta: '/originacion/endosos', icono: LucidePencil },
    { clave: 'menu.siniestros', ruta: '/siniestros/cola', icono: LucideClipboardList },
    { clave: 'menu.asistencias', ruta: '/siniestros/asistencias', icono: LucideMapPin },
    { clave: 'menu.socios', ruta: '/socios', icono: LucideBuilding },
    { clave: 'menu.auditoria', ruta: '/auditoria/registro', icono: LucideFileClock },
    { clave: 'menu.consentimientos', ruta: '/auditoria/consentimientos', icono: LucideDatabase },
  ],
  socio: [
    { clave: 'menu.tablero', ruta: '/socios/tablero', icono: LucideLayoutGrid },
    { clave: 'menu.desempenoTecnico', ruta: '/socios/tablero/desempeno', icono: LucideGauge },
    { clave: 'menu.credenciales', ruta: '/socios/credenciales', icono: LucideKeyRound },
  ],
};

/** Ruta de inicio de cada rol. El socio también aterriza en `/inicio` hasta que exista su tablero (B1). */
export const RUTA_INICIO_POR_ROL: Readonly<Record<Rol, string>> = {
  asegurado: '/inicio',
  asesor: '/inicio',
  operaciones: '/inicio',
  socio: '/inicio',
};

/** Ítem del menú que corresponde a una URL (por prefijo de ruta, también las de `tambienEn`), o `null`. */
export function itemActivo(menu: readonly ItemMenu[], url: string): ItemMenu | null {
  const ruta = url.split(/[?#]/)[0];
  const coincide = (base: string) => ruta === base || ruta.startsWith(`${base}/`);
  return menu.find((item) => coincide(item.ruta) || (item.tambienEn ?? []).some(coincide)) ?? null;
}
