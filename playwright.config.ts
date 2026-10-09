import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas extremo a extremo del cliente web (estrategia de pruebas v1.2, OBJ 06 y OBJ 13).
 * Navegador de referencia: Chromium (Chrome). Resolución de referencia del prototipo: 1440 × 900.
 * Con `E2E_BASE_URL` se prueba un ambiente desplegado; sin ella se levanta el servidor local.
 */
const urlBase = process.env['E2E_BASE_URL'] || 'http://localhost:4200';
const enCI = !!process.env['CI'];

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
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
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
