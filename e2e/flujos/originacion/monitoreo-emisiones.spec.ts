import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { MonitoreoEmisionesPagina } from '../../paginas/monitoreo-emisiones.pagina';

/** Emisiones con la forma de `GET /v1/issuances` (contrato HU-W1.3-04). */
const base = {
  customer_id: 'cliente-0001',
  customer_name: 'Ana María Torres',
  channel: 'web',
  accepted_at: '2026-10-20T15:04:05Z',
  updated_at: '2026-10-20T15:04:05Z',
  amount: 89500,
  currency: 'COP',
  attempts: 0,
  policy_id: null,
  reason: null,
  failed_at: null,
  notified_at: null,
  unattended: false,
  resume_count: 0,
  last_resumed_at: null,
  last_resumed_by: null,
};
const EXCEPCION = {
  ...base,
  acceptance_id: 'acc-0004',
  offer_id: 'off-0004',
  customer_name: 'Luis Fernando Castro',
  status: 'exception',
  step: 'premium_charge',
  attempts: 9,
  reason: 'retry_window_expired',
  failed_at: '2026-10-20T15:30:00Z',
  unattended: true,
};
const DOCUMENTO = {
  ...EXCEPCION,
  acceptance_id: 'acc-0005',
  offer_id: 'off-0005',
  customer_name: 'Pedro Gómez Lara',
  step: 'contract_document',
  reason: 'document_generation_failed',
  policy_id: 'pol-acc-0005',
  unattended: false,
};
const NOTIFICADA = {
  ...base,
  acceptance_id: 'acc-0003',
  offer_id: 'off-0003',
  customer_name: 'Marta Ruiz Ospina',
  status: 'notified',
  step: 'completed',
  policy_id: 'pol-acc-0003',
  notified_at: '2026-10-20T15:05:00Z',
};
const EN_COBRO = { ...base, acceptance_id: 'acc-0002', offer_id: 'off-0002', status: 'charging', step: 'premium_charge', attempts: 3 };
const ACEPTADA = {
  ...base,
  acceptance_id: 'acc-0001',
  offer_id: 'off-0001',
  customer_name: null,
  channel: 'mobile',
  status: 'accepted',
  step: 'underwriting',
  amount: null,
  currency: null,
};

const GUION = {
  emisiones: { '': [EXCEPCION, DOCUMENTO, NOTIFICADA, EN_COBRO, ACEPTADA], exception: [EXCEPCION, DOCUMENTO], active: [] },
  conteos: { accepted: 18, charging: 6, charging_with_retries: 2, active_today: 42, notified_today: 40, exceptions: 3, unattended: 1 },
  acciones: [{ id: 1, action: 'resume', actor: 'ops-1', note: 'Pasarela restablecida', created_at: '2026-10-20T16:00:00Z' }],
};

/**
 * Monitoreo de emisiones y excepciones (HU-W1.3-04). Cognito y el API Gateway se simulan con `page.route`; la sesión
 * es la de un analista de operaciones.
 */
test.describe('Monitoreo de emisiones (HU-W1.3-04)', () => {
  test('ve las tarjetas y las emisiones con su estado y último paso, y filtra (CA-1, CA-2, CA-4, CA-5)', async ({ page }) => {
    await simularCognito(page);
    const monitoreo = new MonitoreoEmisionesPagina(page);
    const trafico = await monitoreo.simularGateway(GUION);

    await monitoreo.abrirComo('/originacion/emisiones');

    await expect(monitoreo.titulo).toHaveText('Monitoreo de emisiones');
    const tarjetas = page.getByRole('list', { name: 'Resumen de las emisiones' });
    await expect(tarjetas).toContainText('Aceptadas');
    await expect(tarjetas).toContainText('42');
    await expect(tarjetas).toContainText('Requieren intervención · 1 sin atender');
    await expect(page.getByRole('row')).toHaveCount(6); // encabezado + 5 emisiones
    await expect(page.getByRole('row', { name: /Luis Fernando Castro.*En excepción.*Dependencia caída · pasarela de pagos/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Pedro Gómez Lara.*Dependencia caída · generador de documentos/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Marta Ruiz Ospina.*Notificada.*Documento generado y notificado/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Móvil.*Aceptada.*Suscripción automática en curso/ })).toBeVisible();
    await expect(page.getByText('Sin atender', { exact: true })).toBeVisible();
    // Las excepciones se gestionan; las demás solo se ven.
    await expect(page.getByRole('button', { name: /^Gestionar la excepción/ })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Ver la emisión/ })).toHaveCount(3);
    await verificarAccesibilidad(page);

    await monitoreo.estado.selectOption('exception');
    await expect(page.getByRole('row')).toHaveCount(3);
    expect(trafico.consultas.at(-1)?.get('status')).toBe('exception');
    expect(trafico.consultas.at(-1)?.has('day_from')).toBe(true);

    await monitoreo.estado.selectOption('active');
    await expect(page.getByText('No hay emisiones con estos filtros.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await monitoreo.canal.selectOption('mobile');
    await expect.poll(() => trafico.consultas.at(-1)?.get('channel')).toBe('mobile');
    await monitoreo.desde.fill('2026-10-19');
    await monitoreo.hasta.fill('2026-10-20');
    await expect.poll(() => trafico.consultas.at(-1)?.has('from') && trafico.consultas.at(-1)?.has('to')).toBe(true);
  });

  test('gestiona la excepción: la reintenta con una nota, que queda registrada (CA-3, CA-7)', async ({ page }) => {
    await simularCognito(page);
    const monitoreo = new MonitoreoEmisionesPagina(page);
    const trafico = await monitoreo.simularGateway(GUION);
    await monitoreo.abrirComo('/originacion/emisiones');

    await page.getByRole('button', { name: 'Gestionar la excepción de la emisión acc-0004' }).click();

    await expect(monitoreo.dialogo).toBeVisible();
    await expect(monitoreo.dialogo.getByRole('heading', { name: 'Excepción de emisión' })).toBeVisible();
    await expect(monitoreo.dialogo.getByText('Pasarela restablecida')).toBeVisible(); // historial: nota de ops-1
    await expect(monitoreo.dialogo.getByText('Por ops-1')).toBeVisible();
    await verificarAccesibilidad(page);

    // Sin nota no se reintenta.
    await monitoreo.dialogo.getByRole('button', { name: 'Reintentar' }).click();
    await expect(monitoreo.dialogo.getByText('Escribe una nota para reintentar.')).toBeVisible();
    expect(trafico.reintentos).toEqual([]);

    await monitoreo.dialogo.getByLabel('Nota del reintento').fill('La pasarela volvió a responder');
    await monitoreo.dialogo.getByRole('button', { name: 'Reintentar' }).click();

    await expect(monitoreo.dialogo).toBeHidden();
    expect(trafico.reintentos).toEqual([{ aceptacion: 'acc-0004', nota: 'La pasarela volvió a responder' }]);
    await expect(page.getByText('Reintento registrado')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(4); // las excepciones ya no están
  });

  test('una emisión sin excepción se abre en solo lectura (CA-5)', async ({ page }) => {
    await simularCognito(page);
    const monitoreo = new MonitoreoEmisionesPagina(page);
    await monitoreo.simularGateway(GUION);
    await monitoreo.abrirComo('/originacion/emisiones');

    await page.getByRole('button', { name: 'Ver la emisión acc-0003' }).click();

    await expect(monitoreo.dialogo.getByRole('heading', { name: 'Detalle de la emisión' })).toBeVisible();
    await expect(monitoreo.dialogo.getByText('pol-acc-0003')).toBeVisible();
    await expect(monitoreo.dialogo.getByLabel('Nota del reintento')).toHaveCount(0);
    await expect(monitoreo.dialogo.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('el diálogo se cierra con Escape y devuelve el foco a su botón', async ({ page }) => {
    await simularCognito(page);
    const monitoreo = new MonitoreoEmisionesPagina(page);
    await monitoreo.simularGateway(GUION);
    await monitoreo.abrirComo('/originacion/emisiones');
    const boton = page.getByRole('button', { name: 'Gestionar la excepción de la emisión acc-0004' });

    await boton.click();
    await expect(monitoreo.dialogo).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(monitoreo.dialogo).toBeHidden();
    await expect(boton).toBeFocused();
  });

  test('un asesor no entra al monitoreo', async ({ page }) => {
    await simularCognito(page);
    const monitoreo = new MonitoreoEmisionesPagina(page);
    await monitoreo.simularGateway(GUION);

    await monitoreo.abrirComo('/originacion/emisiones', 'asesor');

    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);
  });
});
