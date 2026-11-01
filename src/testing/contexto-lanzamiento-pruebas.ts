/** Contexto de lanzamiento que el aliado entrega en `?contexto=` (HU-W1.2-01), con los datos del prototipo E1. */
export const CONTEXTO_LANZAMIENTO = {
  aliado: 'Banco Aliado',
  aliadoId: 'aliado-banco-1',
  banco: 'Banco Aliado',
  solicitud: { numero: '48213', montoAprobado: 250000000, plazoAnios: 20, cuotaEstimada: 2180000, moneda: 'COP' },
  cliente: {
    id: 'cliente-0001',
    nombreCompleto: 'Ana María Pérez',
    documento: '1020304050',
    correo: 'ana.perez@example.com',
    fechaNacimiento: '1988-04-12',
  },
};

/** JSON en base64url (sin relleno), como lo codifica el aliado. */
export function codificarContexto(contexto: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(contexto));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
