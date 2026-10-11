import { expect, test } from '@playwright/test';

import { simularCognito } from '../fixtures/sesion-por-rol';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';
import { verificarAccesibilidad } from './verificar-accesibilidad';

test.describe('Accesibilidad del acceso al portal (HA-S01, OBJ 13)', () => {
  test('P0 · inicio de sesión', async ({ page }) => {
    await new InicioSesionPagina(page).abrir();

    await verificarAccesibilidad(page);
  });

  test('P0 · inicio de sesión con errores de validación y de credenciales', async ({ page }) => {
    await simularCognito(page);
    const inicioSesion = new InicioSesionPagina(page);
    await inicioSesion.abrir();

    await inicioSesion.entrar.click();
    await expect(page.getByText('Escribe tu correo electrónico.')).toBeVisible();
    await verificarAccesibilidad(page);

    await inicioSesion.ingresar('nadie@solventa.co', 'clave-equivocada');
    await expect(inicioSesion.aviso).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('acceso no autorizado (403)', async ({ page }) => {
    await page.goto('/acceso/no-autorizado');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acceso no autorizado');

    await verificarAccesibilidad(page);
  });

  test('sesión expirada', async ({ page }) => {
    await page.goto('/acceso/sesion-expirada');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu sesión expiró');

    await verificarAccesibilidad(page);
  });
});
