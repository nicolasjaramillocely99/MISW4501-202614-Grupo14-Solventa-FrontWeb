import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { PerfilRiesgoPagina } from '../../paginas/perfil-riesgo.pagina';

const PERFIL = {
  customer_id: 'cli-1',
  mode: 'normal',
  source: 'external_sources',
  profile: { score: 700, category: 'B' },
  profile_date: '2026-10-11T12:00:00Z',
  unavailable_source: null,
  notice: null,
  partial: false,
  sources: [
    { name: 'open_finance', status: 'ok', latency_ms: 180 },
    { name: 'open_data', status: 'ok', latency_ms: 95 },
    { name: 'kyc', status: 'ok', latency_ms: 60 },
  ],
};

/** Paso 2 del canal embebido: cálculo del perfil de riesgo (HU-W1.2-02). El API Gateway se simula con `page.route`. */
test.describe('Cálculo del perfil de riesgo (HU-W1.2-02)', () => {
  test('muestra el cálculo en curso y luego la oferta lista, con accesibilidad en ambos estados', async ({ page }) => {
    const perfil = new PerfilRiesgoPagina(page);
    let terminar!: () => void;
    const respuesta = new Promise<void>((resolver) => (terminar = resolver));
    const { cuerpos } = await perfil.simularGateway({ estado: 200, cuerpo: PERFIL }, respuesta);

    await perfil.abrir();
    await expect(perfil.titulo).toHaveText('Estamos calculando tu perfil de riesgo');
    await expect(page.getByRole('button', { name: 'Calculando…' })).toBeDisabled();
    await verificarAccesibilidad(page);

    terminar();
    await expect(perfil.titulo).toHaveText('Tu oferta está lista');
    await expect(page.getByText('Consultado · 180 ms')).toBeVisible();
    await expect(perfil.verOferta).toBeVisible();
    expect(cuerpos).toEqual([{ customer_id: 'cli-1', consent_active: true }]);
    await verificarAccesibilidad(page);
  });

  test('continúa con el último perfil e identifica la fuente que no respondió', async ({ page }) => {
    const perfil = new PerfilRiesgoPagina(page);
    await perfil.simularGateway({
      estado: 200,
      cuerpo: {
        ...PERFIL,
        mode: 'provisional',
        source: 'cache',
        unavailable_source: 'open_finance',
        notice: 'last_profile_in_use',
        sources: [{ name: 'open_finance', status: 'timeout', latency_ms: 120 }],
      },
    });

    await perfil.abrir();

    await expect(page.getByText('Continuamos con tu último perfil')).toBeVisible();
    await expect(page.getByText('No respondió a tiempo · 120 ms')).toBeVisible();
    await expect(perfil.verOferta).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('advierte del perfil base para un cliente nuevo', async ({ page }) => {
    const perfil = new PerfilRiesgoPagina(page);
    await perfil.simularGateway({
      estado: 200,
      cuerpo: {
        ...PERFIL,
        mode: 'provisional',
        source: 'base_actuarial',
        profile_date: null,
        unavailable_source: 'open_finance',
        notice: 'personalization_unavailable',
        sources: [],
      },
    });

    await perfil.abrir();

    await expect(page.getByText('Usamos el perfil base')).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('sin consentimiento pide volver al consentimiento', async ({ page }) => {
    const perfil = new PerfilRiesgoPagina(page);
    await perfil.simularGateway({
      estado: 422,
      cuerpo: { error: 'consent_required', message: 'sin consentimiento' },
    });

    await perfil.abrir(false);

    await expect(perfil.alerta).toContainText('Necesitamos tu consentimiento');
    await expect(page.getByRole('link', { name: 'Volver al consentimiento' })).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('ante una falla del servicio permite reintentar', async ({ page }) => {
    const perfil = new PerfilRiesgoPagina(page);
    await perfil.simularGateway({ estado: 503, cuerpo: { error: 'request_aborted', message: 'abortada' } });
    await perfil.abrir();
    await expect(perfil.alerta).toContainText('No pudimos calcular tu perfil');
    await verificarAccesibilidad(page);

    await page.unroute('**/v1/risk-profiles/resolve');
    await perfil.simularGateway({ estado: 200, cuerpo: PERFIL });
    await perfil.reintentar.click();

    await expect(perfil.titulo).toHaveText('Tu oferta está lista');
  });
});
