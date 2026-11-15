import { CambioPrima, Validacion } from '@core/api/originacion/endosos.modelos';
import { Beneficiario, BeneficiarioOneroso, CambioCampo, TipoCambio } from '@core/api/originacion/solicitud-modificacion.modelos';

/**
 * Textos del cambio y de las validaciones de un endoso (HU-W1.4-02), compartidos por el detalle (O3/O3b) y el historial
 * (O4). Son funciones puras sobre un `Formato` (traducción e `Intl` del idioma activo), así se prueban sin la página.
 */

/** Traducción y formatos del idioma activo. */
export interface Formato {
  t(clave: string, parametros?: Record<string, unknown>): string;
  idioma: string;
}

/** Lo que se usa del servicio de traducción (`TranslocoService` lo cumple). */
export interface Traductor {
  translate(clave: string, parametros?: Record<string, unknown>): string;
  getActiveLang(): string;
}

/** El `Formato` del idioma activo. */
export function formatoDe(traductor: Traductor): Formato {
  return { t: (clave, parametros) => traductor.translate(clave, parametros), idioma: traductor.getActiveLang() };
}

const P = 'originacion.endosos';
const SOLO_DIGITOS = /^\d+$/;

function fechaValida(valor: string): Date | null {
  const fecha = new Date(valor);
  return valor && !Number.isNaN(fecha.getTime()) ? fecha : null;
}

/** «16/09/2026». */
export function fecha(f: Formato, valor: string): string {
  const d = fechaValida(valor);
  return d ? new Intl.DateTimeFormat(f.idioma, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '';
}

/** «16/09/2026, 16:20», como `formatoFechaHora`. */
export function fechaHora(f: Formato, valor: string): string {
  const d = fechaValida(valor);
  return d
    ? new Intl.DateTimeFormat(f.idioma, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(d)
    : '';
}

export function moneda(f: Formato, valor: number, codigo: string): string {
  return new Intl.NumberFormat(f.idioma, { style: 'currency', currency: codigo || 'COP', maximumFractionDigits: 0 }).format(valor);
}

function numero(f: Formato, valor: number, decimales = 0): string {
  return new Intl.NumberFormat(f.idioma, { maximumFractionDigits: decimales }).format(valor);
}

/** «TI 1.140.223.001»: un número de documento con separadores de miles; otro, tal cual. */
export function documento(f: Formato, tipo: string, numeroDoc: string): string {
  const cuerpo = SOLO_DIGITOS.test(numeroDoc) ? numero(f, Number(numeroDoc)) : numeroDoc;
  return tipo ? `${tipo} ${cuerpo}` : cuerpo;
}

/** «Mateo Pérez Gómez · TI 1.140.223.001 · 60 %». */
export function beneficiario(f: Formato, b: Beneficiario): string {
  return f.t(`${P}.campos.beneficiario`, {
    nombre: b.nombreCompleto,
    documento: documento(f, b.tipoDocumento, b.numeroDocumento),
    participacion: numero(f, b.participacion, 2),
  });
}

/** Una fila de «Cambio solicitado». */
export interface FilaCambio {
  campo: string;
  anterior: string;
  nuevo: string;
  /** El valor nuevo cambia (se resalta); «Sin cambio» no. */
  cambia: boolean;
}

function textoValor(f: Formato, valor: CambioCampo['anterior'], campo: string, monedaCodigo: string): string {
  if (valor === null) {
    return '—';
  }
  if (typeof valor === 'object') {
    return beneficiario(f, valor);
  }
  if (typeof valor === 'number') {
    return campo === 'insured_amount' ? moneda(f, valor, monedaCodigo) : numero(f, valor);
  }
  return campo === 'personal_data.phone' && SOLO_DIGITOS.test(valor) ? telefono(valor) : valor;
}

/** «301 234 5678»: los diez dígitos de un celular de Colombia. */
function telefono(digitos: string): string {
  return digitos.length === 10 ? `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}` : digitos;
}

/**
 * Las filas de «Cambio solicitado» (O3): una por beneficiario que cambia (más el oneroso, «Sin cambio»), el valor asegurado
 * con la prima mensual que recalcula el motor, o cada dato de contacto.
 */
export function filasCambio(
  f: Formato,
  tipo: TipoCambio,
  cambios: readonly CambioCampo[],
  oneroso: BeneficiarioOneroso | null,
  prima: CambioPrima | null,
  monedaCodigo: string,
): FilaCambio[] {
  const filas: FilaCambio[] = cambios.map((c, i) => ({
    campo:
      c.campo === 'beneficiaries'
        ? f.t(`${P}.campos.beneficiarioN`, { n: i + 1 })
        : f.t(`${P}.campos.${c.campo.replace('personal_data.', '')}`),
    anterior: textoValor(f, c.anterior, c.campo, monedaCodigo),
    nuevo: c.nuevo === null ? f.t(`${P}.campos.retirado`) : textoValor(f, c.nuevo, c.campo, monedaCodigo),
    cambia: true,
  }));
  if (tipo === 'beneficiaries') {
    filas.push({
      campo: f.t(`${P}.campos.oneroso`),
      anterior: f.t(`${P}.campos.onerosoValor`, { entidad: entidad(f, oneroso) }),
      nuevo: f.t(`${P}.campos.sinCambio`),
      cambia: false,
    });
  }
  if (tipo === 'insured_amount' && prima) {
    filas.push({
      campo: f.t(`${P}.campos.prima`),
      anterior: moneda(f, prima.anterior, prima.moneda),
      nuevo:
        prima.nueva === null
          ? f.t(`${P}.campos.primaSinCalcular`)
          : f.t(`${P}.campos.primaNueva`, { valor: moneda(f, prima.nueva, prima.moneda), version: prima.versionMotor ?? 'v1' }),
      cambia: prima.nueva !== null,
    });
  }
  return filas;
}

/** El nombre del aliado oneroso, o el genérico cuando no se conoce. */
export function entidad(f: Formato, oneroso: BeneficiarioOneroso | null): string {
  return oneroso?.nombre || oneroso?.aliadoId || f.t(`${P}.campos.entidadGenerica`);
}

/** Lo anterior y lo nuevo de una entrada del historial (O4), en una línea cada uno. */
export function resumenCambio(
  f: Formato,
  cambios: readonly CambioCampo[],
  prima: { anterior: number; nueva: number; moneda: string } | null,
  monedaCodigo = 'COP',
): { anterior: string; nuevo: string } {
  const lado = (cual: 'anterior' | 'nuevo'): string => {
    const partes = cambios
      .filter((c) => c[cual] !== null)
      .map((c) => {
        const valor = c[cual];
        if (c.campo.startsWith('personal_data.')) {
          return `${f.t(`${P}.campos.${c.campo.replace('personal_data.', '')}`)}: ${textoValor(f, valor, c.campo, monedaCodigo)}`;
        }
        if (valor !== null && typeof valor === 'object') {
          return f.t(`${P}.historial.beneficiarioCorto`, { nombre: valor.nombreCompleto, participacion: numero(f, valor.participacion, 2) });
        }
        return textoValor(f, valor, c.campo, monedaCodigo);
      });
    if (prima) {
      partes.push(f.t(`${P}.historial.prima`, { valor: moneda(f, cual === 'anterior' ? prima.anterior : prima.nueva, prima.moneda) }));
    }
    return partes.length > 0 ? partes.join(' · ') : '—';
  };
  return { anterior: lado('anterior'), nuevo: lado('nuevo') };
}

/** El título y el detalle de una validación, con sus valores (el contrato los trae en `params`). */
export function textoValidacion(f: Formato, v: Validacion): { titulo: string; detalle: string } {
  const p = v.parametros;
  const titulo = f.t(`${P}.validaciones.${v.codigo}.titulo`);
  const conocida = titulo !== `${P}.validaciones.${v.codigo}.titulo`;
  if (!conocida) {
    return { titulo: f.t(`${P}.validaciones.desconocida`, { codigo: v.codigo }), detalle: '' };
  }
  const clave = `${P}.validaciones.${v.codigo}.${v.resultado}`;
  switch (v.codigo) {
    case 'shares_total_100': {
      const partes = (p['shares'] ?? '')
        .split('|')
        .filter((s) => s !== '')
        .map((s) => `${numero(f, Number(s), 2)} %`)
        .join(' + ');
      return { titulo, detalle: f.t(clave, { partes, total: numero(f, Number(p['total'] ?? 0), 2) }) };
    }
    case 'onerous_beneficiary_intact':
      return { titulo, detalle: f.t(clave, { entidad: p['lender'] || f.t(`${P}.campos.entidadGenerica`) }) };
    case 'identity_documents_valid': {
      const verificaciones = Number(p['checks'] ?? 0);
      if (v.resultado === 'passed' && verificaciones === 0) {
        return { titulo, detalle: f.t(`${P}.validaciones.identity_documents_valid.sinNuevos`) };
      }
      const doc = (p['document'] ?? '').split(' ');
      return {
        titulo,
        detalle: f.t(clave, { n: verificaciones, documento: doc.length === 2 ? documento(f, doc[0], doc[1]) : (p['document'] ?? '') }),
      };
    }
    case 'no_open_claim':
      return { titulo, detalle: f.t(clave, { n: Number(p['open_claims'] ?? 0) }) };
    case 'requester_is_holder': {
      const canal = f.t(`${P}.canal.${p['channel'] === 'mobile' ? 'mobile' : 'web'}`);
      const base = p['requester'] ? `${p['requester']} · ${canal}` : canal;
      return { titulo, detalle: v.resultado === 'failed' ? `${base} · ${f.t(clave)}` : base };
    }
    case 'insured_amount_within_limits':
      return {
        titulo,
        detalle: f.t(clave, {
          valor: moneda(f, Number(p['requested'] ?? 0), 'COP'),
          minimo: moneda(f, Number(p['min'] ?? 0), 'COP'),
          maximo: moneda(f, Number(p['max'] ?? 0), 'COP'),
        }),
      };
    case 'personal_data_valid': {
      const campos = (p['fields'] ?? '')
        .split('|')
        .filter((c) => c !== '')
        .map((c) => f.t(`${P}.campos.${c.replace('personal_data.', '')}`))
        .join(', ');
      return { titulo, detalle: f.t(clave, { campos }) };
    }
    case 'policy_in_force':
      return { titulo, detalle: f.t(clave, { fecha: fecha(f, p['coverage_end'] ?? '') }) };
    default: {
      // Una guardia sin texto para ese resultado (p. ej. «Cumple» de una que solo se lista al fallar) no lleva detalle.
      const detalle = f.t(clave);
      return { titulo, detalle: detalle === clave ? '' : detalle };
    }
  }
}
