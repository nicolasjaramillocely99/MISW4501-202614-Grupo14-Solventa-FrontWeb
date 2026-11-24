import { RequisitoSoporte } from '@core/api/siniestros/radicacion.modelos';
import { CampoReenvio, SolicitudReenvio } from '@core/api/siniestros/reenvio.modelos';
import { DatoCorregible, Revision, VeredictoSoporte } from '@core/api/siniestros/revision.modelos';
import {
  ArchivoAdjunto,
  CanalSiniestro,
  DetalleSiniestro,
} from '@core/api/siniestros/siniestro.modelos';

import {
  FORMULARIO_VACIO,
  ProblemaCampo,
  ProblemaSoporte,
  aIsoDesdeLocal,
  aLocal,
  leerMonto,
  problemaCampo,
} from '../../radicacion/modelos/formulario-radicacion';

/**
 * Reglas de la pantalla A9 · Edición de la radicación devuelta (HU-W2.1-04), sin Angular: qué pide cada soporte, qué
 * falta antes de reenviar (CA-3) y qué se envía. Un grupo de soportes es el **conjunto completo** que queda en el
 * requisito: los archivos que se conservan más los nuevos.
 */

/** Qué hace el botón de un soporte: reemplazar lo que tiene, subir lo que falta o agregar a lo que ya tiene. */
export type AccionSoporte = 'reemplazar' | 'subir' | 'agregar';

/** Estado de la fila; la clave va bajo `siniestros.correccion.soportes.estado`. */
export type EstadoFilaCorreccion =
  'reemplazar' | 'falta' | 'pocos' | 'corregido' | 'adjunto' | 'opcional';

export interface FilaCorreccion {
  requisito: RequisitoSoporte;
  /** El veredicto del asesor en la devolución, o `null` si no dijo nada de este soporte. */
  veredicto: VeredictoSoporte | null;
  nota: string | null;
  /** Archivos que el caso tiene hoy. */
  actuales: readonly ArchivoAdjunto[];
  /** En un caso del móvil, las fotos de la app cuentan como «Fotos del vehículo» aunque no sean soportes. */
  fotosDeLaApp: boolean;
  accion: AccionSoporte;
  /** Cuántos archivos nuevos ya subió el asegurado para este soporte. */
  nuevos: number;
  estado: EstadoFilaCorreccion;
  pendiente: boolean;
}

/** Los campos que el asegurado edita (A9). La póliza y el tipo de siniestro no se cambian. */
export interface HechosCorregidos {
  /** `YYYY-MM-DDTHH:mm` en la zona del navegador. */
  ocurridoEn: string;
  lugar: string;
  descripcion: string;
  /** Pesos enteros, tal como los escribe la persona. */
  montoEstimado: string;
}

export type CampoHecho = keyof HechosCorregidos;

/** Problema de un hecho; `fechaPosteriorRadicacion` es propio del reenvío y lo demás viene de la radicación. */
export type ProblemaHecho = ProblemaCampo | 'fechaPosteriorRadicacion';

/** El dato del contrato (`facts_to_correct`) que corresponde a cada campo. */
export const DATO_DE_CAMPO: Readonly<Record<CampoHecho, DatoCorregible>> = {
  ocurridoEn: 'occurred_at',
  lugar: 'place',
  descripcion: 'description',
  montoEstimado: 'estimated_amount',
};

const CAMPO_DEL_SERVIDOR: Readonly<Record<string, CampoHecho>> = {
  occurred_at: 'ocurridoEn',
  place: 'lugar',
  description: 'descripcion',
  estimated_amount_minor: 'montoEstimado',
};

/** Los hechos como los radicó el asegurado, listos para editar. */
export function hechosDe(caso: DetalleSiniestro): HechosCorregidos {
  const minor = caso.montoEstimadoMinor;
  return {
    ocurridoEn: aLocal(new Date(caso.ocurridoEn)),
    lugar: caso.lugar,
    descripcion: caso.descripcion,
    montoEstimado: minor === null ? '' : String(Math.trunc(minor / 100)),
  };
}

function veredictoDe(devolucion: Revision | null, codigo: string) {
  return devolucion?.soportes.find((s) => s.codigoRequisito === codigo) ?? null;
}

/**
 * Una fila por soporte del caso, en el orden del catálogo: lo que el asesor dijo, los archivos que tiene, la acción y
 * si aún falta algo. `nuevos` cuenta, por código de requisito, los archivos nuevos ya subidos.
 */
export function filasCorreccion(
  requisitos: readonly RequisitoSoporte[],
  devolucion: Revision | null,
  caso: Pick<DetalleSiniestro, 'canal' | 'soportes'>,
  nuevos: Readonly<Record<string, number>>,
): FilaCorreccion[] {
  return requisitos.map((requisito) => {
    const dicho = veredictoDe(devolucion, requisito.codigo);
    const veredicto = dicho?.veredicto ?? null;
    const actuales =
      caso.soportes.items.find((item) => item.codigoRequisito === requisito.codigo)?.archivos ?? [];
    const fotosDeLaApp = esFotosDeLaApp(caso.canal, requisito.codigo, actuales.length);
    const tiene = actuales.length > 0 || fotosDeLaApp;
    const accion: AccionSoporte =
      veredicto === 'illegible' || fotosDeLaApp || actuales.length >= requisito.maxArchivos
        ? 'reemplazar'
        : tiene
          ? 'agregar'
          : 'subir';
    const subidos = nuevos[requisito.codigo] ?? 0;
    const total =
      accion === 'agregar' ? actuales.length + subidos : subidos > 0 ? subidos : actuales.length;
    const estado = estadoFila(requisito, veredicto, subidos, total, tiene);
    return {
      requisito,
      veredicto,
      nota: dicho?.nota ?? null,
      actuales,
      fotosDeLaApp,
      accion,
      nuevos: subidos,
      estado,
      pendiente: estado === 'reemplazar' || estado === 'falta' || estado === 'pocos',
    };
  });
}

function esFotosDeLaApp(canal: CanalSiniestro, codigo: string, actuales: number): boolean {
  return canal === 'mobile' && codigo === 'vehicle_photos' && actuales === 0;
}

function estadoFila(
  requisito: RequisitoSoporte,
  veredicto: VeredictoSoporte | null,
  subidos: number,
  total: number,
  tiene: boolean,
): EstadoFilaCorreccion {
  if (veredicto === 'illegible' && subidos === 0) {
    return 'reemplazar';
  }
  const conArchivos = total > 0 || (subidos === 0 && tiene);
  if (!conArchivos && (requisito.obligatorio || veredicto === 'missing')) {
    return 'falta';
  }
  if (subidos > 0 && total < requisito.minArchivos) {
    return 'pocos';
  }
  if (subidos > 0) {
    return 'corregido';
  }
  return conArchivos ? 'adjunto' : 'opcional';
}

/**
 * Cuántos archivos nuevos admite el soporte: al reemplazar, su máximo; al agregar, lo que le queda. La carga de
 * soportes usa este requisito para rechazar lo que no cabe.
 */
export function requisitoParaSubir(fila: FilaCorreccion): RequisitoSoporte {
  if (fila.accion !== 'agregar') {
    return fila.requisito;
  }
  return {
    ...fila.requisito,
    maxArchivos: Math.max(fila.requisito.maxArchivos - fila.actuales.length, 0),
  };
}

/** Problema de cada hecho, o nada si está bien. El monto que pidió el asesor es obligatorio. */
export function problemasHechos(
  hechos: HechosCorregidos,
  caso: Pick<DetalleSiniestro, 'radicadoEn'>,
  pedidos: readonly DatoCorregible[],
  ahora: Date,
): Partial<Record<CampoHecho, ProblemaHecho>> {
  const formulario = { ...FORMULARIO_VACIO, ...hechos, polizaId: '-', tipoSiniestro: '-' };
  const resultado: Partial<Record<CampoHecho, ProblemaHecho>> = {};
  for (const campo of ['ocurridoEn', 'lugar', 'descripcion', 'montoEstimado'] as const) {
    const problema = problemaCampo(campo, formulario, null, ahora);
    if (problema) {
      resultado[campo] = problema;
    }
  }
  const iso = aIsoDesdeLocal(hechos.ocurridoEn);
  if (!resultado.ocurridoEn && iso && Date.parse(iso) > Date.parse(caso.radicadoEn)) {
    resultado.ocurridoEn = 'fechaPosteriorRadicacion';
  }
  if (
    !resultado.montoEstimado &&
    pedidos.includes('estimated_amount') &&
    !hechos.montoEstimado.trim()
  ) {
    resultado.montoEstimado = 'requerido';
  }
  return resultado;
}

/**
 * La solicitud del reenvío: solo los hechos que cambiaron y, por cada soporte con archivos nuevos, el conjunto completo
 * que queda. `nuevosIds` son los `support_id` ya subidos por código de requisito.
 */
export function aSolicitudReenvio(
  devolucion: Revision,
  original: HechosCorregidos,
  hechos: HechosCorregidos,
  filas: readonly FilaCorreccion[],
  nuevosIds: Readonly<Record<string, readonly string[]>>,
): SolicitudReenvio {
  const solicitud: SolicitudReenvio = { revisionSecuencia: devolucion.secuencia };
  if (hechos.ocurridoEn !== original.ocurridoEn) {
    solicitud.ocurridoEn = aIsoDesdeLocal(hechos.ocurridoEn) ?? hechos.ocurridoEn;
  }
  if (hechos.lugar.trim() !== original.lugar.trim()) {
    solicitud.lugar = hechos.lugar.trim();
  }
  if (hechos.descripcion.trim() !== original.descripcion.trim()) {
    solicitud.descripcion = hechos.descripcion.trim();
  }
  const monto = leerMonto(hechos.montoEstimado);
  const antes = leerMonto(original.montoEstimado);
  if (monto.tipo === 'valido' && (antes.tipo !== 'valido' || antes.centavos !== monto.centavos)) {
    solicitud.montoEstimadoMinor = monto.centavos;
  }
  const soportes = filas.flatMap((fila) => {
    const ids = nuevosIds[fila.requisito.codigo] ?? [];
    if (ids.length === 0) {
      return [];
    }
    const conservados = fila.accion === 'agregar' ? fila.actuales.map((a) => a.soporteId) : [];
    return [{ codigoRequisito: fila.requisito.codigo, soporteIds: [...conservados, ...ids] }];
  });
  if (soportes.length > 0) {
    solicitud.soportes = soportes;
  }
  return solicitud;
}

/** Lo que el servidor dijo que falta (`422`), por hecho y por soporte; lo que no es de ninguno queda en `general`. */
export interface ErroresServidor {
  hechos: Partial<Record<CampoHecho, ProblemaHecho>>;
  soportes: Record<string, ProblemaSoporte | 'reemplazar'>;
  general: boolean;
}

const PROBLEMA_HECHO: Readonly<Record<string, ProblemaHecho>> = {
  required: 'requerido',
  invalid_format: 'formatoInvalido',
  out_of_range: 'fechaFueraRango',
};

const PROBLEMA_SOPORTE: Readonly<Record<string, ProblemaSoporte | 'reemplazar'>> = {
  not_replaced: 'reemplazar',
  missing: 'falta',
  too_few: 'pocos',
  too_many: 'muchos',
  invalid_format: 'formato',
  not_applicable: 'noAplica',
  not_found: 'noEncontrado',
};

export function erroresDelServidor(campos: readonly CampoReenvio[]): ErroresServidor {
  const errores: ErroresServidor = { hechos: {}, soportes: {}, general: false };
  for (const { campo, codigo } of campos) {
    const hecho = CAMPO_DEL_SERVIDOR[campo];
    if (hecho) {
      errores.hechos[hecho] = problemaDelServidor(hecho, codigo);
      continue;
    }
    const soporte = campo.startsWith('supports.') ? campo.slice('supports.'.length) : null;
    if (soporte && PROBLEMA_SOPORTE[codigo]) {
      errores.soportes[soporte] = PROBLEMA_SOPORTE[codigo];
      continue;
    }
    errores.general = true;
  }
  return errores;
}

function problemaDelServidor(campo: CampoHecho, codigo: string): ProblemaHecho {
  if (codigo === 'out_of_range') {
    switch (campo) {
      case 'lugar':
        return 'lugarLongitud';
      case 'descripcion':
        return 'descripcionLongitud';
      case 'montoEstimado':
        return 'montoRango';
      default:
        return 'fechaFueraRango';
    }
  }
  return PROBLEMA_HECHO[codigo] ?? 'formatoInvalido';
}
