import { BeneficiarioOneroso } from '@core/api/originacion/solicitud-modificacion.modelos';

/**
 * Cómo se muestra un beneficiario (HU-W1.4-01): lo comparten «Beneficiarios actuales» de A3 y la tarjeta «Beneficiarios»
 * del detalle de la póliza (A2), para que las dos pantallas digan lo mismo.
 */

/** Un número de documento que se puede mostrar con separadores de miles sin perder cifras. */
const DOCUMENTO_NUMERICO = /^[1-9]\d{0,14}$/;

/** «TI 1.140.223.001»: un documento numérico con separadores de miles del idioma; otro (p. ej. un pasaporte), tal cual. */
export function formatoDocumento(tipo: string, numero: string, idioma: string): string {
  const texto = DOCUMENTO_NUMERICO.test(numero)
    ? new Intl.NumberFormat(idioma, { useGrouping: true }).format(Number(numero))
    : numero;
  return `${tipo} ${texto}`.trim();
}

/** «60» o «33,5» en el formato del idioma; vacío sin valor. */
export function formatoParticipacion(valor: number | null, idioma: string): string {
  return valor === null || Number.isNaN(valor)
    ? ''
    : new Intl.NumberFormat(idioma, { maximumFractionDigits: 2 }).format(valor);
}

/** El nombre del beneficiario oneroso: el del aliado, su código o la etiqueta genérica. */
export function nombreDelOneroso(oneroso: BeneficiarioOneroso, generica: string): string {
  return oneroso.nombre ?? oneroso.aliadoId ?? generica;
}
