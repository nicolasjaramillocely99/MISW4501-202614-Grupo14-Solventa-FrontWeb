import {
  AsignacionSiniestro,
  Candidato,
  PoliticaAsignacion,
  SolicitudUbicacion,
} from '@core/api/siniestros/asignacion.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../../modelos/catalogo-siniestros';

/**
 * Presentación de la asignación del prestador (HU-W2.3-01): funciones puras, sin Angular. El front **no calcula**
 * distancias ni elegibilidad: traduce por código lo que el backend decidió y deriva qué acciones se ofrecen. Un código
 * que no conoce (una especialidad de HU-W2.3-03, un motivo nuevo) se muestra tal cual en vez de romper la pantalla (F6).
 */

const ESPECIALIDADES: readonly string[] = [
  'vehicle_assessment',
  'auto_glass',
  'plumbing',
  'damp_proofing',
  'painting',
  'bodywork',
];
const MOTIVOS: readonly string[] = ['no_eligible_provider_within_max_radius'];

/** Límites del contrato para la ubicación que registra el analista (`IncidentLocationRequest`). */
export const DIRECCION_MINIMA = 5;
export const DIRECCION_MAXIMA = 200;

/** Especialidades que el front sabe traducir, en el orden del contrato (filtro de la administración de prestadores). */
export const ESPECIALIDADES_CONOCIDAS = ESPECIALIDADES;

/** «Plomería»; un código desconocido se muestra crudo. */
export function nombreEspecialidad(t: Traductor, codigo: string): string {
  return ESPECIALIDADES.includes(codigo) ? t(`especialidades.${codigo}`) : codigo;
}

/** «Plomería · Humedades». */
export function nombresEspecialidades(t: Traductor, codigos: readonly string[]): string {
  return codigos.map((c) => nombreEspecialidad(t, c)).join(' · ');
}

/** Por qué el caso quedó pendiente de asignación; un motivo desconocido se muestra crudo. */
export function nombreMotivo(t: Traductor, codigo: string | null): string {
  if (!codigo) {
    return '';
  }
  return MOTIVOS.includes(codigo) ? t(`asignacion.motivos.${codigo}`) : codigo;
}

export interface EtiquetaDisponibilidad {
  /** Clave bajo `siniestros.asignacion.disponibilidad`. */
  clave:
    | 'disponibleHoy'
    | 'disponibleManana'
    | 'enOtroCaso'
    | 'noDisponibleHasta'
    | 'noDisponible'
    | 'fueraDelRadio';
  tono: TonoInsignia;
  /** Fecha `YYYY-MM-DD` para «No disponible · hasta …». */
  hasta: string | null;
}

/**
 * Insignia de disponibilidad de un candidato (S7). `hoy` es la fecha local `YYYY-MM-DD`: un prestador que vuelve mañana
 * se rotula «Disponible mañana», pero **no** es elegible (P8 del backend).
 */
export function etiquetaDisponibilidad(candidato: Candidato, hoy: string): EtiquetaDisponibilidad {
  if (candidato.elegibilidad === 'eligible') {
    return { clave: 'disponibleHoy', tono: 'exito', hasta: null };
  }
  if (candidato.elegibilidad === 'out_of_radius') {
    return { clave: 'fueraDelRadio', tono: 'neutro', hasta: null };
  }
  if (candidato.disponibilidad === 'busy') {
    return { clave: 'enOtroCaso', tono: 'error', hasta: null };
  }
  if (candidato.noDisponibleHasta && candidato.noDisponibleHasta === sumarDias(hoy, 1)) {
    return { clave: 'disponibleManana', tono: 'advertencia', hasta: candidato.noDisponibleHasta };
  }
  if (candidato.noDisponibleHasta) {
    return { clave: 'noDisponibleHasta', tono: 'error', hasta: candidato.noDisponibleHasta };
  }
  return { clave: 'noDisponible', tono: 'error', hasta: null };
}

/** Fecha local `YYYY-MM-DD` de un instante (la del navegador del analista). */
export function fechaLocal(instante: Date): string {
  const mes = String(instante.getMonth() + 1).padStart(2, '0');
  const dia = String(instante.getDate()).padStart(2, '0');
  return `${instante.getFullYear()}-${mes}-${dia}`;
}

/**
 * Una fecha del contrato (`YYYY-MM-DD`, p. ej. `unavailable_until`) como fecha **local**, para los pipes de fecha:
 * `new Date('2026-09-22')` es medianoche UTC y en Bogotá se mostraría el 21.
 */
export function aFechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

/**
 * Radio con el que empieza «Ampliar radio de búsqueda»: el siguiente de la escalera de la política después de
 * `radioActual`. En el máximo, `null`. Un radio que no está en la escalera toma el primero mayor que él.
 */
export function radioSiguiente(politica: PoliticaAsignacion, radioActual: number): number | null {
  return politica.radiosKm.find((radio) => radio > radioActual) ?? null;
}

export interface AccionesAsignacion {
  /** «Buscar prestador» (`ready`). */
  buscar: boolean;
  /** «Reintentar búsqueda» (`pending_assignment`). */
  reintentar: boolean;
  /** «Ampliar radio de búsqueda»: visible en `proposed` y `pending_assignment`; `radio` nulo = deshabilitado. */
  ampliar: { visible: boolean; radio: number | null; motivo: 'radioMaximo' | 'sinPolitica' | null };
  /** El sugerido elegible de la última búsqueda (`proposed`). */
  sugerido: Candidato | null;
  /** «Corregir ubicación»: solo la del analista y sin asignación (con la de la app el backend responde 409). */
  corregirUbicacion: boolean;
}

/** Qué acciones ofrece O7 según el estado (S5, S6). Sin política, «Ampliar radio» queda deshabilitado con su motivo. */
export function accionesDisponibles(
  asignacion: AsignacionSiniestro,
  politica: PoliticaAsignacion | null,
): AccionesAsignacion {
  const busqueda = asignacion.ultimaBusqueda;
  const conBusqueda =
    asignacion.estado === 'proposed' || asignacion.estado === 'pending_assignment';
  let ampliar: AccionesAsignacion['ampliar'] = { visible: false, radio: null, motivo: null };
  if (conBusqueda && busqueda) {
    const radio = politica ? radioSiguiente(politica, busqueda.radioKm) : null;
    ampliar = {
      visible: true,
      radio,
      motivo: radio !== null ? null : politica ? 'radioMaximo' : 'sinPolitica',
    };
  }
  const sugerido =
    asignacion.estado === 'proposed'
      ? (busqueda?.candidatos.find((c) => c.sugerido && c.elegibilidad === 'eligible') ?? null)
      : null;
  const ubicable = ['ready', 'proposed', 'pending_assignment'].includes(asignacion.estado);
  return {
    buscar: asignacion.estado === 'ready',
    reintentar: asignacion.estado === 'pending_assignment',
    ampliar,
    sugerido,
    corregirUbicacion:
      ubicable && asignacion.ubicacion?.fuente === 'analyst' && !asignacion.asignacion,
  };
}

/**
 * «4,6771 N · 74,0483 O» con la API `Intl` (4 decimales) y las letras de hemisferio del idioma activo (`en-US`:
 * «4.6771 N · 74.0483 W»).
 */
export function formatearCoordenadas(
  t: Traductor,
  latitud: number,
  longitud: number,
  idioma: string,
): string {
  const numero = new Intl.NumberFormat(idioma, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  const ns = t(latitud < 0 ? 'mapa.hemisferios.sur' : 'mapa.hemisferios.norte');
  const eo = t(longitud < 0 ? 'mapa.hemisferios.oeste' : 'mapa.hemisferios.este');
  return `${numero.format(Math.abs(latitud))} ${ns} · ${numero.format(Math.abs(longitud))} ${eo}`;
}

/** El formulario de la ubicación alternativa, tal como lo escribe el analista. */
export interface FormularioUbicacion {
  direccion: string;
  latitud: string;
  longitud: string;
}

export type ProblemaUbicacion = 'requerido' | 'longitud' | 'formato' | 'rango';

export interface ResultadoUbicacion {
  problemas: Partial<Record<keyof FormularioUbicacion, ProblemaUbicacion>>;
  /** Solo sin problemas. */
  solicitud: SolicitudUbicacion | null;
}

/** Número decimal con punto o coma decimal («4.6771», «-74,0483»); sin separadores de miles ni exponentes. */
const DECIMAL = /^-?\d{1,3}([.,]\d+)?$/;

/** Lee una coordenada escrita por el analista; `null` si no es un número decimal. */
export function leerCoordenada(texto: string): number | null {
  const limpio = texto.trim();
  return DECIMAL.test(limpio) ? Number(limpio.replace(',', '.')) : null;
}

/** Coordenada del pin para los campos del formulario: 6 decimales (≈ 0,1 m), con punto. */
export function coordenadaATexto(valor: number): string {
  return valor.toFixed(6);
}

/** Valida la ubicación alternativa con los límites del contrato (S3): dirección de 5 a 200, latitud y longitud en rango. */
export function validarUbicacion(formulario: FormularioUbicacion): ResultadoUbicacion {
  const problemas: ResultadoUbicacion['problemas'] = {};
  const direccion = formulario.direccion.trim();
  if (!direccion) {
    problemas.direccion = 'requerido';
  } else if (direccion.length < DIRECCION_MINIMA || direccion.length > DIRECCION_MAXIMA) {
    problemas.direccion = 'longitud';
  }
  const latitud = validarCoordenada(formulario.latitud, 90);
  const longitud = validarCoordenada(formulario.longitud, 180);
  if (typeof latitud === 'string') {
    problemas.latitud = latitud;
  }
  if (typeof longitud === 'string') {
    problemas.longitud = longitud;
  }
  const valido =
    Object.keys(problemas).length === 0 &&
    typeof latitud === 'number' &&
    typeof longitud === 'number';
  return { problemas, solicitud: valido ? { direccion, latitud, longitud } : null };
}

function validarCoordenada(texto: string, limite: number): number | ProblemaUbicacion {
  if (!texto.trim()) {
    return 'requerido';
  }
  const valor = leerCoordenada(texto);
  if (valor === null) {
    return 'formato';
  }
  return Math.abs(valor) <= limite ? valor : 'rango';
}
