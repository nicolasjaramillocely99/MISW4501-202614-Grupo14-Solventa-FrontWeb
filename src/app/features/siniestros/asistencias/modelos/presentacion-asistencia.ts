import { Actor } from '@core/api/siniestros/asignacion.modelos';
import {
  AccionHistorial,
  CandidatoAsistencia,
  DetalleAsistencia,
  EstadoAsistencia,
  PoliticaAsistencia,
  PolizaAsistencia,
  SolicitudAsistencia,
  SolicitudCierre,
  Sugerencia,
  UbicacionSolicitud,
} from '@core/api/siniestros/asistencia.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../../modelos/catalogo-siniestros';
import { Coordenadas, MarcadorMapa } from './mapa';

/**
 * Presentación de las asistencias en sitio (HU-W2.3-03, O9 y O9b): funciones puras, sin Angular. El front **no calcula**
 * distancias, elegibilidad ni llegada estimada: traduce por código lo que el backend decidió y deriva qué se muestra. Un
 * código que no conoce (una necesidad, un motivo o un estado nuevos de la política) se muestra tal cual en vez de romper
 * la pantalla (F7). `t` traduce con el prefijo `siniestros`.
 */

const ESTADOS: readonly string[] = ['new', 'in_call', 'dispatched', 'closed'];
const NECESIDADES: readonly string[] = [
  'towing',
  'battery',
  'flat_tire',
  'fuel',
  'vehicle_lockout',
  'plumbing_emergency',
];
const MOTIVOS_CIERRE: readonly string[] = [
  'resolved_by_phone',
  'duplicate',
  'cancelled_by_insured',
  'not_covered',
  'no_provider_available',
  'other',
];
/** Los motivos de cierre del contrato, para el formulario si la política no cargó (S16). */
export const MOTIVOS_CIERRE_CONOCIDOS = MOTIVOS_CIERRE;
const MOTIVOS_SIN_UBICACION: readonly string[] = [
  'permission_denied',
  'location_disabled',
  'no_fix',
];

function traducirCodigo(
  t: Traductor,
  lista: readonly string[],
  grupo: string,
  codigo: string,
): string {
  return lista.includes(codigo) ? t(`asistencias.${grupo}.${codigo}`) : codigo;
}

/** «Nueva», «En llamada», «Despachada», «Cerrada». */
export function nombreEstadoAsistencia(t: Traductor, codigo: string): string {
  return traducirCodigo(t, ESTADOS, 'estados', codigo);
}

/** «Grúa», «Batería»… */
export function nombreNecesidad(t: Traductor, codigo: string): string {
  return traducirCodigo(t, NECESIDADES, 'necesidades', codigo);
}

/** «Resuelto durante la llamada»… */
export function nombreMotivoCierre(t: Traductor, codigo: string): string {
  return traducirCodigo(t, MOTIVOS_CIERRE, 'motivosCierre', codigo);
}

/** Por qué la app no envió coordenadas: «Sin señal GPS»… */
export function nombreMotivoSinUbicacion(t: Traductor, codigo: string | null): string {
  return codigo ? traducirCodigo(t, MOTIVOS_SIN_UBICACION, 'motivosSinUbicacion', codigo) : '';
}

/** Tono de la insignia del estado, como el mockup O9: Nueva en rojo, En llamada en azul (S4). */
export function tonoEstadoAsistencia(estado: string): TonoInsignia {
  switch (estado) {
    case 'new':
      return 'error';
    case 'in_call':
      return 'informacion';
    case 'dispatched':
      return 'exito';
    default:
      return 'neutro';
  }
}

/** `new` e `in_call` admiten decisiones; `dispatched` y `closed` son finales (D6). */
export function estaAbierta(estado: EstadoAsistencia | string): boolean {
  return estado === 'new' || estado === 'in_call';
}

export type AccionFila = 'atender' | 'continuar' | 'ver';

/** «Atender» una nueva, «Continuar» una en llamada, «Ver» una despachada o cerrada (S4). */
export function accionFila(estado: EstadoAsistencia | string): AccionFila {
  switch (estado) {
    case 'new':
      return 'atender';
    case 'in_call':
      return 'continuar';
    default:
      return 'ver';
  }
}

/** La ubicación vigente: la del teléfono o, sin ella, la que registró el analista por voz. `0, 0` es válida. */
export function coordenadasDe(ubicacion: UbicacionSolicitud): Coordenadas | null {
  if (ubicacion.estado === 'sent' && ubicacion.latitud !== null && ubicacion.longitud !== null) {
    return { latitud: ubicacion.latitud, longitud: ubicacion.longitud };
  }
  if (ubicacion.voz) {
    return { latitud: ubicacion.voz.latitud, longitud: ubicacion.voz.longitud };
  }
  return null;
}

/** Solicitudes abiertas que llegaron sin GPS y todavía no tienen la ubicación por voz (aviso de S3). */
export function sinUbicacionPendientes(solicitudes: readonly SolicitudAsistencia[]): number {
  return solicitudes.filter((s) => estaAbierta(s.estado) && coordenadasDe(s.ubicacion) === null)
    .length;
}

/** Un marcador por solicitud abierta con coordenadas: «AST-2026-0001 · Nueva» (S7). */
export function marcadoresBandeja(
  solicitudes: readonly SolicitudAsistencia[],
  t: Traductor,
): MarcadorMapa[] {
  const marcadores: MarcadorMapa[] = [];
  for (const s of solicitudes) {
    const punto = estaAbierta(s.estado) ? coordenadasDe(s.ubicacion) : null;
    if (punto) {
      marcadores.push({
        id: s.solicitudId,
        ...punto,
        etiqueta: `${s.numero} · ${nombreEstadoAsistencia(t, s.estado)}`,
        tipo: s.estado === 'in_call' ? 'asignado' : 'candidato',
      });
    }
  }
  return marcadores;
}

/** Segundos como minutos y segundos: 220 → `{ minutos: 3, segundos: 40 }`. */
export function duracionDespacho(segundos: number): { minutos: number; segundos: number } {
  const total = Math.max(0, Math.round(segundos));
  return { minutos: Math.floor(total / 60), segundos: total % 60 };
}

/** «3 min 40 s», «5 min», «40 s». */
export function formatearDuracion(t: Traductor, segundos: number): string {
  const d = duracionDespacho(segundos);
  if (d.minutos === 0) {
    return t('asistencias.duracion.segundos', { segundos: d.segundos });
  }
  if (d.segundos === 0) {
    return t('asistencias.duracion.minutos', { minutos: d.minutos });
  }
  return t('asistencias.duracion.minutosSegundos', d);
}

/** La media de despacho de hoy no cumple el objetivo: «menos de 5 min» es estricto, así que 300 s ya no lo cumple. */
export function superaObjetivo(mediaSegundos: number | null, objetivoSegundos: number): boolean {
  return mediaSegundos !== null && mediaSegundos >= objetivoSegundos;
}

/** «Autos · IZJ-766» para Autos; para las demás líneas solo el producto (en Hogar el objeto es una dirección). */
export function polizaResumida(poliza: PolizaAsistencia): string {
  return poliza.linea === 'auto' && poliza.objetoAsegurado
    ? `${poliza.producto} · ${poliza.objetoAsegurado}`
    : poliza.producto;
}

/** Etiqueta del objeto asegurado según la línea (S10). */
export function etiquetaObjetoAsegurado(linea: string): 'vehiculo' | 'inmueble' | 'objeto' {
  switch (linea) {
    case 'auto':
      return 'vehiculo';
    case 'home':
      return 'inmueble';
    default:
      return 'objeto';
  }
}

/**
 * Hora de una solicitud en la zona del navegador, como el resto del portal: «16:31» si es de hoy y «20/11, 16:31» si
 * no (S4).
 */
export function horaSolicitud(instante: string, ahora: Date, idioma: string): string {
  const fecha = new Date(instante);
  const hoy =
    fecha.getFullYear() === ahora.getFullYear() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getDate() === ahora.getDate();
  const opciones: Intl.DateTimeFormatOptions = hoy
    ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  return new Intl.DateTimeFormat(idioma, opciones).format(fecha);
}

// --- Detalle O9b (S8 a S18) ----------------------------------------------------------------------------------------

/** Por qué «Despachar prestador sugerido» está deshabilitado (clave bajo `asistencias.detalle.sinDespacho`). */
export type MotivoSinDespacho = 'sinNecesidad' | 'sinUbicacion' | 'agotada';

export interface AccionesDetalle {
  /** «Atender» (`new`). */
  atender: boolean;
  /** «Continuar la llamada»: la atiende otro analista y este la toma (`taken_over`). */
  continuar: boolean;
  /** Con quién está la llamada, si es de otro analista («En llamada con Diana Torres»). */
  enLlamadaCon: Actor | null;
  /** «Cerrar solicitud» (`new` e `in_call`). */
  cerrar: boolean;
  /** Necesidad, ubicación por voz y despacho: solo `in_call`, de cualquier analista (S3 del backend). */
  decidir: boolean;
  /** El sugerido elegible para «Despachar prestador sugerido»; `null` si no hay. */
  sugerido: CandidatoAsistencia | null;
  /** Con `in_call` y sin sugerido, por qué. */
  motivoSinDespacho: MotivoSinDespacho | null;
}

/**
 * Qué acciones ofrece el detalle (S8). El analista actual se compara con `handled_by` por correo, sin distinguir
 * mayúsculas; una `in_call` sin `handled_by` (no debería ocurrir) se trata como propia.
 */
export function accionesDetalle(detalle: DetalleAsistencia, correoActual: string): AccionesDetalle {
  const enLlamada = detalle.estado === 'in_call';
  const atendidaPor = detalle.atendidaPor;
  const deOtro =
    enLlamada &&
    atendidaPor !== null &&
    atendidaPor.correo.toLowerCase() !== correoActual.toLowerCase();
  const sugerido = enLlamada
    ? (detalle.sugerencia.candidatos.find((c) => c.sugerido && c.elegibilidad === 'eligible') ??
      null)
    : null;
  return {
    atender: detalle.estado === 'new',
    continuar: deOtro,
    enLlamadaCon: deOtro ? atendidaPor : null,
    cerrar: estaAbierta(detalle.estado),
    decidir: enLlamada,
    sugerido,
    motivoSinDespacho: enLlamada && !sugerido ? motivoSinDespacho(detalle.sugerencia.estado) : null,
  };
}

function motivoSinDespacho(estado: string): MotivoSinDespacho {
  switch (estado) {
    case 'need_missing':
      return 'sinNecesidad';
    case 'location_missing':
      return 'sinUbicacion';
    default:
      return 'agotada';
  }
}

/** Cuándo empezó la llamada en curso: la última vez que alguien la atendió o la tomó (S9); `null` si no consta. */
export function inicioLlamada(historial: readonly AccionHistorial[]): string | null {
  for (let i = historial.length - 1; i >= 0; i--) {
    const accion = historial[i];
    if (accion.accion === 'attended' || accion.accion === 'taken_over') {
      return accion.en;
    }
  }
  return null;
}

/** «02:14» y, pasada una hora, «1:00:00». Lo negativo (reloj del equipo atrasado) cuenta como cero. */
export function formatoCronometro(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const horas = Math.floor(total / 3600);
  const minutos = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const resto = String(total % 60).padStart(2, '0');
  return horas > 0 ? `${horas}:${minutos}:${resto}` : `${minutos}:${resto}`;
}

/** Las necesidades que la política ofrece para la línea de la póliza, en su orden (S13). Viaje no tiene. */
export function necesidadesDeLinea(
  politica: PoliticaAsistencia,
  linea: string,
): PoliticaAsistencia['necesidades'] {
  return politica.necesidades.filter((n) => n.linea === linea);
}

export interface CandidatosSeparados {
  /** Los `eligible`, en la tabla y con «Despachar». */
  despachables: CandidatoAsistencia[];
  /** Los demás con la especialidad: sin acción, dentro de «Otros prestadores…». */
  otros: CandidatoAsistencia[];
  /** Los que caben en el mapa: los despachables y los demás a `radioMaximoKm` o menos. */
  enMapa: CandidatoAsistencia[];
}

/**
 * Separa la lista del contrato, que trae **todos** los prestadores con la especialidad (S12, S14). Sin radio máximo
 * (política caída) el mapa solo lleva a los despachables. El orden es el del contrato.
 */
export function candidatosSeparados(
  sugerencia: Sugerencia,
  radioMaximoKm: number | null,
): CandidatosSeparados {
  const despachables = sugerencia.candidatos.filter((c) => c.elegibilidad === 'eligible');
  const otros = sugerencia.candidatos.filter((c) => c.elegibilidad !== 'eligible');
  const enMapa = sugerencia.candidatos.filter(
    (c) =>
      c.elegibilidad === 'eligible' || (radioMaximoKm !== null && c.distanciaKm <= radioMaximoKm),
  );
  return { despachables, otros, enMapa };
}

/**
 * Tono de la insignia de la llegada estimada (S14).
 * Provisional (HU-W2.3-03 F14): umbrales sin validar con negocio (≤ 15 min verde, ≤ 30 min amarillo, más gris).
 */
export function tonoLlegada(minutos: number): TonoInsignia {
  if (minutos <= 15) {
    return 'exito';
  }
  return minutos <= 30 ? 'advertencia' : 'neutro';
}

/** «21/11/2026 16:16:10 Z»: la hora de la solicitud en UTC, con el orden de fecha del idioma (S12). */
export function horaUtc(instante: string, idioma: string): string {
  const fecha = new Intl.DateTimeFormat(idioma, {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(instante));
  const hora = new Intl.DateTimeFormat(idioma, {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instante));
  return `${fecha} ${hora} Z`;
}

/** Límites de la nota del cierre (`AssistanceCloseRequest.note`), en caracteres, tras quitar los espacios de los bordes. */
export const NOTA_CIERRE_MINIMA = 3;
export const NOTA_CIERRE_MAXIMA = 500;
/** El motivo que exige nota. */
export const MOTIVO_CON_NOTA = 'other';

/**
 * Un carácter de control que el backend rechaza en la nota (`unicode.IsControl`: C0, DEL y C1), salvo el salto de línea,
 * el retorno y el tabulador.
 */
function esControlProhibido(caracter: string): boolean {
  const codigo = caracter.codePointAt(0) ?? 0;
  const control = codigo <= 0x1f || (codigo >= 0x7f && codigo <= 0x9f);
  return control && caracter !== '\n' && caracter !== '\r' && caracter !== '\t';
}

export interface FormularioCierre {
  motivo: string;
  nota: string;
}

export type ProblemaCierre = 'requerido' | 'longitud' | 'formato';

export interface ResultadoCierre {
  problemas: Partial<Record<keyof FormularioCierre, ProblemaCierre>>;
  /** Solo sin problemas. */
  solicitud: SolicitudCierre | null;
}

/**
 * Valida el cierre como el backend (S16): motivo obligatorio; nota obligatoria con «Otro» y, si se escribe, de 3 a 500
 * caracteres (contados como el backend, por punto de código y sin los espacios de los bordes) y sin caracteres de
 * control.
 */
export function validarCierre(formulario: FormularioCierre): ResultadoCierre {
  const problemas: ResultadoCierre['problemas'] = {};
  if (!formulario.motivo) {
    problemas.motivo = 'requerido';
  }
  const nota = formulario.nota.trim();
  const largo = [...nota].length;
  if (largo === 0) {
    if (formulario.motivo === MOTIVO_CON_NOTA) {
      problemas.nota = 'requerido';
    }
  } else if (largo < NOTA_CIERRE_MINIMA || largo > NOTA_CIERRE_MAXIMA) {
    problemas.nota = 'longitud';
  } else if ([...nota].some(esControlProhibido)) {
    problemas.nota = 'formato';
  }
  if (Object.keys(problemas).length > 0) {
    return { problemas, solicitud: null };
  }
  return {
    problemas,
    solicitud: largo > 0 ? { motivo: formulario.motivo, nota } : { motivo: formulario.motivo },
  };
}

const ACCIONES_HISTORIAL: readonly string[] = [
  'attended',
  'taken_over',
  'need_recorded',
  'voice_location_recorded',
  'dispatched',
  'closed',
];

/**
 * Una línea del historial (S18): «Andrés Ruiz atendió la solicitud». `nombrePrestador` resuelve el `provider_id` del
 * despacho; una acción desconocida se muestra con su código.
 */
export function textoAccionHistorial(
  t: Traductor,
  accion: AccionHistorial,
  nombrePrestador: (id: string) => string,
): string {
  const quien = accion.por.nombre ?? accion.por.correo;
  if (!ACCIONES_HISTORIAL.includes(accion.accion)) {
    return t('asistencias.detalle.historial.acciones.otra', { quien, accion: accion.accion });
  }
  const detalle = accion.detalle ?? {};
  return t(`asistencias.detalle.historial.acciones.${accion.accion}`, {
    quien,
    desde: detalle['from'] ?? '',
    necesidad: detalle['need'] ? nombreNecesidad(t, detalle['need']) : '',
    prestador: detalle['provider_id'] ? nombrePrestador(detalle['provider_id']) : '',
    motivo: detalle['reason'] ? nombreMotivoCierre(t, detalle['reason']) : '',
  });
}
