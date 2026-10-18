/**
 * Local: desarrollo diario contra el ambiente Docker Compose del backend
 * (PostgreSQL, Redis, LocalStack y stubs del ecosistema externo).
 * `ng serve` reemplaza `environment.ts` por este archivo (ver `angular.json`).
 *
 * Cognito local: emulador Moto del backend (`tests/security/ha-s01/local`, HA-S01) en
 * `http://localhost:5100/`, con los identificadores deterministas que deja su `seed.sh`.
 * En staging y producción no hay `endpoint`: se usa el endpoint regional de Cognito.
 *
 * API: el servicio de originación no responde CORS (HU-W1.3-01, §7), así que en local el navegador llama al
 * mismo origen de `ng serve` y el proxy de desarrollo (`proxy.conf.json`) reenvía `/v1` a
 * `http://localhost:8080`. La URL es absoluta para que el interceptor reconozca el gateway y adjunte el token.
 */
export const environment = {
  nombre: 'local',
  produccion: false,
  apiGatewayUrl: 'http://localhost:4200',
  /** La tokenizacion va directo a la pasarela: el numero de tarjeta no pasa por Solventa. */
  pasarelaPagosUrl: 'http://localhost:4200/pasarela',
  cognito: {
    region: 'us-east-2',
    endpoint: 'http://localhost:5100/',
    userPoolId: 'us-east-2_88555728a50459bf24b7f9852bd1309c320c7b54aae1b',
    clienteId: '9dbed27502f38ace4281ec963a',
  },
  idiomaPredeterminado: 'es-CO',
};
