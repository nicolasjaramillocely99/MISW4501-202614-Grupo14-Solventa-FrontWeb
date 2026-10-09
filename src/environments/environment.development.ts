/**
 * Local: desarrollo diario contra el ambiente Docker Compose del backend
 * (PostgreSQL, Redis, LocalStack y stubs del ecosistema externo).
 * `ng serve` reemplaza `environment.ts` por este archivo (ver `angular.json`).
 */
export const environment = {
  nombre: 'local',
  produccion: false,
  apiGatewayUrl: 'http://localhost:8080',
  cognito: { region: 'us-east-1', userPoolId: 'local', clienteId: 'local' },
  idiomaPredeterminado: 'es-CO',
};
