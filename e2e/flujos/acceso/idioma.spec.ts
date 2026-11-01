import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { CONTRASENA_PRUEBA, USUARIOS_PRUEBA, simularCognito } from '../../fixtures/sesion-por-rol';
import { InicioSesionPagina } from '../../paginas/inicio-sesion.pagina';

/** Selector de idioma de P0 y del portal (es-CO / en-US en caliente, OBJ 12). */
test.describe('Idioma del portal (HA-S01)', () => {
  test('P0 en inglés muestra los textos en inglés', async ({ page }) => {
    await new InicioSesionPagina(page).abrir();

    await page.getByLabel('Idioma').selectOption('en-US');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Language')).toHaveValue('en-US');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('el idioma elegido en P0 se conserva al entrar al portal y al recargar', async ({
    page,
  }) => {
    await simularCognito(page);
    await new InicioSesionPagina(page).abrir();
    await page.getByLabel('Idioma').selectOption('en-US');

    await page.getByLabel('Email').fill(USUARIOS_PRUEBA.asesor.correo);
    await page.getByLabel('Password').fill(CONTRASENA_PRUEBA);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hi, Laura');
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
    ).toHaveText(['Home', 'Quotes', 'Decision inbox', 'Renewals', 'Claims']);
    await expect(page.getByLabel('Language')).toHaveValue('en-US');
    await verificarAccesibilidad(page);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hi, Laura');

    await page.getByLabel('Language').selectOption('es-CO');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola, Laura');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
  });
});
