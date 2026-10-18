import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { PERFIL_RIESGO, RECIBO_CONSENTIMIENTO } from '../../fixtures/contexto-aliado';
import {
  ofertaConCache,
  ofertaNormal,
  ofertaPerfilBase,
  ofertaReemplazada,
  ofertaVencida,
} from '../../fixtures/ofertas';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { ConsentimientoPagina } from '../../paginas/consentimiento.pagina';
import { OfertaPersonalizadaPagina } from '../../paginas/oferta-personalizada.pagina';

const OFERTA = 'off-b948aa0f4d51e923a67c7cee087e94ed';
const NUEVA = 'off-7618b94e3329fa1b05c7d6b5f4ab2297';

/**
 * Paso 3 del canal embebido: la oferta personalizada (HU-W1.2-03). Cognito y el API Gateway se simulan con
 * `page.route`. CA-1: E3 con prima, coberturas, condiciones y vigencia. CA-3: E3b y E3c. CA-4: aviso de reemplazo
 * al cargar y al aceptar. CA-5: E7 y nueva oferta. (CA-2, la persistencia y la auditoría, se prueba solo en el
 * backend.)
 */
test.describe('Oferta personalizada (HU-W1.2-03)', () => {
  test('del consentimiento al perfil y a «Ver mi oferta» llega a la oferta personalizada con sesión (CA-1)', async ({ page }) => {
    await simularCognito(page);
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      generar: { estado: 201, cuerpo: ofertaNormal(OFERTA) },
      ofertas: { [OFERTA]: { estado: 200, cuerpo: ofertaNormal(OFERTA) } },
    });

    await consentimiento.abrir();
    await consentimiento.marcarAmbas();
    await consentimiento.autorizar.click();
    await expect(consentimiento.titulo).toHaveText('Tu oferta está lista');
    await page.getByRole('button', { name: 'Ver mi oferta' }).click();

    expect(oferta.generadas).toEqual([
      {
        customer_id: 'cliente-0001',
        consent_id: RECIBO_CONSENTIMIENTO.consent_id,
        partner_id: 'aliado-banco-1',
        application_id: '48213',
        document_id: '1020304050',
        full_name: 'Ana María Pérez',
        email: 'ana.perez@example.com',
        birth_date: '1988-04-12',
        insured_amount: 250000000,
        term_months: 240,
      },
    ]);
    await oferta.iniciarSesion();

    await expect(page).toHaveURL(`/embebido/oferta/${OFERTA}`);
    await expect(oferta.titulo).toHaveText('Tu oferta personalizada');
    await expect(page.getByText(`Oferta N.º ${OFERTA} · Vigente hasta`)).toBeVisible();
    await expect(page.getByText(/132\.000\s*COP/).first()).toBeVisible();
    await expect(page.getByText('20 años · igual al plazo del crédito')).toBeVisible();
    await expect(page.getByText('Banco Aliado (saldo insoluto) · remanente a tus herederos')).toBeVisible();
    await expect(page.getByText('Fallecimiento por cualquier causa')).toBeVisible();
    await expect(page.getByText('Incapacidad total y permanente')).toBeVisible();
    await expect(page.getByText('La oferta está vigente por 24 horas desde que se genera.')).toBeVisible();
    await expect(page.getByText('La edad máxima asegurable es de 70 años.')).toBeVisible();
    await expect(oferta.aceptar).toBeVisible();
    expect(oferta.consultadas).toContain(OFERTA);
    await verificarAccesibilidad(page);
  });

  test('si falta el consentimiento al generar la oferta vuelve al paso 1 (consent_required)', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway({ perfil: { estado: 200, cuerpo: PERFIL_RIESGO } });
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      generar: { estado: 422, cuerpo: { error: 'consent_required', message: 'an active consent is required' } },
    });
    await consentimiento.abrir();
    await consentimiento.marcarAmbas();
    await consentimiento.autorizar.click();
    await expect(consentimiento.titulo).toHaveText('Tu oferta está lista');

    await page.getByRole('button', { name: 'Ver mi oferta' }).click();

    await expect(page).toHaveURL(/\/embebido\/consentimiento/);
    expect(oferta.generadas).toHaveLength(1);
  });

  test('si el servicio no responde al generar la oferta avisa y permite reintentar', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      generar: { estado: 503, cuerpo: { error: 'consent_unverifiable', message: 'retry later' } },
    });
    await consentimiento.abrir();
    await consentimiento.marcarAmbas();
    await consentimiento.autorizar.click();
    await expect(consentimiento.titulo).toHaveText('Tu oferta está lista');

    await page.getByRole('button', { name: 'Ver mi oferta' }).click();

    await expect(page.getByRole('alert')).toContainText('No pudimos generar tu oferta');
    await expect(page.getByRole('button', { name: 'Ver mi oferta' })).toBeEnabled();
    await verificarAccesibilidad(page);
  });

  test('E3b: con el último perfil en caché marca el modo degradado, la fecha del perfil y la recotización (CA-3)', async ({ page }) => {
    await simularCognito(page);
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({ ofertas: { [OFERTA]: { estado: 200, cuerpo: ofertaConCache(OFERTA) } } });

    await oferta.abrirConSesion(OFERTA);

    await expect(oferta.titulo).toHaveText('Tu oferta (provisional)');
    await expect(page.getByText('Calculamos tu oferta con tu último perfil')).toBeVisible();
    await expect(page.getByText(/usamos tu último perfil, del 04\/10\/2026/)).toBeVisible();
    await expect(page.getByText('Prima mensual estimada')).toBeVisible();
    await expect(page.getByText(/En caché · 04\/10\/2026/)).toBeVisible();
    await expect(page.getByText('Fuente no disponible')).toBeVisible();
    await expect(page.getByText('Si la información vuelve a estar disponible, recalcularemos tu oferta y te avisaremos.', { exact: true }).last()).toBeVisible();
    await expect(oferta.aceptar).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('E3c: con el perfil base lo dice y no inventa una fecha de perfil (CA-3)', async ({ page }) => {
    await simularCognito(page);
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({ ofertas: { [OFERTA]: { estado: 200, cuerpo: ofertaPerfilBase(OFERTA) } } });

    await oferta.abrirConSesion(OFERTA);

    await expect(oferta.titulo).toHaveText('Tu oferta (provisional)');
    await expect(page.getByText('Calculamos tu oferta con un perfil general')).toBeVisible();
    await expect(page.getByText('Base actuarial · cliente sin perfil previo')).toBeVisible();
    await expect(page.getByText(/Con perfil base · sujeta a recotización/)).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('E7: una oferta vencida ofrece generar una nueva y abre la renovada (CA-5)', async ({ page }) => {
    await simularCognito(page);
    const vencida = 'off-seedr1792338656';
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      ofertas: {
        [vencida]: { estado: 200, cuerpo: ofertaVencida(vencida) },
        [NUEVA]: { estado: 200, cuerpo: ofertaNormal(NUEVA, { premium: 135400 }) },
      },
      renovar: { estado: 201, cuerpo: ofertaNormal(NUEVA, { premium: 135400 }) },
    });

    await oferta.abrirConSesion(vencida);

    await expect(oferta.titulo).toHaveText('Esta oferta venció');
    await expect(page.getByText(/La oferta off-seedr1792338656 venció el 17\/10\/2026/)).toBeVisible();
    await expect(oferta.aceptar).toHaveCount(0);
    await verificarAccesibilidad(page);

    await oferta.generarNueva.click();

    expect(oferta.renovadas).toEqual([vencida]);
    await expect(page).toHaveURL(`/embebido/oferta/${NUEVA}`);
    await expect(oferta.titulo).toHaveText('Tu oferta personalizada');
    await expect(page.getByText(/135\.400\s*COP/).first()).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('E7: si el titular ya no es asegurable avisa que no puede renovar', async ({ page }) => {
    await simularCognito(page);
    const vencida = 'off-seedr1792338656';
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      ofertas: { [vencida]: { estado: 200, cuerpo: ofertaVencida(vencida) } },
      renovar: {
        estado: 422,
        cuerpo: { error: 'validation_failed', message: 'x', fields: [{ field: 'birth_date', code: 'out_of_range' }] },
      },
    });
    await oferta.abrirConSesion(vencida);

    await oferta.generarNueva.click();

    await expect(page.getByText('Ya no puedes renovar esta oferta')).toBeVisible();
    await expect(oferta.generarNueva).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('al reingresar con una oferta reemplazada avisa que se actualizó y abre la nueva (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const anterior = 'off-a25586ff7b84d2bf27e1e34e7dc0aab4';
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      ofertas: {
        [anterior]: { estado: 200, cuerpo: ofertaReemplazada(anterior, NUEVA) },
        [NUEVA]: { estado: 200, cuerpo: ofertaNormal(NUEVA, { premium: 135400 }) },
      },
    });

    await oferta.abrirConSesion(anterior);

    await expect(oferta.titulo).toHaveText('Tu oferta se actualizó con tu perfil real');
    await expect(page.getByText(/135\.400\s*COP · antes .*147\.400\s*COP/)).toBeVisible();
    await expect(oferta.aceptar).toHaveCount(0);
    await verificarAccesibilidad(page);

    await oferta.verActualizada.click();

    await expect(page).toHaveURL(`/embebido/oferta/${NUEVA}`);
    await expect(oferta.titulo).toHaveText('Tu oferta personalizada');
  });

  test('al aceptar una oferta que mientras tanto fue reemplazada (422 offer_expired) muestra el aviso (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const anterior = 'off-a25586ff7b84d2bf27e1e34e7dc0aab4';
    let leida = 0;
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({
      ofertas: {
        // La primera lectura la encuentra vigente; al aceptar, la recotización ya la reemplazó.
        [anterior]: () =>
          ++leida === 1
            ? { estado: 200, cuerpo: ofertaConCache(anterior) }
            : { estado: 200, cuerpo: ofertaReemplazada(anterior, NUEVA) },
        [NUEVA]: { estado: 200, cuerpo: ofertaNormal(NUEVA, { premium: 135400 }) },
      },
      aceptar: {
        estado: 422,
        cuerpo: { error: 'offer_expired', message: 'x', offer_id: anterior, expires_at: '2026-10-18T15:53:02.442028Z' },
      },
    });
    await oferta.abrirConSesion(anterior);
    await expect(oferta.titulo).toHaveText('Tu oferta (provisional)');

    await oferta.terminos.check();
    await oferta.aceptar.click();

    await expect(oferta.titulo).toHaveText('Tu oferta se actualizó con tu perfil real');
    expect(oferta.aceptadas).toEqual([{ channel: 'web' }]);
    await expect(oferta.verActualizada).toHaveAttribute('href', `/embebido/oferta/${NUEVA}`);
    await verificarAccesibilidad(page);
  });

  test('una oferta que no existe avisa y ofrece volver a cotizar', async ({ page }) => {
    await simularCognito(page);
    const oferta = new OfertaPersonalizadaPagina(page);
    await oferta.simularGateway({});

    await oferta.abrirConSesion('off-inexistente');

    await expect(oferta.titulo).toHaveText('Esta oferta no existe o ya no está disponible');
    await expect(page.getByRole('link', { name: 'Volver a cotizar' })).toBeVisible();
    await verificarAccesibilidad(page);
  });
});
