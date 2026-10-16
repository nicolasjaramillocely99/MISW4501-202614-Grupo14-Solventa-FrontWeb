import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { CotizacionAsistidaPagina } from '../../paginas/cotizacion-asistida.pagina';

const ID = '3f1c8a52-7d0e-4c1b-9d3a-0e6b1f7a2c44';

/** Cotización con la forma de las respuestas del contrato (HU-W1.1-01, `docs/contratos/HU-W1.1-01-api.md`). */
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

const CLIENTE = {
  customer_id: '9a7e5c10-2b3d-4e8f-a1c2-5d6e7f8a9b0c',
  document_id: '1032456789',
  full_name: 'Ana María Pérez',
  email: 'ana@example.com',
  birth_date: '1990-05-20',
};

const NO_EXISTE = { estado: 404, cuerpo: { error: 'customer_not_found', message: 'no customer has that document' } };

/** Cotización asistida por asesor (HU-W1.1-01). Cognito y el API Gateway se simulan con `page.route`. */
test.describe('Cotización asistida por asesor (HU-W1.1-01)', () => {
  test('el asesor registra al cliente, genera la cotización y ve el resultado', async ({ page }) => {
    await simularCognito(page);
    const cotizacionPage = new CotizacionAsistidaPagina(page);
    const llamadas = await cotizacionPage.simularGateway({
      cliente: NO_EXISTE,
      crear: { estado: 201, cuerpo: cotizacion() },
      consultar: { estado: 200, cuerpo: cotizacion() },
    });

    await cotizacionPage.abrirComoAsesor('/originacion/cotizaciones/nueva');
    await expect(cotizacionPage.titulo).toHaveText('Nueva cotización asistida');
    await verificarAccesibilidad(page);

    await cotizacionPage.llenarDatos();
    await cotizacionPage.consentimiento.check();
    await cotizacionPage.cotizar.click();

    await expect(page).toHaveURL(`/originacion/cotizaciones/${ID}`);
    await expect(cotizacionPage.titulo).toHaveText('Cotización asistida');
    await expect(page.getByText('Cotización generada')).toBeVisible();
    await expect(page.getByText('Prima mensual')).toBeVisible();
    await expect(page.getByText('Fallecimiento del asegurado')).toBeVisible();
    expect(llamadas.creadas).toEqual([
      {
        document_id: '1032456789',
        full_name: 'Ana María Pérez',
        email: 'ana@example.com',
        birth_date: '1990-05-20',
        insured_amount: 250000000,
        term_months: 180,
        consent_active: true,
      },
    ]);
    await verificarAccesibilidad(page);
  });

  test('señala cada campo con su error específico y no cotiza', async ({ page }) => {
    await simularCognito(page);
    const cotizacionPage = new CotizacionAsistidaPagina(page);
    const llamadas = await cotizacionPage.simularGateway({});

    await cotizacionPage.abrirComoAsesor('/originacion/cotizaciones/nueva');
    await cotizacionPage.documento.fill('12');
    await cotizacionPage.correo.fill('no-es-correo');
    await cotizacionPage.cotizar.click();

    await expect(page.getByText(/entre 5 y 20 letras o números/)).toBeVisible();
    await expect(page.getByText(/Escribe un correo válido/)).toBeVisible();
    await expect(page.getByText('Escribe el nombre completo del cliente.')).toBeVisible();
    await expect(page.getByText('Confirma el consentimiento del cliente para poder cotizar.')).toBeVisible();
    await expect(cotizacionPage.documento).toBeFocused();
    expect(llamadas.creadas).toEqual([]);
    await verificarAccesibilidad(page);
  });

  test('muestra el error de campo que devuelve el backend', async ({ page }) => {
    await simularCognito(page);
    const cotizacionPage = new CotizacionAsistidaPagina(page);
    await cotizacionPage.simularGateway({
      crear: {
        estado: 422,
        cuerpo: { error: 'validation_failed', message: 'x', fields: [{ field: 'birth_date', code: 'out_of_range' }] },
      },
    });

    await cotizacionPage.abrirComoAsesor('/originacion/cotizaciones/nueva');
    await cotizacionPage.llenarDatos();
    await cotizacionPage.consentimiento.check();
    await cotizacionPage.cotizar.click();

    await expect(page.getByText(/entre 18 y 70 años/)).toBeVisible();
    await expect(page).toHaveURL(/\/originacion\/cotizaciones\/nueva/);
    await verificarAccesibilidad(page);
  });

  test('recupera al cliente existente por su documento sin volver a digitar sus datos', async ({ page }) => {
    await simularCognito(page);
    const cotizacionPage = new CotizacionAsistidaPagina(page);
    const llamadas = await cotizacionPage.simularGateway({ cliente: { estado: 200, cuerpo: CLIENTE } });

    await cotizacionPage.abrirComoAsesor('/originacion/cotizaciones/nueva');
    await cotizacionPage.documento.fill('1032456789');
    await cotizacionPage.buscar.click();

    await expect(page.getByText(/Cliente encontrado/)).toBeVisible();
    await expect(cotizacionPage.nombre).toHaveValue('Ana María Pérez');
    await expect(cotizacionPage.correo).toHaveValue('ana@example.com');
    await expect(cotizacionPage.nacimiento).toHaveValue('1990-05-20');
    expect(llamadas.clientes).toEqual(['1032456789']);
    await verificarAccesibilidad(page);
  });

  test('con las fuentes caídas muestra la cotización en modo degradado', async ({ page }) => {
    await simularCognito(page);
    const cotizacionPage = new CotizacionAsistidaPagina(page);
    const degradada = cotizacion({
      mode: 'provisional',
      source: 'base_actuarial',
      profile_date: null,
      unavailable_source: 'open_finance',
      notice: 'personalization_unavailable',
    });
    await cotizacionPage.simularGateway({ consultar: { estado: 200, cuerpo: degradada } });

    await cotizacionPage.abrirComoAsesor(`/originacion/cotizaciones/${ID}`);

    await expect(page.getByText('Cotización en modo degradado')).toBeVisible();
    await expect(page.getByText(/El precio no está personalizado/)).toBeVisible();
    await expect(page.getByText('Provisional')).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('una cotización vencida no se puede formalizar y ofrece generar una nueva', async ({ page }) => {
    await simularCognito(page);
    const cotizacionPage = new CotizacionAsistidaPagina(page);
    const llamadas = await cotizacionPage.simularGateway({
      consultar: { estado: 200, cuerpo: cotizacion({ status: 'expired', can_formalize: false, blocked_reason: 'quote_expired' }) },
      cliente: { estado: 200, cuerpo: CLIENTE },
    });

    await cotizacionPage.abrirComoAsesor(`/originacion/cotizaciones/${ID}`);

    await expect(page.getByText('La cotización venció')).toBeVisible();
    await expect(page.getByText('Vencida')).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Generar una nueva cotización' }).click();
    await expect(page).toHaveURL(/\/originacion\/cotizaciones\/nueva\?documento=1032456789/);
    await expect(cotizacionPage.nombre).toHaveValue('Ana María Pérez');
    expect(llamadas.clientes).toEqual(['1032456789']);
  });
});
