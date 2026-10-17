import { MotivoRevision } from '@core/api/originacion/aceptacion.modelos';

/** Motivos de enrutamiento que la bandeja conoce y ofrece en el filtro (los del dominio del backend). */
export const MOTIVOS_ENRUTAMIENTO: readonly MotivoRevision[] = ['provisional_offer', 'high_risk_score'];

/**
 * Clave i18n (bajo `originacion.bandejaDecision.motivos`) del motivo. Un motivo que la web no conoce —p. ej. uno
 * nuevo del motor de suscripción— se muestra con el texto genérico, nunca con la clave sin traducir.
 */
export function claveMotivo(motivo: string): string {
  return (MOTIVOS_ENRUTAMIENTO as readonly string[]).includes(motivo) ? motivo : 'generico';
}
