/**
 * Traducción del catálogo de siniestros por código (HU-W2.1-01, decisión F4). El catálogo `claim-catalog-v1` llega
 * del backend en `GET /v1/claims/filing-options` con etiquetas en español; la pantalla las traduce por código con las
 * claves `siniestros.catalogo.*`, y un código que el front no conoce muestra el texto del backend. Así un catálogo
 * nuevo no rompe la pantalla.
 */

/** Ramo → clave bajo `siniestros.catalogo.ramos`. */
const CLAVE_RAMO: Readonly<Record<string, string>> = { auto: 'autos', home: 'hogar' };

/** Tipo de siniestro → clave bajo `siniestros.catalogo.tipos` (cada una con `nombre` y `corto`). */
const CLAVE_TIPO: Readonly<Record<string, string>> = {
  collision: 'colision',
  theft: 'hurto',
  third_party_damage: 'danoTerceros',
  glass: 'cristales',
  water_damage: 'danoAgua',
  other: 'otro',
};

/** Soporte → clave bajo `siniestros.catalogo.soportes`. */
const CLAVE_SOPORTE: Readonly<Record<string, string>> = {
  vehicle_photos: 'fotosVehiculo',
  driver_document: 'documentoConductor',
  traffic_report: 'informeTransito',
  police_report: 'denuncia',
  glass_photos: 'fotosCristales',
  supporting_document: 'documentoSoporte',
  damage_photos: 'fotosDano',
  repair_quote: 'cotizacionReparacion',
};

/** `t` de Transloco con el prefijo `siniestros`. */
export type Traductor = (clave: string, parametros?: Record<string, unknown>) => string;

/** Nombre del ramo («Autos»), o el producto que envió el backend si el ramo no se conoce. */
export function nombreRamo(t: Traductor, ramo: string | null, respaldo: string | null): string {
  const clave = ramo ? CLAVE_RAMO[ramo] : undefined;
  return clave ? t(`catalogo.ramos.${clave}`) : (respaldo ?? '');
}

/**
 * Nombre del tipo de siniestro: `largo` («Colisión con daños al vehículo») en el formulario y la confirmación,
 * `corto` («Colisión») en la tabla. Sin clave conocida: la etiqueta del backend o, si no hay, el código.
 */
export function nombreTipo(t: Traductor, codigo: string, respaldo?: string, forma: 'nombre' | 'corto' = 'nombre'): string {
  const clave = CLAVE_TIPO[codigo];
  return clave ? t(`catalogo.tipos.${clave}.${forma}`) : (respaldo ?? codigo);
}

/** Nombre del soporte («Fotos del vehículo»), o la etiqueta del backend. */
export function nombreSoporte(t: Traductor, codigo: string, respaldo: string): string {
  const clave = CLAVE_SOPORTE[codigo];
  return clave ? t(`catalogo.soportes.${clave}`) : respaldo;
}
