import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { RenovacionLineaPagina } from '../../paginas/renovacion-linea.pagina';

const POLIZA = 'pol-acc-118204';
const ID_RENOVACION = `ren-${POLIZA}-20261002`;
const NUEVA_POLIZA = `pol-${ID_RENOVACION}`;
const RUTA = `/originacion/polizas/${POLIZA}/renovar`;

const POLIZA_DTO = {
  policy_id: POLIZA,
  holder_name: 'Carolina Pérez',
  premium: 142300,
  currency: 'COP',
  insured_amount: 68000000,
  coverages: [
    { code: 'death', insured_amount: 68000000 },
    { code: 'total_permanent_disability', insured_amount: 68000000 },
  ],
  coverage_start: '2025-10-02T23:59:00Z',
  coverage_end: '2026-10-02T23:59:00Z',
  renewal_of: null,
};

const TARJETA = {
  method: 'card',
  brand: 'visa',
  last4: '1111',
  installments: 1,
  bank_code: null,
  captured_at: '2025-10-02T23:58:00Z',
};

/** Respuestas con la forma de `docs/contratos/HU-W1.5-02-api.md`. */
const CONDICIONES = {
  estado: 200,
  cuerpo: {
    policy: POLIZA_DTO,
    current: {
      premium: 142300,
      currency: 'COP',
      insured_amount: 68000000,
      coverages: POLIZA_DTO.coverages,
      coverage_start: '2025-10-02T23:59:00Z',
      coverage_end: '2026-10-02T23:59:00Z',
    },
    renewal: {
      premium: 149800,
      currency: 'COP',
      insured_amount: 72500000,
      coverages: [
        { code: 'death', insured_amount: 72500000 },
        { code: 'total_permanent_disability', insured_amount: 72500000 },
      ],
      coverage_start: '2026-10-02T23:59:00Z',
      coverage_end: '2027-10-02T23:59:00Z',
    },
    renewal_window: { opens_at: '2026-09-02T23:59:00Z', closes_at: '2026-10-02T23:59:00Z' },
    requoted: true,
    discount_rate: 0.08,
    payment_method: TARJETA,
  },
};

const SIN_RENOVACION = { estado: 404, cuerpo: { error: 'renewal_not_found', message: 'no' } };

function cobro(cambios: Record<string, unknown> = {}) {
  return {
    acceptance_id: ID_RENOVACION,
    offer_id: ID_RENOVACION,
    customer_id: 'sub-1',
    accepted_at: '2026-09-19T15:00:00Z',
    status: 'pending',
    idempotency_key: `cobro-${ID_RENOVACION}`,
    amount: 149800,
    currency: 'COP',
    attempts: 0,
    last_attempt_at: null,
    last_failure_at: null,
    next_attempt_at: '2026-09-19T15:00:00Z',
    retry_window: { started_at: '2026-09-19T15:00:00Z', ends_at: '2026-09-22T15:00:00Z' },
    failure_reason: null,
    confirmed_at: null,
    policy_id: null,
    coverage_activated_at: null,
    activation_published_at: null,
    resume_count: 0,
    payment_method: TARJETA,
    payment_attempt: 1,
    updated_at: '2026-09-19T15:00:00Z',
    ...cambios,
  };
}

function renovacion(
  estado: string,
  cambios: Record<string, unknown> = {},
  cobroCambios: Record<string, unknown> = {},
) {
  return {
    renewal: {
      renewal_id: ID_RENOVACION,
      status: estado,
      reason: null,
      new_policy_id: null,
      charge_id: ID_RENOVACION,
      accepted_at: '2026-09-19T15:00:00Z',
      retry_until: '2026-09-22T15:00:00Z',
      closed_at: null,
      ...cambios,
    },
    terms: CONDICIONES.cuerpo.renewal,
    discount_rate: 0.08,
    charge: cobro(cobroCambios),
  };
}

const ACEPTADA = { estado: 200, cuerpo: renovacion('accepted') };
const RENOVADA = {
  estado: 200,
  cuerpo: renovacion(
    'renewed',
    { new_policy_id: NUEVA_POLIZA, closed_at: '2026-09-19T15:00:04Z' },
    { status: 'confirmed', confirmed_at: '2026-09-19T15:00:04Z', policy_id: NUEVA_POLIZA },
  ),
};

/** Renovación en línea del asegurado (HU-W1.5-02). Cognito y el API Gateway se simulan con `page.route`. */
test.describe('Renovación en línea por el asegurado (HU-W1.5-02)', () => {
  test('desde Mis pólizas el asegurado ve las condiciones recotizadas, renueva y ve la renovación confirmada', async ({
    page,
  }) => {
    await simularCognito(page);
    const renovacion = new RenovacionLineaPagina(page);
    const llamadas = await renovacion.simularGateway({
      polizas: {
        estado: 200,
        cuerpo: {
          items: [
            {
              ...POLIZA_DTO,
              renewal_window: {
                opens_at: '2026-09-02T23:59:00Z',
                closes_at: '2026-10-02T23:59:00Z',
              },
              can_renew: true,
              renewal: null,
            },
          ],
        },
      },
      condiciones: CONDICIONES,
      renovar: { estado: 201, cuerpo: ACEPTADA.cuerpo },
      estado: [SIN_RENOVACION, ACEPTADA, RENOVADA],
    });

    await renovacion.abrirComoAsegurado('/originacion/polizas');
    await expect(renovacion.titulo).toHaveText('Mis pólizas');
    await expect(page.locator('app-insignia-estado', { hasText: 'Por vencer' })).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Renovar' }).click();
    await expect(renovacion.titulo).toHaveText('Renovar póliza');
    await expect(page.getByText('Condiciones recotizadas')).toBeVisible();
    await expect(page.getByRole('table')).toContainText('149.800');
    await expect(page.getByRole('table')).toContainText('8 % aplicado');
    await expect(page.getByText('Visa •••• 1111')).toBeVisible();
    await verificarAccesibilidad(page);

    await renovacion.renovar.click();
    await expect(renovacion.alerta).toContainText('debes aceptar las condiciones renovadas');
    expect(llamadas.aceptadas).toBe(0);

    await renovacion.acepto.check();
    await renovacion.renovar.click();

    await expect(
      page.getByRole('heading', { name: 'Renovación confirmada', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Activa · renovada')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Descargar certificado renovado' }),
    ).toHaveAttribute('href', `/embebido/poliza-emitida/${NUEVA_POLIZA}`);
    expect(llamadas.aceptadas).toBe(1);
    await verificarAccesibilidad(page);
  });

  test('fuera de la ventana de renovación la opción de renovar no está disponible', async ({
    page,
  }) => {
    await simularCognito(page);
    const renovacion = new RenovacionLineaPagina(page);
    const llamadas = await renovacion.simularGateway({
      condiciones: { estado: 409, cuerpo: { error: 'renewal_not_available', message: 'no' } },
      estado: SIN_RENOVACION,
    });

    await renovacion.abrirComoAsegurado(RUTA);

    await expect(page.getByText('La renovación no está disponible')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renovar y pagar' })).toBeDisabled();
    expect(llamadas.aceptadas).toBe(0);
    await verificarAccesibilidad(page);
  });

  test('con el pago rechazado la solicitud se conserva y se puede probar con otro medio', async ({
    page,
  }) => {
    await simularCognito(page);
    const renovacion = new RenovacionLineaPagina(page);
    await renovacion.simularGateway({
      estado: {
        estado: 200,
        cuerpo: renovacionRechazada(),
      },
    });

    await renovacion.abrirComoAsegurado(RUTA);

    await expect(page.getByText('Tu pago fue rechazado')).toBeVisible();
    await expect(page.getByText(/Tu solicitud de renovación sigue guardada/)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Prueba con otro medio de pago' }),
    ).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('una póliza que no se renovó a tiempo lo dice', async ({ page }) => {
    await simularCognito(page);
    const renovacion = new RenovacionLineaPagina(page);
    await renovacion.simularGateway({
      estado: {
        estado: 200,
        cuerpo: {
          ...renovacionRechazada(),
          renewal: {
            ...renovacionRechazada().renewal,
            status: 'not_renewed',
            reason: 'no_response',
          },
        },
      },
    });

    await renovacion.abrirComoAsegurado(RUTA);

    await expect(page.getByText('Tu póliza no se renovó')).toBeVisible();
    await expect(page.getByText(/No recibimos tu respuesta/)).toBeVisible();
    await verificarAccesibilidad(page);
  });
});

function renovacionRechazada() {
  return renovacion(
    'accepted',
    {},
    { status: 'failed', attempts: 1, next_attempt_at: null, failure_reason: 'payment_rejected' },
  );
}
