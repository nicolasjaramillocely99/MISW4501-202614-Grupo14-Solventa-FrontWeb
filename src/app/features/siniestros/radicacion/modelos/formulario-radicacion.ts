import {
  CodigoErrorSoporte,
  FormatoArchivo,
  PolizaRadicable,
  RequisitoSoporte,
  SolicitudRadicacion,
} from '@core/api/siniestros/radicacion.modelos';

/**
 * Reglas locales del formulario «Radicar un siniestro» (A6; HU-W2.1-01), con los límites del contrato
 * (`docs/contratos/HU-W2.1-01-api.md` §2.2 y §2.3). Validar antes de enviar permite decir **exactamente** qué falta
 * (CA-2) y no dejar radicar fuera de la vigencia (CA-3); el `422` del backend se sigue mostrando: el backend manda.
 * Funciones puras, sin Angular.
 */

/** 10 MiB por archivo (10 485 760 bytes). */
export const MAX_BYTES_SOPORTE = 10 * 1024 * 1024;
/** Archivos por caso, sumando todos los soportes. */
export const MAX_ARCHIVOS_CASO = 20;
export const LUGAR_MIN = 3;
export const LUGAR_MAX = 160;
export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 1000;
/** El hecho no puede ser anterior a cinco años. */
const ANIOS_ATRAS = 5;

/** Lo que diligencia el asegurado. `ocurridoEn` es el valor de `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`). */
export interface FormularioRadicacion {
  polizaId: string;
  tipoSiniestro: string;
  ocurridoEn: string;
  lugar: string;
  descripcion: string;
}

export const FORMULARIO_VACIO: FormularioRadicacion = {
  polizaId: '',
  tipoSiniestro: '',
  ocurridoEn: '',
  lugar: '',
  descripcion: '',
};

/** Campo de datos del hecho. */
export type CampoFormulario = keyof FormularioRadicacion;

/** Problema de un campo; la clave va bajo `siniestros.radicacion.errores.campo`. */
export type ProblemaCampo =
  | 'requerido'
  | 'fechaFutura'
  | 'fechaAntigua'
  | 'fechaFueraRango'
  | 'fueraVigencia'
  | 'lugarLongitud'
  | 'descripcionLongitud'
  | 'formatoInvalido';

/** Problema de un soporte; la clave va bajo `siniestros.radicacion.errores.soporte`. */
export type ProblemaSoporte = 'falta' | 'pocos' | 'muchos' | 'formato' | 'noAplica' | 'noEncontrado';

export type Faltante =
  | { tipo: 'campo'; campo: CampoFormulario; problema: ProblemaCampo }
  | { tipo: 'soporte'; requisito: RequisitoSoporte; problema: ProblemaSoporte }
  | { tipo: 'total' };

/** Tipos de siniestro y requisitos de la póliza elegida. */
export function requisitosDelTipo(poliza: PolizaRadicable | null, codigoTipo: string): RequisitoSoporte[] {
  return poliza?.tiposSiniestro.find((tipo) => tipo.codigo === codigoTipo)?.requisitos ?? [];
}

/**
 * Soportes de los otros tipos de la misma póliza que el tipo elegido no usa: se muestran como «No aplica», sin
 * acción de subir (enviarlos daría `not_applicable`). Cada código una sola vez, en el orden del catálogo.
 */
export function soportesNoAplica(poliza: PolizaRadicable | null, codigoTipo: string): RequisitoSoporte[] {
  if (!poliza || !codigoTipo) {
    return [];
  }
  const delTipo = new Set(requisitosDelTipo(poliza, codigoTipo).map((requisito) => requisito.codigo));
  const vistos = new Set<string>();
  const resultado: RequisitoSoporte[] = [];
  for (const tipo of poliza.tiposSiniestro) {
    for (const requisito of tipo.requisitos) {
      if (!delTipo.has(requisito.codigo) && !vistos.has(requisito.codigo)) {
        vistos.add(requisito.codigo);
        resultado.push(requisito);
      }
    }
  }
  return resultado;
}

/** `YYYY-MM-DDTHH:mm` en la zona del navegador → RFC 3339 (UTC). Vacío o inválido → `null`. */
export function aIsoDesdeLocal(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
    return null;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/** Fecha → `YYYY-MM-DDTHH:mm` en la zona del navegador (para `min`/`max` del control). */
export function aLocal(fecha: Date): string {
  const dos = (numero: number) => String(numero).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

/** Hace cinco años, a la misma hora. */
function limiteAntiguedad(ahora: Date): Date {
  const limite = new Date(ahora);
  limite.setFullYear(limite.getFullYear() - ANIOS_ATRAS);
  return limite;
}

/** Vigencia semiabierta: `vigenteDesde ≤ hecho < vigenteHasta` (S2 del plan del backend). */
export function dentroDeVigencia(hechoIso: string, poliza: PolizaRadicable): boolean {
  const hecho = Date.parse(hechoIso);
  return hecho >= Date.parse(poliza.vigenteDesde) && hecho < Date.parse(poliza.vigenteHasta);
}

/**
 * `min` y `max` del control de fecha y hora: `max` = ahora; `min` = el mayor entre hace cinco años y el inicio de la
 * vigencia. El navegador los usa como guía; la validación sigue siendo la de `faltantes`.
 */
export function limitesFechaHecho(ahora: Date, poliza: PolizaRadicable | null): { min: string; max: string } {
  const antiguedad = limiteAntiguedad(ahora);
  const desde = poliza ? new Date(poliza.vigenteDesde) : antiguedad;
  return { min: aLocal(desde > antiguedad ? desde : antiguedad), max: aLocal(ahora) };
}

/** Problema del campo, o `null` si está bien. */
export function problemaCampo(
  campo: CampoFormulario,
  formulario: FormularioRadicacion,
  poliza: PolizaRadicable | null,
  ahora: Date,
): ProblemaCampo | null {
  const valor = formulario[campo].trim();
  if (!valor) {
    return 'requerido';
  }
  switch (campo) {
    case 'ocurridoEn': {
      const iso = aIsoDesdeLocal(formulario.ocurridoEn);
      if (!iso) {
        return 'formatoInvalido';
      }
      const hecho = Date.parse(iso);
      if (hecho > ahora.getTime()) {
        return 'fechaFutura';
      }
      if (hecho < limiteAntiguedad(ahora).getTime()) {
        return 'fechaAntigua';
      }
      return poliza && !dentroDeVigencia(iso, poliza) ? 'fueraVigencia' : null;
    }
    case 'lugar':
      return valor.length < LUGAR_MIN || valor.length > LUGAR_MAX ? 'lugarLongitud' : null;
    case 'descripcion':
      return valor.length < DESCRIPCION_MIN || valor.length > DESCRIPCION_MAX ? 'descripcionLongitud' : null;
    default:
      return null;
  }
}

/** Problema de un soporte según sus archivos adjuntos, o `null` si está bien. */
export function problemaSoporte(requisito: RequisitoSoporte, adjuntos: number): ProblemaSoporte | null {
  if (requisito.obligatorio && adjuntos === 0) {
    return 'falta';
  }
  if (adjuntos > 0 && adjuntos < requisito.minArchivos) {
    return 'pocos';
  }
  return adjuntos > requisito.maxArchivos ? 'muchos' : null;
}

const CAMPOS: readonly CampoFormulario[] = ['polizaId', 'tipoSiniestro', 'ocurridoEn', 'lugar', 'descripcion'];

/**
 * Todo lo que impide radicar, a la vez (CA-2): campos vacíos o fuera de rango, la fecha fuera de la vigencia (CA-3),
 * soportes obligatorios sin archivos o con menos del mínimo y más de 20 archivos en total. `adjuntos` cuenta, por
 * código de requisito, los archivos ya subidos.
 */
export function faltantes(
  formulario: FormularioRadicacion,
  poliza: PolizaRadicable | null,
  adjuntos: Readonly<Record<string, number>>,
  ahora: Date,
): Faltante[] {
  const resultado: Faltante[] = [];
  for (const campo of CAMPOS) {
    const problema = problemaCampo(campo, formulario, poliza, ahora);
    if (problema) {
      resultado.push({ tipo: 'campo', campo, problema });
    }
  }
  let total = 0;
  for (const requisito of requisitosDelTipo(poliza, formulario.tipoSiniestro)) {
    const cantidad = adjuntos[requisito.codigo] ?? 0;
    total += cantidad;
    const problema = problemaSoporte(requisito, cantidad);
    if (problema) {
      resultado.push({ tipo: 'soporte', requisito, problema });
    }
  }
  if (total > MAX_ARCHIVOS_CASO) {
    resultado.push({ tipo: 'total' });
  }
  return resultado;
}

const FORMATO_POR_MIME: Readonly<Record<string, FormatoArchivo>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
const FORMATO_POR_EXTENSION: Readonly<Record<string, FormatoArchivo>> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  pdf: 'pdf',
};

/** Formato aparente del archivo (por su tipo MIME o, sin él, por su extensión). El backend decide por el contenido. */
export function formatoAparente(archivo: Pick<File, 'name' | 'type'>): FormatoArchivo | null {
  if (archivo.type) {
    return FORMATO_POR_MIME[archivo.type] ?? null;
  }
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  return FORMATO_POR_EXTENSION[extension] ?? null;
}

/**
 * Prevalidación del archivo antes de subirlo (CA-5): demasiado grande, vacío o de un formato que ese soporte no admite
 * se rechaza **sin** petición, con el mismo código que daría el backend. `null` si se puede subir.
 */
export function validarArchivo(
  archivo: Pick<File, 'name' | 'type' | 'size'>,
  requisito: RequisitoSoporte,
): CodigoErrorSoporte | null {
  if (archivo.size > MAX_BYTES_SOPORTE) {
    return 'file_too_large';
  }
  if (archivo.size === 0) {
    return 'empty_file';
  }
  const formato = formatoAparente(archivo);
  return formato && requisito.formatos.includes(formato) ? null : 'unsupported_file_type';
}

/** Atributo `accept` del selector de archivos de un soporte. */
export function aceptaArchivos(requisito: RequisitoSoporte): string {
  const tipos: Readonly<Record<FormatoArchivo, string>> = {
    jpeg: 'image/jpeg,.jpg,.jpeg',
    png: 'image/png,.png',
    pdf: 'application/pdf,.pdf',
  };
  return requisito.formatos.map((formato) => tipos[formato]).join(',');
}

/**
 * Cuerpo de la radicación con el texto recortado y los soportes subidos, solo de los requisitos del tipo elegido (si
 * el asegurado cambió de tipo, los archivos de un soporte que ya no aplica no se envían).
 */
export function aSolicitud(
  formulario: FormularioRadicacion,
  poliza: PolizaRadicable | null,
  soportes: Readonly<Record<string, readonly string[]>>,
): SolicitudRadicacion {
  return {
    polizaId: formulario.polizaId,
    tipoSiniestro: formulario.tipoSiniestro,
    ocurridoEn: aIsoDesdeLocal(formulario.ocurridoEn) ?? '',
    lugar: formulario.lugar.trim(),
    descripcion: formulario.descripcion.trim(),
    soportes: requisitosDelTipo(poliza, formulario.tipoSiniestro)
      .map((requisito) => ({ codigoRequisito: requisito.codigo, soporteIds: [...(soportes[requisito.codigo] ?? [])] }))
      .filter((grupo) => grupo.soporteIds.length > 0),
  };
}
