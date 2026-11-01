import {
  CampoSocio,
  ConsumoSocio,
  EstadoCredenciales,
  EventoSocio,
  ResumenSocio,
  SolicitudRegistroSocio,
  TipoSocio,
} from '@core/api/socios/socios.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

/**
 * Reglas de presentación de O10 / O11 (HU-W3.1-01): qué insignia lleva cada socio y cada credencial, el tono de la barra
 * de consumo, la línea de detalle del historial y la validación local del registro, que replica la del contrato para
 * avisar antes de enviar (el servidor sigue siendo quien decide).
 */

/** Umbral de «cerca del límite» del contrato (≥ 80 % de la cuota diaria). */
export const UMBRAL_CERCA_LIMITE = 80;

export const HORAS_TRANSICION_MINIMO = 1;
export const HORAS_TRANSICION_MAXIMO = 168;

export interface Etiqueta {
  /** Sufijo de la clave i18n. */
  clave: string;
  tono: TonoInsignia;
}

/** Estado de la fila: pendiente, dado de baja o, si está activo, según su consumo de hoy. */
export function etiquetaEstadoSocio(socio: ResumenSocio): Etiqueta {
  switch (socio.estado) {
    case 'pending_approval':
      return { clave: 'pendiente', tono: 'informacion' };
    case 'offboarded':
      return { clave: 'baja', tono: 'neutro' };
    default:
      if (socio.estadoConsumo === 'exceeded') {
        return { clave: 'excedido', tono: 'error' };
      }
      return socio.estadoConsumo === 'near_limit' ? { clave: 'cercaLimite', tono: 'advertencia' } : { clave: 'activo', tono: 'exito' };
  }
}

export function etiquetaCredenciales(estado: EstadoCredenciales): Etiqueta {
  switch (estado) {
    case 'active':
      return { clave: 'activas', tono: 'exito' };
    case 'rotation_in_progress':
      return { clave: 'rotacion', tono: 'advertencia' };
    case 'disabled':
      return { clave: 'inhabilitadas', tono: 'neutro' };
    default:
      return { clave: 'sinCredenciales', tono: 'neutro' };
  }
}

/** Tono de la barra de consumo: rojo al exceder, ámbar cerca del límite y azul en lo demás. */
export function tonoConsumo(consumo: ConsumoSocio | null): 'normal' | 'alerta' | 'excedido' {
  if (!consumo) {
    return 'normal';
  }
  if (consumo.porcentaje >= 100) {
    return 'excedido';
  }
  return consumo.porcentaje >= UMBRAL_CERCA_LIMITE ? 'alerta' : 'normal';
}

/** Ancho de la barra (0–100). */
export function anchoBarra(consumo: ConsumoSocio | null): number {
  return consumo ? Math.min(100, Math.max(0, consumo.porcentaje)) : 0;
}

/** Valores que interpola la línea de detalle de una entrada del historial (`socios.detalle.historial.detalles.<tipo>`). */
export function valoresDetalle(evento: EventoSocio): Record<string, string | number> {
  const valores: Record<string, string | number> = {};
  for (const [clave, valor] of Object.entries(evento.detalles)) {
    if (typeof valor === 'string' || typeof valor === 'number') {
      valores[clave] = valor;
    }
  }
  return valores;
}

// --- Registro --------------------------------------------------------------------------------------------------------

/** Valores del formulario de registro tal como los escribe el analista. */
export interface FormularioRegistro {
  nombre: string;
  codigo: string;
  tipo: TipoSocio | '';
  /** Separados por comas. */
  productos: string;
  correoContactoTecnico: string;
  limiteDiario: number | null;
  limiteRafaga: number | null;
  rafagaMaxima: number | null;
}

export const FORMULARIO_INICIAL: FormularioRegistro = {
  nombre: '',
  codigo: '',
  tipo: '',
  productos: '',
  correoContactoTecnico: '',
  limiteDiario: 5000,
  limiteRafaga: 100,
  rafagaMaxima: 200,
};

const PATRON_CODIGO = /^[a-z][a-z0-9_]{2,39}$/;
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function separarProductos(texto: string): string[] {
  return texto
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function entero(valor: number | null, minimo: number, maximo: number): 'required' | 'out_of_range' | null {
  if (valor === null || Number.isNaN(valor)) {
    return 'required';
  }
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo ? null : 'out_of_range';
}

/** Errores del registro por campo, con los códigos del contrato (`required`, `invalid_format`, `out_of_range`). */
export function validarRegistro(valor: FormularioRegistro): Map<CampoSocio, string> {
  const errores = new Map<CampoSocio, string>();
  const nombre = valor.nombre.trim();
  if (!nombre) {
    errores.set('nombre', 'required');
  } else if (nombre.length < 3 || nombre.length > 80) {
    errores.set('nombre', 'out_of_range');
  }
  const codigo = valor.codigo.trim();
  if (!codigo) {
    errores.set('codigo', 'required');
  } else if (!PATRON_CODIGO.test(codigo)) {
    errores.set('codigo', 'invalid_format');
  }
  if (!valor.tipo) {
    errores.set('tipo', 'required');
  }
  const productos = separarProductos(valor.productos);
  if (productos.length === 0) {
    errores.set('productos', 'required');
  } else if (productos.length > 10 || productos.some((p) => p.length < 2 || p.length > 60)) {
    errores.set('productos', 'out_of_range');
  }
  const correo = valor.correoContactoTecnico.trim();
  if (!correo) {
    errores.set('correoContactoTecnico', 'required');
  } else if (correo.length > 254 || !PATRON_CORREO.test(correo)) {
    errores.set('correoContactoTecnico', 'invalid_format');
  }
  const diario = entero(valor.limiteDiario, 1, 10_000_000);
  if (diario) {
    errores.set('limiteDiario', diario);
  }
  const rafaga = entero(valor.limiteRafaga, 1, 10_000);
  if (rafaga) {
    errores.set('limiteRafaga', rafaga);
  }
  const maxima = entero(valor.rafagaMaxima, valor.limiteRafaga ?? 1, 20_000);
  if (maxima) {
    errores.set('rafagaMaxima', maxima);
  }
  return errores;
}

/** Solicitud lista para enviar; solo se llama con el formulario válido. */
export function aSolicitudRegistro(valor: FormularioRegistro): SolicitudRegistroSocio {
  return {
    nombre: valor.nombre.trim(),
    codigo: valor.codigo.trim(),
    tipo: valor.tipo as TipoSocio,
    productos: separarProductos(valor.productos),
    correoContactoTecnico: valor.correoContactoTecnico.trim(),
    cuota: { limiteDiario: valor.limiteDiario ?? 0, limiteRafaga: valor.limiteRafaga ?? 0, rafagaMaxima: valor.rafagaMaxima ?? 0 },
  };
}

/** Error del periodo de transición de la rotación, o `null` si es válido. */
export function validarHorasTransicion(horas: number | null): 'required' | 'out_of_range' | null {
  return entero(horas, HORAS_TRANSICION_MINIMO, HORAS_TRANSICION_MAXIMO);
}
