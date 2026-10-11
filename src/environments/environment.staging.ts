/**
 * Staging: réplica reducida de producción, encendida solo durante las ventanas
 * de experimentación (k6, Toxiproxy, OWASP ZAP). Se aprovisiona y destruye por experimento.
 */
export const environment = {
  nombre: 'staging',
  produccion: true,
  apiGatewayUrl: 'PENDIENTE',
  cognito: { region: 'us-east-2', userPoolId: 'PENDIENTE', clienteId: 'PENDIENTE' },
  idiomaPredeterminado: 'es-CO',
};
