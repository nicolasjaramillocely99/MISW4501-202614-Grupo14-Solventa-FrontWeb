/**
 * Usuarios del humo contra el portal desplegado (proyecto `nube`, T5): los cuatro usuarios permanentes del *user pool*
 * de `bootstrap/identity` del backend, uno por rol. Se pueden cambiar por variable. La contraseña llega de
 * `NUBE_CONTRASENA` (se carga de la variable de Windows `SOLVENTA_IDENTITY_SEED_PASSWORD`) y **nunca** se imprime ni se
 * guarda en el repositorio.
 */

export type RolNube = 'asegurado' | 'asesor' | 'operaciones' | 'socio';

export const USUARIOS_NUBE: Readonly<Record<RolNube, string>> = {
  asegurado: process.env['NUBE_ASEGURADO'] || 'asegurado@example.com',
  asesor: process.env['NUBE_ASESOR'] || 'asesor@example.com',
  operaciones: process.env['NUBE_OPERACIONES'] || 'operaciones@example.com',
  socio: process.env['NUBE_SOCIO'] || 'socio@example.com',
};

export const CONTRASENA_NUBE = process.env['NUBE_CONTRASENA'] ?? '';

/** Sufijo de las ofertas de demostración y de los clientes de esta corrida (`demo-active-<run>`). */
export const CORRIDA_NUBE = process.env['NUBE_RUN'] || `e2e${Date.now().toString(36)}`;

/** Tarjetas de prueba de la pasarela simulada: la primera aprueba; las terminadas en 0002 rechazan. */
export const TARJETA_APROBADA = '4111 1111 1111 1111';
export const TARJETA_RECHAZADA = '4000 0000 0000 0002';
