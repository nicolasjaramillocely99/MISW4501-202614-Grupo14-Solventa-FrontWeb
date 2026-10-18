/**
 * Staging: réplica reducida de producción, encendida solo durante las ventanas
 * de experimentación (k6, Toxiproxy, OWASP ZAP). Se aprovisiona y destruye por experimento.
 */
export const environment = {
  nombre: 'staging',
  produccion: true,
  apiGatewayUrl: 'PENDIENTE',
  /** La tokenizacion va directo a la pasarela: el numero de tarjeta no pasa por Solventa. */
  pasarelaPagosUrl: 'PENDIENTE',
  cognito: { region: 'us-east-2', userPoolId: 'PENDIENTE', clienteId: 'PENDIENTE' },
  idiomaPredeterminado: 'es-CO',
};
