import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { FormalizacionPagina } from '../../paginas/formalizacion.pagina';

const ID = '3f1c8a52-7d0e-4c1b-9d3a-0e6b1f7a2c44';
const RUTA = `/originacion/cotizaciones/${ID}/formalizar`;

/** Cotización con la forma del contrato de HU-W1.1-01. */
function cotizacion(cambios: Record<string, unknown> = {}) {
  return {
    quote_id: ID,
    customer_id: '9a7e5c10-2b3d-4e8f-a1c2-5d6e7f8a9b0c',
    customer: { document_id: '1032456789', full_name: 'Ana María Pérez', email: 'ana@example.com' },
    insured_amount: 250000000,
    term_months: 180,
    premium: 132800,
    currency: 'COP',
    coverages: [
      { code: 'death', insured_amount: 250000000 },
      { code: 'total_permanent_disability', insured_amount: 250000000 },
    ],
    rating_version: 'v1',
    mode: 'normal',
    source: 'external_sources',
    profile: { score: 0.44, category: 'standard' },
    profile_date: '2026-10-16T14:55:00Z',
    unavailable_source: null,
    notice: null,
    created_at: '2026-10-16T15:00:00Z',
    expires_at: '2026-10-17T15:00:00Z',
    status: 'valid',
    can_formalize: true,
    blocked_reason: null,
    ...cambios,
  };
}

/** Respuestas con la forma de `docs/contratos/HU-W1.1-03-api.md`. */
const CODIGO_ENVIADO = {
  estado: 200,
  cuerpo: { quote_id: ID, sent_to: 'an***@example.com', expires_at: '2026-10-16T15:10:00Z' },
};

const FORMALIZACION = {
  formalization_id: `frm-${ID}`,
  quote_id: ID,
  offer_id: `off-q-${ID}`,
  acceptance_id: 'e2b1c7d4-5a60-4f1e-8b39-0c2d4e6f8a10',
  customer_id: '9a7e5c10-2b3d-4e8f-a1c2-5d6e7f8a9b0c',
  advisor_id: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  advisor_email: 'laura.gomez@solventa.example',
  consent_method: 'recorded_call',
  accepted_at: '2026-10-16T15:00:00Z',
  consent_reference: 'GRAB-2026-88910',
  formalized_at: '2026-10-16T15:03:11Z',
  status: 'registered',
};

const SIN_FORMALIZAR = { estado: 404, cuerpo: { error: 'formalization_not_found', message: 'no' } };

/** Formalización de la compra por el asesor (HU-W1.1-03). Cognito y el API Gateway se simulan con `page.route`. */
test.describe('Formalización de la compra por el asesor (HU-W1.1-03)', () => {
  test('el asesor registra la llamada grabada del cliente y formaliza la compra', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    const llamadas = await formalizacion.simularGateway({
      cotizacion: { estado: 200, cuerpo: cotizacion() },
      consultar: SIN_FORMALIZAR,
      formalizar: { estado: 201, cuerpo: FORMALIZACION },
    });

    await formalizacion.abrirComoAsesor(RUTA);

    await expect(formalizacion.titulo).toHaveText('Formalizar compra');
    await expect(page.getByText('Cotización vigente', { exact: true })).toBeVisible();
    await expect(page.getByText('Ana María Pérez')).toBeVisible();
    await expect(page.getByText('15 años')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qué ocurre al formalizar' })).toBeVisible();
    await verificarAccesibilidad(page);

    await formalizacion.referencia.fill('GRAB-2026-88910');
    await formalizacion.confirmo.check();
    await formalizacion.formalizar.click();

    await expect(formalizacion.titulo).toHaveText('Compra formalizada');
    await expect(page.getByRole('heading', { name: 'Aceptación registrada' })).toBeVisible();
    await expect(page.getByText('GRAB-2026-88910')).toBeVisible();
    await expect(page.getByText(/asesor laura\.gomez@solventa\.example/)).toBeVisible();
    expect(llamadas.formalizadas).toHaveLength(1);
    expect(llamadas.formalizadas[0]).toMatchObject({
      acceptance: { method: 'recorded_call', reference: 'GRAB-2026-88910' },
    });
    await verificarAccesibilidad(page);
  });

  test('con el código de confirmación el cliente lo recibe por correo y el asesor lo digita', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    const llamadas = await formalizacion.simularGateway({
      cotizacion: { estado: 200, cuerpo: cotizacion() },
      consultar: SIN_FORMALIZAR,
      codigo: CODIGO_ENVIADO,
      formalizar: { estado: 201, cuerpo: { ...FORMALIZACION, consent_method: 'confirmation_code', consent_reference: '' } },
    });
    await formalizacion.abrirComoAsesor(RUTA);

    await formalizacion.medio.selectOption('confirmation_code');
    await formalizacion.enviarCodigo.click();
    await expect(page.getByRole('status')).toContainText('an***@example.com');
    expect(llamadas.codigosPedidos).toBe(1);
    await verificarAccesibilidad(page);

    await formalizacion.codigo.fill('482913');
    await formalizacion.confirmo.check();
    await formalizacion.formalizar.click();

    await expect(formalizacion.titulo).toHaveText('Compra formalizada');
    expect(llamadas.formalizadas[0]).toMatchObject({
      acceptance: { method: 'confirmation_code' },
      confirmation_code: '482913',
    });
  });

  test('sin la referencia ni la confirmación no formaliza y señala los campos', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    const llamadas = await formalizacion.simularGateway({
      cotizacion: { estado: 200, cuerpo: cotizacion() },
      consultar: SIN_FORMALIZAR,
    });
    await formalizacion.abrirComoAsesor(RUTA);

    await formalizacion.formalizar.click();

    await expect(page.getByText('Indica la referencia de la grabación o de la firma.')).toBeVisible();
    await expect(page.getByText('Confirma que el cliente aceptó las condiciones y autorizó el cobro.')).toBeVisible();
    expect(llamadas.formalizadas).toHaveLength(0);
    await verificarAccesibilidad(page);
  });

  test('un código incorrecto no formaliza y deja volver a intentarlo', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    await formalizacion.simularGateway({
      cotizacion: { estado: 200, cuerpo: cotizacion() },
      consultar: SIN_FORMALIZAR,
      codigo: CODIGO_ENVIADO,
      formalizar: { estado: 422, cuerpo: { error: 'invalid_confirmation_code', message: 'no' } },
    });
    await formalizacion.abrirComoAsesor(RUTA);
    await formalizacion.medio.selectOption('confirmation_code');
    await formalizacion.enviarCodigo.click();

    await formalizacion.codigo.fill('000000');
    await formalizacion.confirmo.check();
    await formalizacion.formalizar.click();

    await expect(formalizacion.alerta).toContainText('El código no es el que recibió el cliente');
    await expect(formalizacion.formalizar).toBeEnabled();
    await verificarAccesibilidad(page);
  });

  test('si otro asesor formalizó primero lo informa y muestra la compra ya formalizada', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    await formalizacion.simularGateway({
      cotizacion: { estado: 200, cuerpo: cotizacion() },
      consultar: SIN_FORMALIZAR,
      codigo: CODIGO_ENVIADO,
      formalizar: { estado: 409, cuerpo: { error: 'already_formalized', message: 'no' } },
    });
    await formalizacion.abrirComoAsesor(RUTA);
    await formalizacion.referencia.fill('GRAB-2026-88910');
    await formalizacion.confirmo.check();
    // Mientras el asesor registra la aceptación, el otro asesor termina: el POST sigue en 409 y el GET ya trae el registro.
    await page.unroute('**/v1/assisted-quotes/*/formalization');
    await page.route('**/v1/assisted-quotes/*/formalization', (ruta) =>
      ruta.request().method() === 'POST'
        ? ruta.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'already_formalized', message: 'no' }) })
        : ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FORMALIZACION) }),
    );

    await formalizacion.formalizar.click();

    await expect(formalizacion.alerta).toContainText('Otro asesor ya formalizó la compra');
    await expect(formalizacion.titulo).toHaveText('Compra formalizada');
  });

  test('una cotización vencida no se puede formalizar y ofrece generar una nueva', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    await formalizacion.simularGateway({
      cotizacion: { estado: 200, cuerpo: cotizacion({ status: 'expired', can_formalize: false, blocked_reason: 'quote_expired' }) },
      consultar: SIN_FORMALIZAR,
    });

    await formalizacion.abrirComoAsesor(RUTA);

    await expect(page.getByText('La cotización venció')).toBeVisible();
    await expect(formalizacion.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);
    await expect(page.getByRole('link', { name: 'Generar una nueva cotización' })).toHaveAttribute(
      'href',
      '/originacion/cotizaciones/nueva?documento=1032456789',
    );
  });

  test('desde el resultado de una cotización vigente el asesor llega a formalizar', async ({ page }) => {
    await simularCognito(page);
    const formalizacion = new FormalizacionPagina(page);
    await formalizacion.simularGateway({ cotizacion: { estado: 200, cuerpo: cotizacion() }, consultar: SIN_FORMALIZAR });

    await formalizacion.abrirComoAsesor(`/originacion/cotizaciones/${ID}`);
    await page.getByRole('link', { name: 'Formalizar compra' }).click();

    await expect(page).toHaveURL(new RegExp(`/originacion/cotizaciones/${ID}/formalizar$`));
    await expect(formalizacion.titulo).toHaveText('Formalizar compra');
  });
});
