import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { RegistroAuditoriaPagina } from '../../paginas/registro-auditoria.pagina';

const ID = 'off-4f2a9c';

/** Registro con la forma de la respuesta de `audit` (contrato HU-W4.1-01). */
const REGISTRO = {
  offer_id: ID,
  customer_id: 'cliente-0001',
  partner_id: 'aliado-banco-1',
  application_id: '48213',
  consent_id: 'cns-7d1e',
  channel: 'embedded',
  requested_at: '2026-10-20T15:04:05Z',
  rater_version: 'v1',
  sources: [
    { source: 'open_finance', status: 'ok', latency_ms: 85, consulted_at: '2026-10-20T15:04:05.120Z', score: 0.82, category: 'preferred' },
    { source: 'kyc', status: 'timeout', latency_ms: 700, consulted_at: '2026-10-20T15:04:05.120Z', score: null, category: '' },
  ],
  profile: { score: 0.4, category: 'standard', partial: true },
  rules: [
    { order: 1, code: 'base_monthly_rate', value: 0.0011 },
    { order: 2, code: 'age_factor', value: 1.2 },
  ],
  premium: 120000,
  currency: 'COP',
  decision: 'deferred',
  decision_reason: 'base_actuarial_profile',
  recorded_at: '2026-10-20T15:04:06Z',
};

/**
 * Registro de auditoría de las decisiones de suscripción (HU-W4.1-01). Cognito y el API Gateway se simulan con
 * `page.route`; la sesión es la de un analista de operaciones.
 */
test.describe('Registro de auditoría (HU-W4.1-01)', () => {
  test('busca una póliza y muestra su registro completo en solo lectura (CA-1, CA-3, CA-4)', async ({ page }) => {
    await simularCognito(page);
    const auditoria = new RegistroAuditoriaPagina(page);
    const consultados = await auditoria.simularGateway({ [ID]: { estado: 200, cuerpo: REGISTRO } });

    await auditoria.abrirComo('/auditoria/registro');
    await expect(auditoria.titulo).toHaveText('Auditoría de suscripción');
    await verificarAccesibilidad(page);

    await auditoria.identificador.fill(ID);
    await auditoria.buscar.click();

    await expect(page).toHaveURL(`/auditoria/registro/${ID}`);
    await expect(auditoria.titulo).toHaveText(`Registro de auditoría · ${ID}`);
    expect(consultados).toEqual([ID]);
    await expect(page.getByText('Solo lectura', { exact: true })).toBeVisible();
    // Fecha y hora con zona horaria (America/Bogota) y versión del motor.
    await expect(page.getByRole('region', { name: 'Solicitud' }).getByText('20/10/2026, 10:04:05,000 COT')).toBeVisible();
    await expect(page.getByText(/Solicitud de suscripción del 20\/10\/2026, 10:04:05,000 COT \(America\/Bogota, UTC-05:00\) · Motor de rating v1/)).toBeVisible();
    // Fuentes consultadas y reglas en su orden de ejecución.
    await expect(page.getByRole('row', { name: /Open Finance Respondió .* 85 ms Puntaje 0,82 · categoría preferente/ })).toBeVisible();
    const reglas = page.getByRole('table', { name: 'Reglas de rating aplicadas' }).getByRole('row');
    await expect(reglas.nth(1)).toContainText('Tarifa base mensual');
    await expect(reglas.nth(2)).toContainText('Factor por edad');
    // Prima y decisión con motivo.
    await expect(page.getByRole('complementary', { name: 'Resultado' })).toContainText('Se usó el perfil actuarial base');
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('un identificador inexistente muestra «sin resultados» sin datos internos (CA-2)', async ({ page }) => {
    await simularCognito(page);
    const auditoria = new RegistroAuditoriaPagina(page);
    await auditoria.simularGateway({});

    await auditoria.abrirComo('/auditoria/registro');
    await auditoria.identificador.fill('off-inexistente');
    await auditoria.buscar.click();

    await expect(page.getByRole('heading', { name: 'No encontramos resultados para off-inexistente' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Por seguridad no se muestra información interna del sistema.');
    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(auditoria.identificador).toHaveValue('');
    await expect(page).toHaveURL('/auditoria/registro');
    await verificarAccesibilidad(page);
  });

  test('el enlace directo al registro lo consulta y los demás roles no entran', async ({ page }) => {
    await simularCognito(page);
    const auditoria = new RegistroAuditoriaPagina(page);
    await auditoria.simularGateway({ [ID]: { estado: 200, cuerpo: REGISTRO } });

    await auditoria.abrirComo(`/auditoria/registro/${ID}`);
    await expect(auditoria.titulo).toHaveText(`Registro de auditoría · ${ID}`);

    const asesor = await page.context().newPage();
    await simularCognito(asesor);
    await new RegistroAuditoriaPagina(asesor).abrirComo('/auditoria/registro', 'asesor');
    await expect(asesor).toHaveURL(/\/acceso\/no-autorizado/);
  });
});
