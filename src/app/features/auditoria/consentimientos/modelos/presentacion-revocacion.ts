import {
  CampoRevocacion,
  EntidadRevocacion,
  EstadoRevocacion,
  MotivoRevocacion,
  RevocacionCumplimiento,
} from '@core/api/auditoria/revocacion.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

/**
 * Reglas de presentación de la revocación (HU-W4.2-02): funciones puras, sin Angular, para que la página, el modal y el
 * seguimiento compartan la misma lectura del estado que devuelve el contrato.
 */

/** Etiqueta de estado del consentimiento (`auditoria.consentimientos.estados.<clave>`). */
export type ClaveEstado = 'activo' | 'enCurso' | 'revocado' | 'parcial' | 'vencido';

/** Por qué un consentimiento ya no se puede revocar (CA-4). */
export type MotivoNoRevocable = 'revocado' | 'parcial' | 'vencido';

/** Quién pidió la revocación, tal como lo ve quien tiene la sesión. */
export type SolicitanteRevocacion = 'tu' | 'operaciones' | 'titular';

/** Tiempo extra, después del mayor plazo de las entidades, que el sondeo espera un cambio antes de rendirse. */
export const MARGEN_SONDEO_MS = 30_000;

/** Largo de la referencia, una vez colapsados los espacios repetidos. */
export const REFERENCIA_MINIMO = 3;
export const REFERENCIA_MAXIMO = 64;
/** Letras sin tilde ni ñ, dígitos, espacio y `. / # _ -`: igual que `referencePattern` del backend. */
const PATRON_REFERENCIA = /^[A-Za-z0-9 ./#_-]+$/;

/**
 * Etiqueta y tono del estado (S3). Se deriva de `status` y `notice_status`: el backend marca `revoked` desde el registro,
 * pero «Revocado» se dice cuando todas las entidades confirmaron.
 */
export function etiquetaEstado(estado: EstadoRevocacion): { clave: ClaveEstado; tono: TonoInsignia } {
  switch (estado.estado) {
    case 'active':
      return { clave: 'activo', tono: 'exito' };
    case 'partially_revoked':
      return { clave: 'parcial', tono: 'advertencia' };
    case 'expired':
      return { clave: 'vencido', tono: 'neutro' };
    case 'revoked':
      return estado.revocacion?.estadoAviso === 'in_progress'
        ? { clave: 'enCurso', tono: 'informacion' }
        : { clave: 'revocado', tono: 'neutro' };
  }
}

/** Entidades que aún tienen tiempo para confirmar. */
export function pendientes(estado: EstadoRevocacion): EntidadRevocacion[] {
  return (estado.revocacion?.entidades ?? []).filter((entidad) => entidad.estado === 'pending');
}

/** Entidades que no confirmaron dentro de su plazo: las únicas a las que aplica el reintento (S5). */
export function noConfirmadas(estado: EstadoRevocacion): EntidadRevocacion[] {
  return (estado.revocacion?.entidades ?? []).filter((entidad) => entidad.estado === 'not_confirmed');
}

/** Entidades que ya confirmaron la revocación. */
export function confirmadas(estado: EstadoRevocacion): EntidadRevocacion[] {
  return (estado.revocacion?.entidades ?? []).filter((entidad) => entidad.estado === 'confirmed');
}

/**
 * Hay que seguir consultando mientras el aviso está en curso o alguna entidad espera (la ventana de un reintento: el
 * aviso sigue en `partial` pero la entidad vuelve a `pending`).
 */
export function requiereSondeo(estado: EstadoRevocacion): boolean {
  return estado.revocacion?.estadoAviso === 'in_progress' || pendientes(estado).length > 0;
}

/** Fin de la ventana de las entidades que aún esperan (el mayor `plazoHasta`); `null` si ninguna espera. */
export function plazoMaximoPendiente(estado: EstadoRevocacion): string | null {
  const plazos = pendientes(estado)
    .map((entidad) => entidad.plazoHasta)
    .filter((plazo): plazo is string => plazo !== null && !Number.isNaN(Date.parse(plazo)));
  return plazos.length === 0 ? null : plazos.reduce((mayor, plazo) => (Date.parse(plazo) > Date.parse(mayor) ? plazo : mayor));
}

/** Instante (ms) después del cual el sondeo se rinde: el mayor plazo de las entidades más 30 s; `null` si no hay plazos. */
export function limiteSondeo(estado: EstadoRevocacion): number | null {
  const plazos = (estado.revocacion?.entidades ?? [])
    .map((entidad) => (entidad.plazoHasta ? Date.parse(entidad.plazoHasta) : Number.NaN))
    .filter((plazo) => !Number.isNaN(plazo));
  return plazos.length === 0 ? null : Math.max(...plazos) + MARGEN_SONDEO_MS;
}

/** Pasó el límite del sondeo sin que el estado cambiara. En el límite exacto todavía se consulta. */
export function sondeoVencido(estado: EstadoRevocacion, ahora: number): boolean {
  const limite = limiteSondeo(estado);
  return limite !== null && ahora > limite;
}

/** Por qué no se puede revocar; `null` si es revocable (CA-4). */
export function motivoNoRevocable(estado: EstadoRevocacion): MotivoNoRevocable | null {
  if (estado.revocable) {
    return null;
  }
  switch (estado.estado) {
    case 'revoked':
      return 'revocado';
    case 'partially_revoked':
      return 'parcial';
    case 'expired':
      return 'vencido';
    case 'active':
      return null;
  }
}

/** Colapsa los espacios repetidos y recorta los extremos, como lo cuenta el backend. */
export function normalizarReferencia(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** Qué le pasa a la referencia (S2); `null` si es válida. */
export function errorReferencia(texto: string): 'required' | 'out_of_range' | 'invalid_format' | null {
  const referencia = normalizarReferencia(texto);
  if (referencia === '') {
    return 'required';
  }
  if (referencia.length < REFERENCIA_MINIMO || referencia.length > REFERENCIA_MAXIMO) {
    return 'out_of_range';
  }
  return PATRON_REFERENCIA.test(referencia) ? null : 'invalid_format';
}

/** Lo que el analista diligencia en el modal. `motivo` vacío es «sin elegir». */
export interface FormularioRevocacion {
  motivo: MotivoRevocacion | '';
  referencia: string;
  rolConfirmado: boolean;
}

/** Campos que faltan o no son válidos, en el orden del modal; vacía si se puede enviar. */
export function faltantes(formulario: FormularioRevocacion): CampoRevocacion[] {
  const campos: CampoRevocacion[] = [];
  if (formulario.motivo !== 'customer_request' && formulario.motivo !== 'regulatory_order') {
    campos.push('motivo');
  }
  if (errorReferencia(formulario.referencia) !== null) {
    campos.push('referencia');
  }
  if (!formulario.rolConfirmado) {
    campos.push('rolConfirmado');
  }
  return campos;
}

/** Quién pidió la revocación (F4): quien tiene la sesión, otro analista o el titular desde la app. */
export function solicitadaPor(revocacion: RevocacionCumplimiento, usuarioId: string | null): SolicitanteRevocacion {
  if (revocacion.solicitadaPor.tipo === 'holder') {
    return 'titular';
  }
  return usuarioId !== null && revocacion.solicitadaPor.id === usuarioId ? 'tu' : 'operaciones';
}

/** Cuándo se otorgó, según la entrada `granted` del historial; `null` si no viene. */
export function otorgadoEn(estado: EstadoRevocacion): string | null {
  return estado.historial.find((entrada) => entrada.estado === 'granted')?.ocurridoEn ?? null;
}
