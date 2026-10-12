import { DetalleOferta } from './detalle-oferta';

/**
 * DATOS DE PRUEBA, provisionales: contenido de la oferta mientras el servicio de originación no exponga su
 * detalle (pendiente de HU-W1.2-03, contrato HU-W1.3-01 §8). La prima es la de las ofertas simuladas del
 * backend (89 500 COP); el valor asegurado, la vigencia, el beneficiario y las coberturas replican el frame
 * E3 de Figma. Cuando HU-W1.2-03 publique el endpoint, el cliente de `core/api/originacion/` lo entregará y
 * este archivo se elimina junto con el valor predeterminado de `DETALLE_OFERTA`.
 */
export const DETALLE_OFERTA_PROVISIONAL: DetalleOferta = {
  primaMensual: 89_500,
  moneda: 'COP',
  valorAsegurado: 250_000_000,
  vigenciaAnios: 20,
  beneficiario: 'Banco Aliado',
  coberturas: [
    { clave: 'fallecimiento', porcentaje: 100, tope: null },
    { clave: 'incapacidad', porcentaje: 100, tope: null },
    { clave: 'enfermedadesGraves', porcentaje: 30, tope: 75_000_000 },
  ],
};
