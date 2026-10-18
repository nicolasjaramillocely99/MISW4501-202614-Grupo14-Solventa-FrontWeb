/**
 * Pasarela de pagos: el único servicio externo al que el navegador le habla
 * directamente, sin pasar por el API Gateway de Solventa.
 *
 * **Es a propósito.** El número de tarjeta no debe atravesar nuestro
 * *frontend* ni nuestro *backend*: el navegador lo envía a la pasarela, que
 * devuelve un token, y a Solventa solo llega ese token con la marca y los
 * últimos cuatro dígitos. Eso mantiene la plataforma fuera del alcance de
 * PCI-DSS, que es lo que la propia pantalla E4 le promete al usuario.
 */

/** Tarjeta que el usuario escribió en E4. No sale de esta capa. */
export interface TarjetaSinTokenizar {
  numero: string;
  titular: string;
}

/** Lo único que vuelve de la pasarela y lo único que viaja a Solventa. */
export interface TarjetaTokenizada {
  token: string;
  marca: string;
  ultimosCuatro: string;
}

export interface TarjetaTokenizadaDto {
  token: string;
  brand: string;
  last4: string;
}

/** Códigos estables; la pantalla decide el texto por el código, nunca por el mensaje. */
export type MotivoErrorPasarela = 'tarjeta_invalida' | 'pasarela_no_disponible';

export class ErrorPasarela extends Error {
  constructor(readonly motivo: MotivoErrorPasarela) {
    super(motivo);
    this.name = 'ErrorPasarela';
  }
}
