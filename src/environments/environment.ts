/**
 * Producción (demo): entrega evaluable desplegada por CI/CD.
 * Los valores reales (URL del API Gateway, user pool de Cognito) se definen
 * cuando el repositorio de infraestructura (Terraform) los publique.
 */
export const environment = {
  nombre: 'produccion',
  produccion: true,
  apiGatewayUrl: 'PENDIENTE',
  cognito: { region: 'us-east-1', userPoolId: 'PENDIENTE', clienteId: 'PENDIENTE' },
  idiomaPredeterminado: 'es-CO',
};
