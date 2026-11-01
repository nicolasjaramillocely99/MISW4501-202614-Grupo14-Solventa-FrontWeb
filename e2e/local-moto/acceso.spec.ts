import { Response, expect, test } from '@playwright/test';

import { environment as ambienteLocal } from '../../src/environments/environment.development';
import { INICIO_Y_MENU_POR_ROL } from '../fixtures/inicio-por-rol';
import { ROLES_PRUEBA, RolPrueba } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';

/**
 * Humo del acceso contra el Cognito local (Moto) del backend, **sin** `page.route`: los tokens son reales,
 * firmados por el emulador. Solo existe en el proyecto `local-moto` (`E2E_MOTO=1`), nunca en el CI.
 * Requiere Moto levantado y sembrado (`tests/security/ha-s01/local` del backend) y `MOTO_USER_PASSWORD`.
 */

/** Usuarios que siembra `seed.sh` del backend, uno por rol. */
const USUARIOS_MOTO: Readonly<Record<RolPrueba, { correo: string; nombre: string }>> = {
  asegurado: { correo: 'asegurado.local@example.com', nombre: 'Carolina Pérez' },
  asesor: { correo: 'asesor.local@example.com', nombre: 'Laura Gómez' },
  operaciones: { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' },
  socio: { correo: 'socio.local@example.com', nombre: 'Banco Aliado' },
};

const CONTRASENA = process.env['MOTO_USER_PASSWORD'] ?? '';

/** Respuesta de Moto al inicio de sesión con usuario y contraseña. */
function esInicioDeSesionEnMoto(respuesta: Response): boolean {
  const cuerpo = respuesta.request().postDataJSON() as { AuthFlow?: string } | null;
  return (
    respuesta.url() === ambienteLocal.configuracionLocal?.cognito.endpoint && cuerpo?.AuthFlow === 'USER_PASSWORD_AUTH'
  );
}

test.describe('Acceso al portal contra el Cognito local (Moto, HA-S01)', () => {
  test.beforeAll(() => {
    expect(CONTRASENA, 'Define MOTO_USER_PASSWORD con la contraseña usada en seed.sh').not.toBe('');
  });

  for (const rol of ROLES_PRUEBA) {
    test(`el usuario con rol ${rol} inicia sesión en Moto, ve su inicio y su menú, y cierra sesión`, async ({
      page,
    }) => {
      const inicioSesion = new InicioSesionPagina(page);
      await inicioSesion.abrir();

      const autenticacion = page.waitForResponse(esInicioDeSesionEnMoto);
      await inicioSesion.ingresar(USUARIOS_MOTO[rol].correo, CONTRASENA);
      expect((await autenticacion).status()).toBe(200);

      await expect(page).toHaveURL(/\/inicio$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        INICIO_Y_MENU_POR_ROL[rol].titulo,
      );
      await expect(
        page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link'),
      ).toHaveText(INICIO_Y_MENU_POR_ROL[rol].menu);
      await expect(page.getByRole('banner')).toContainText(USUARIOS_MOTO[rol].nombre);

      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page).toHaveURL(/\/acceso\/iniciar-sesion$/);
      await page.goto('/inicio');
      await expect(page).toHaveURL(/\/acceso\/iniciar-sesion\?returnUrl=%2Finicio$/);
    });
  }

  test('con una contraseña equivocada Moto la rechaza y el portal muestra el error genérico', async ({
    page,
  }) => {
    const inicioSesion = new InicioSesionPagina(page);
    await inicioSesion.abrir();

    const autenticacion = page.waitForResponse(esInicioDeSesionEnMoto);
    await inicioSesion.ingresar(USUARIOS_MOTO.asesor.correo, `${CONTRASENA}-equivocada`);
    expect((await autenticacion).status()).toBe(400);

    await expect(inicioSesion.aviso).toHaveText('El correo o la contraseña no son correctos.');
    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion$/);
  });
});
