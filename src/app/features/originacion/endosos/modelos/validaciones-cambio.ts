import {
  Beneficiario,
  CodigoCampoSolicitud,
  DatosContacto,
  ErrorDeCampoSolicitud,
  PARENTESCOS,
  TIPOS_DOCUMENTO,
} from '@core/api/originacion/solicitud-modificacion.modelos';

/**
 * Reglas de la captura de A3 · Solicitar una modificación (HU-W1.4-01, decisiones D-3 a y D-4 a): las mismas que el
 * servicio aplica al radicar (`domain.ValidateRequested`), para señalar lo inválido antes de radicar (CA-3). Devuelven los
 * errores con los nombres de campo del contrato (`beneficiaries[0].share_percent`…), así la página pinta igual un error
 * propio y uno del `422`. El servicio sigue siendo quien decide.
 */

/** Un beneficiario como lo escribe el asegurado: la participación es `null` mientras no tenga un número. */
export interface BeneficiarioCaptura {
  nombreCompleto: string;
  parentesco: string;
  tipoDocumento: string;
  numeroDocumento: string;
  participacion: number | null;
}

/** Los datos de contacto como los escribe el asegurado; vacío es «no cambia». */
export interface ContactoCaptura {
  direccion: string;
  correo: string;
  telefono: string;
}

export const MAX_BENEFICIARIOS = 10;
const PUNTOS_TOTALES = 10_000;
const PATRON_DOCUMENTO = /^[A-Za-z0-9]{5,20}$/;
const SOLO_DIGITOS = /^\d+$/;
const TIPOS_SOLO_DIGITOS: readonly string[] = ['CC', 'TI', 'RC'];
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_TELEFONO = /^(\+57)?(\d{10})$/;
const PATRON_MONTO = /^\d{1,3}([.\s]?\d{3})*$/;

/** Un espacio entre palabras y sin espacios a los lados. */
export function colapsar(texto: string): string {
  return texto.trim().split(/\s+/).filter(Boolean).join(' ');
}

/** El número de documento sin puntos, espacios ni guiones («1.142.998.310» → «1142998310»). */
export function normalizarDocumento(texto: string): string {
  return texto.replace(/[.\s-]/g, '');
}

/** El teléfono como lo guarda el servicio: sus 10 dígitos, sin espacios, guiones ni `+57`. */
export function normalizarTelefono(texto: string): string {
  const limpio = texto.replace(/[\s-]/g, '');
  const partes = PATRON_TELEFONO.exec(limpio);
  return partes ? partes[2] : limpio;
}

/** Lee un monto entero escrito con o sin separadores de miles («300.000.000»); `null` si no lo es. */
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim();
  if (!limpio || !PATRON_MONTO.test(limpio)) {
    return null;
  }
  return Number(limpio.replace(/[.\s]/g, ''));
}

/** La participación en puntos básicos; `null` si tiene más de dos decimales o no es un número. */
export function aPuntosBasicos(participacion: number | null): number | null {
  if (participacion === null || !Number.isFinite(participacion)) {
    return null;
  }
  const escalada = participacion * 100;
  const redondeada = Math.round(escalada);
  return Math.abs(escalada - redondeada) < 1e-6 ? redondeada : null;
}

/** La suma de las participaciones en porcentaje, con dos decimales (las que no se pueden leer no suman). */
export function totalParticipacion(lista: readonly BeneficiarioCaptura[]): number {
  const puntos = lista.reduce((suma, b) => suma + (aPuntosBasicos(b.participacion) ?? 0), 0);
  return puntos / 100;
}

function tieneLetra(texto: string): boolean {
  return /\p{L}/u.test(texto);
}

function tieneControl(texto: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f-\u009f]/.test(texto);
}

function llave(b: { tipoDocumento: string; numeroDocumento: string }): string {
  return `${b.tipoDocumento.toUpperCase()} ${normalizarDocumento(b.numeroDocumento).toUpperCase()}`;
}

function mismaLista(propuesta: readonly BeneficiarioCaptura[], actuales: readonly Beneficiario[]): boolean {
  if (propuesta.length !== actuales.length) {
    return false;
  }
  const porLlave = new Map(actuales.map((b) => [llave(b), b]));
  return propuesta.every((p) => {
    const actual = porLlave.get(llave(p));
    return (
      actual !== undefined &&
      colapsar(p.nombreCompleto).toLowerCase() === colapsar(actual.nombreCompleto).toLowerCase() &&
      p.parentesco === actual.parentesco &&
      aPuntosBasicos(p.participacion) === aPuntosBasicos(actual.participacion)
    );
  });
}

/** Los errores de una lista de beneficiarios propuesta, todos a la vez. */
export function validarBeneficiarios(
  propuesta: readonly BeneficiarioCaptura[],
  actuales: readonly Beneficiario[],
  maximo = MAX_BENEFICIARIOS,
): ErrorDeCampoSolicitud[] {
  const errores: ErrorDeCampoSolicitud[] = [];
  const marcar = (campo: string, codigo: CodigoCampoSolicitud) => errores.push({ campo, codigo });
  if (propuesta.length === 0) {
    marcar('beneficiaries', 'required');
    return errores;
  }
  if (propuesta.length > maximo) {
    marcar('beneficiaries', 'out_of_range');
  }
  let participacionesValidas = true;
  const vistos = new Set<string>();
  propuesta.forEach((b, i) => {
    const campo = (miembro: string) => `beneficiaries[${i}].${miembro}`;
    const nombre = colapsar(b.nombreCompleto);
    if (!nombre) {
      marcar(campo('full_name'), 'required');
    } else if (nombre.length < 3 || nombre.length > 120 || !tieneLetra(nombre) || tieneControl(nombre)) {
      marcar(campo('full_name'), 'invalid_format');
    }
    if (!b.parentesco) {
      marcar(campo('relationship'), 'required');
    } else if (!(PARENTESCOS as readonly string[]).includes(b.parentesco)) {
      marcar(campo('relationship'), 'invalid_format');
    }
    if (!b.tipoDocumento) {
      marcar(campo('document_type'), 'required');
    } else if (!(TIPOS_DOCUMENTO as readonly string[]).includes(b.tipoDocumento)) {
      marcar(campo('document_type'), 'invalid_format');
    }
    const numero = normalizarDocumento(b.numeroDocumento);
    if (!numero) {
      marcar(campo('document_number'), 'required');
    } else if (!PATRON_DOCUMENTO.test(numero) || (TIPOS_SOLO_DIGITOS.includes(b.tipoDocumento) && !SOLO_DIGITOS.test(numero))) {
      marcar(campo('document_number'), 'invalid_format');
    } else {
      if (vistos.has(llave(b))) {
        marcar(campo('document_number'), 'duplicate');
      }
      vistos.add(llave(b));
    }
    const puntos = aPuntosBasicos(b.participacion);
    if (b.participacion === null) {
      marcar(campo('share_percent'), 'required');
      participacionesValidas = false;
    } else if (puntos === null) {
      marcar(campo('share_percent'), 'invalid_format');
      participacionesValidas = false;
    } else if (puntos < 1 || puntos > PUNTOS_TOTALES) {
      marcar(campo('share_percent'), 'out_of_range');
      participacionesValidas = false;
    }
  });
  if (participacionesValidas && Math.round(totalParticipacion(propuesta) * 100) !== PUNTOS_TOTALES) {
    marcar('beneficiaries', 'share_total_not_100');
  }
  if (errores.length === 0 && mismaLista(propuesta, actuales)) {
    marcar('beneficiaries', 'no_change');
  }
  return errores;
}

/** Los errores del valor asegurado nuevo: entero, dentro de los límites y distinto del actual. */
export function validarValorAsegurado(
  texto: string,
  actual: number,
  limites: { valorMinimo: number; valorMaximo: number },
): ErrorDeCampoSolicitud[] {
  if (!texto.trim()) {
    return [{ campo: 'insured_amount', codigo: 'required' }];
  }
  const valor = leerMonto(texto);
  if (valor === null) {
    return [{ campo: 'insured_amount', codigo: 'invalid_format' }];
  }
  if (valor < limites.valorMinimo || valor > limites.valorMaximo) {
    return [{ campo: 'insured_amount', codigo: 'out_of_range' }];
  }
  return valor === actual ? [{ campo: 'insured_amount', codigo: 'no_change' }] : [];
}

/** Los errores de los datos de contacto nuevos: al menos uno, cada uno con su forma y distinto del actual. */
export function validarContacto(captura: ContactoCaptura, actual: DatosContacto): ErrorDeCampoSolicitud[] {
  const direccion = colapsar(captura.direccion);
  const correo = captura.correo.trim();
  const telefono = captura.telefono.trim() ? normalizarTelefono(captura.telefono) : '';
  if (!direccion && !correo && !telefono) {
    return [{ campo: 'personal_data', codigo: 'required' }];
  }
  const errores: ErrorDeCampoSolicitud[] = [];
  if (direccion) {
    if (direccion.length < 5 || direccion.length > 160 || tieneControl(direccion)) {
      errores.push({ campo: 'personal_data.address', codigo: 'invalid_format' });
    } else if (actual.direccion !== null && direccion.toLowerCase() === actual.direccion.toLowerCase()) {
      errores.push({ campo: 'personal_data.address', codigo: 'no_change' });
    }
  }
  if (correo) {
    if (correo.length > 254 || !PATRON_CORREO.test(correo)) {
      errores.push({ campo: 'personal_data.email', codigo: 'invalid_format' });
    } else if (actual.correo !== null && correo.toLowerCase() === actual.correo.toLowerCase()) {
      errores.push({ campo: 'personal_data.email', codigo: 'no_change' });
    }
  }
  if (telefono) {
    if (!/^\d{10}$/.test(telefono)) {
      errores.push({ campo: 'personal_data.phone', codigo: 'invalid_format' });
    } else if (actual.telefono !== null && telefono === actual.telefono) {
      errores.push({ campo: 'personal_data.phone', codigo: 'no_change' });
    }
  }
  return errores;
}

/** La lista propuesta, normalizada, lista para radicar (solo se llama sin errores). */
export function aBeneficiarios(propuesta: readonly BeneficiarioCaptura[]): Beneficiario[] {
  return propuesta.map((b) => ({
    nombreCompleto: colapsar(b.nombreCompleto),
    parentesco: b.parentesco,
    tipoDocumento: b.tipoDocumento,
    numeroDocumento: normalizarDocumento(b.numeroDocumento),
    participacion: b.participacion ?? 0,
  }));
}

/**
 * La clave del mensaje de un error: la específica del control si existe (`errores.campos.<control>.<codigo>`) y si no la
 * general (`errores.<codigo>`). Prefijo `originacion.solicitudes`.
 */
const ESPECIFICOS: Readonly<Record<string, readonly CodigoCampoSolicitud[]>> = {
  nombreCompleto: ['invalid_format'],
  numeroDocumento: ['invalid_format', 'duplicate'],
  participacion: ['invalid_format', 'out_of_range'],
  beneficiarios: ['required', 'out_of_range', 'no_change'],
  valorAsegurado: ['invalid_format', 'out_of_range', 'no_change'],
  contacto: ['required'],
  direccion: ['invalid_format'],
  correo: ['invalid_format'],
  telefono: ['invalid_format'],
};

export function claveMensaje(control: string, codigo: CodigoCampoSolicitud): string {
  return (ESPECIFICOS[control] ?? []).includes(codigo) ? `errores.campos.${control}.${codigo}` : `errores.${codigo}`;
}
