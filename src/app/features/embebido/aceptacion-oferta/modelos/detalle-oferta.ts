/** Cobertura incluida en la oferta. `clave` nombra el texto `embebido.aceptacionOferta.oferta.cobertura.<clave>`. */
export interface CoberturaOferta {
  clave: string;
  /** Porcentaje del saldo insoluto del crédito que cubre. */
  porcentaje: number;
  /** Tope en la moneda de la oferta; `null` sin tope. */
  tope: number | null;
}

/**
 * Contenido de la oferta que muestra el paso 3 (frame E3). El servicio de originación aún no expone el
 * detalle de la oferta (pendiente de HU-W1.2-03, contrato HU-W1.3-01 §8).
 */
export interface DetalleOferta {
  primaMensual: number;
  /** Código ISO 4217 (COP, MXN, CLP, PEN). */
  moneda: string;
  valorAsegurado: number;
  vigenciaAnios: number;
  /** Beneficiario oneroso (el banco del crédito). */
  beneficiario: string;
  coberturas: readonly CoberturaOferta[];
}
