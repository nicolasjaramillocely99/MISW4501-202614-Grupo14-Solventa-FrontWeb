import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { CONTEXTO_ALIADO } from '../../fixtures/contexto-aliado';
import { ConsentimientoPagina } from '../../paginas/consentimiento.pagina';

/**
 * Paso 1 del canal embebido: consentimiento explícito (HU-W1.2-01). El API Gateway se simula con `page.route`.
 * CA-1: fuentes, datos y finalidad visibles, botón solo con ambas casillas. CA-2: el `POST` lleva titular,
 * alcance y canal. CA-3: «Ahora no» no hace ninguna petición de consentimiento ni de perfil. (CA-4, el
 * registro inmutable, se prueba solo en el backend.)
 */
test.describe('Consentimiento explícito (HU-W1.2-01)', () => {
  test('muestra fuentes, datos, vigencia y finalidad; el botón solo se habilita con ambas casillas (CA-1)', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();

    await consentimiento.abrir();

    await expect(consentimiento.titulo).toHaveText('Autoriza la consulta de tus datos');
    await expect(page.getByText('Productos de crédito, saldos y comportamiento de pago en tus entidades financieras.')).toBeVisible();
    await expect(page.getByText('Registros públicos: RUNT, Registraduría y listas de control.')).toBeVisible();
    await expect(page.getByText('Verificación de identidad ya realizada por el banco aliado.')).toBeVisible();
    await expect(page.getByText('Única vez')).toBeVisible();
    await expect(page.getByText('Cálculo del perfil de riesgo individualizado y de la oferta de seguro de vida hipotecario')).toBeVisible();
    await expect(page.getByText(/Solventa S\.A\. ·/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tu crédito' })).toBeVisible();
    await expect(page.getByText('$ 250.000.000')).toBeVisible();
    await expect(consentimiento.autorizar).toBeDisabled();

    await consentimiento.casillaFuentes.check();
    await expect(consentimiento.autorizar).toBeDisabled();
    await consentimiento.casillaPolitica.check();
    await expect(consentimiento.autorizar).toBeEnabled();
    await verificarAccesibilidad(page);
  });

  test('autorizar registra el consentimiento con titular, alcance y canal y continúa al perfil de riesgo (CA-2)', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();
    await consentimiento.abrir();

    await consentimiento.marcarAmbas();
    await consentimiento.autorizar.click();

    await expect(page).toHaveURL(/\/embebido\/perfil-riesgo\/cliente-0001\?consentimiento=true$/);
    expect(consentimiento.consentimientos).toEqual([
      {
        customer_id: 'cliente-0001',
        document_id: '1020304050',
        full_name: 'Ana María Pérez',
        terms_version: 'v1',
        accepted_sources: ['open_finance', 'open_data', 'kyc'],
        accepted_data_policy: true,
        channel: 'embedded',
        partner_id: 'aliado-banco-1',
        application_id: '48213',
      },
    ]);
    await expect(page.getByRole('heading', { level: 1, name: 'Tu oferta está lista' })).toBeVisible();
    expect(consentimiento.perfiles).toEqual([{ customer_id: 'cliente-0001', consent_active: true }]);
  });

  test('quita el contexto de la URL y no guarda nada en el navegador', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();

    await consentimiento.abrir();
    await expect(consentimiento.titulo).toHaveText('Autoriza la consulta de tus datos');

    await expect(page).toHaveURL(/\/embebido\/consentimiento$/);
    const almacenado = await page.evaluate(() => localStorage.length + sessionStorage.length);
    expect(almacenado).toBe(0);
  });

  test('«Ahora no» no consulta ningún dato ni registra nada (CA-3) y permite volver a autorizar', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();
    await consentimiento.abrir();
    await consentimiento.marcarAmbas();

    await consentimiento.ahoraNo.click();

    await expect(consentimiento.titulo).toHaveText('No consultaremos tus datos');
    await expect(page.getByText('Sin tu autorización no calculamos tu oferta')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continuar con mi crédito' })).toBeVisible();
    expect(consentimiento.peticionesSensibles).toEqual([]);
    await verificarAccesibilidad(page);

    await consentimiento.volverAutorizar.click();
    await expect(consentimiento.titulo).toHaveText('Autoriza la consulta de tus datos');
    expect(consentimiento.peticionesSensibles).toEqual([]);
  });

  test('sin contexto del aliado avisa y no hace ninguna petición', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();
    const peticiones: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.url().includes('/v1/')) {
        peticiones.push(peticion.url());
      }
    });

    await page.goto('/embebido/consentimiento');

    await expect(consentimiento.titulo).toHaveText('No recibimos los datos de tu crédito');
    await expect(consentimiento.alerta).toContainText('Vuelve al sitio de tu banco');
    await expect(consentimiento.autorizar).toHaveCount(0);
    expect(peticiones).toEqual([]);
    await verificarAccesibilidad(page);
  });

  test('con un contexto inválido (base64 roto o campos erróneos) trata el caso igual que sin contexto', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway();

    await consentimiento.abrirConValor('esto-no-es-un-contexto!!');
    await expect(consentimiento.titulo).toHaveText('No recibimos los datos de tu crédito');

    await consentimiento.abrir({ ...CONTEXTO_ALIADO, cliente: { ...CONTEXTO_ALIADO.cliente, documento: '12' } });
    await expect(consentimiento.titulo).toHaveText('No recibimos los datos de tu crédito');
    expect(consentimiento.peticionesSensibles).toEqual([]);
  });

  test('muestra el estado cargando mientras llegan los términos', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    let terminar!: () => void;
    const retenida = new Promise<void>((resolver) => (terminar = resolver));
    await consentimiento.simularGateway({ esperarTerminos: retenida });

    await consentimiento.abrir();

    await expect(consentimiento.titulo).toHaveText('Estamos preparando tu autorización');
    await expect(page.getByRole('progressbar', { name: 'Consultando los términos' })).toBeVisible();
    await verificarAccesibilidad(page);

    terminar();
    await expect(consentimiento.titulo).toHaveText('Autoriza la consulta de tus datos');
  });

  test('ante una falla del servicio al registrar muestra el error y reintentar continúa', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway({
      consentimiento: { estado: 503, cuerpo: { error: 'service_unavailable', message: 'no se registró' } },
    });
    await consentimiento.abrir();
    await consentimiento.marcarAmbas();

    await consentimiento.autorizar.click();

    await expect(consentimiento.alerta).toContainText('No pudimos registrar tu autorización');
    expect(consentimiento.perfiles).toEqual([]);
    await verificarAccesibilidad(page);

    await page.unroute('**/v1/audit/consents');
    await consentimiento.simularGateway();
    await consentimiento.reintentar.click();

    await expect(page).toHaveURL(/\/embebido\/perfil-riesgo\/cliente-0001/);
  });

  test('si no se pueden consultar los términos ofrece reintentar', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway({
      terminos: { estado: 503, cuerpo: { error: 'service_unavailable', message: 'x' } },
    });

    await consentimiento.abrir();

    await expect(consentimiento.alerta).toContainText('No pudimos consultar los términos');
    expect(consentimiento.peticionesSensibles).toEqual([]);
    await verificarAccesibilidad(page);

    await page.unroute('**/v1/audit/consent-terms/current');
    await consentimiento.simularGateway();
    await consentimiento.reintentar.click();
    await expect(consentimiento.titulo).toHaveText('Autoriza la consulta de tus datos');
  });

  test('si los términos cambiaron (409 terms_outdated) los muestra de nuevo y pide autorizar otra vez', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway({
      consentimiento: { estado: 409, cuerpo: { error: 'terms_outdated', message: 'versión desactualizada' } },
    });
    await consentimiento.abrir();
    await consentimiento.marcarAmbas();

    await consentimiento.autorizar.click();

    await expect(page.getByText('Actualizamos los términos')).toBeVisible();
    await expect(consentimiento.casillaFuentes).not.toBeChecked();
    await expect(consentimiento.autorizar).toBeDisabled();
    await verificarAccesibilidad(page);
  });

  test('si el backend rechaza los datos (400 validation_failed) lo explica y no ofrece reintentar', async ({ page }) => {
    const consentimiento = new ConsentimientoPagina(page);
    await consentimiento.simularGateway({
      consentimiento: {
        estado: 400,
        cuerpo: {
          error: 'validation_failed',
          message: 'one or more fields are invalid',
          fields: [{ field: 'document_id', code: 'invalid_format' }],
        },
      },
    });
    await consentimiento.abrir();
    await consentimiento.marcarAmbas();

    await consentimiento.autorizar.click();

    await expect(consentimiento.alerta).toContainText('Los datos de tu solicitud no son válidos');
    await expect(consentimiento.reintentar).toHaveCount(0);
    await verificarAccesibilidad(page);
  });
});
