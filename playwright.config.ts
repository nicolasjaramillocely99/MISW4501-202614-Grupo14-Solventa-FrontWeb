import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas extremo a extremo del cliente web (estrategia de pruebas v1.2, OBJ 06 y OBJ 13).
 * Navegador de referencia: Chromium (Chrome). Resolución de referencia del prototipo: 1440 × 900.
 * Con `E2E_BASE_URL` se prueba un ambiente desplegado; sin ella se levanta el servidor local.
 * Con `E2E_MOTO=1` existe además el proyecto `local-moto`: humo del acceso contra el Cognito local (Moto)
 * del backend, que no corre en el CI (ver `e2e/README.md`).
 */
const urlBase = process.env['E2E_BASE_URL'] || 'http://localhost:4200';
const enCI = !!process.env['CI'];
const conMoto = process.env['E2E_MOTO'] === '1';
const navegador = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: enCI,
  retries: enCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: urlBase,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: 'local-moto/**',
      use: navegador,
    },
    ...(conMoto
      ? [{ name: 'local-moto', testMatch: 'local-moto/**/*.spec.ts', use: navegador }]
      : []),
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:4200',
        reuseExistingServer: !enCI,
        timeout: 120_000,
      },
});
