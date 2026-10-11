/**
 * Local: desarrollo diario contra el ambiente Docker Compose del backend
 * (PostgreSQL, Redis, LocalStack y stubs del ecosistema externo).
 * `ng serve` reemplaza `environment.ts` por este archivo (ver `angular.json`).
 *
 * Cognito local: emulador Moto del backend (`tests/security/ha-s01/local`, HA-S01) en
 * `http://localhost:5100/`, con los identificadores deterministas que deja su `seed.sh`.
 * En staging y producción no hay `endpoint`: se usa el endpoint regional de Cognito.
 */
export const environment = {
  nombre: 'local',
  produccion: false,
  apiGatewayUrl: 'http://localhost:8080',
  cognito: {
    region: 'us-east-2',
    endpoint: 'http://localhost:5100/',
    userPoolId: 'us-east-2_88555728a50459bf24b7f9852bd1309c320c7b54aae1b',
    clienteId: '9dbed27502f38ace4281ec963a',
  },
  idiomaPredeterminado: 'es-CO',
};
