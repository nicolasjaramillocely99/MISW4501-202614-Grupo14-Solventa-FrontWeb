import { Page, expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../accesibilidad/verificar-accesibilidad';
import { CONTEXTO_ALIADO } from '../fixtures/contexto-aliado';
import {
  CONTRASENA_NUBE,
  CORRIDA_NUBE,
  RolNube,
  TARJETA_APROBADA,
  TARJETA_RECHAZADA,
  USUARIOS_NUBE,
} from '../fixtures/usuarios-nube';
import { AceptacionOfertaPagina } from '../paginas/aceptacion-oferta.pagina';
import { ConsentimientoPagina } from '../paginas/consentimiento.pagina';
import { InicioSesionPagina } from '../paginas/inicio-sesion.pagina';
import { PagoPagina } from '../paginas/pago.pagina';
import { PerfilRiesgoPagina } from '../paginas/perfil-riesgo.pagina';
import { PolizaEmitidaPagina } from '../paginas/poliza-emitida.pagina';

/**
 * Humo del portal **desplegado** (T5): CloudFront, `config.json`, el API Gateway en el mismo dominio, Cognito real con
 * los usuarios permanentes y la pasarela simulada de la plataforma. **Sin `page.route`**: todo va a la nube.
 * Solo existe en el proyecto `nube` (`E2E_NUBE=1` y `E2E_BASE_URL` con la URL del portal), nunca en el CI.
 * El escenario 7 (consentimiento y «Ver mi oferta») solo corre con `NUBE_AUDIT=1`, cuando las rutas de `audit` del
 * aliado estén en el gateway (D-10 de T5).
 */

const CON_AUDIT = process.env['NUBE_AUDIT'] === '1';

/** Inicia sesión en P0 con un usuario permanente; si hay `returnUrl`, el portal vuelve a esa ruta. */
async function ingresar(page: Page, rol: RolNube): Promise<void> {
  await new InicioSesionPagina(page).ingresar(USUARIOS_NUBE[rol], CONTRASENA_NUBE);
}

/** Acepta una oferta de demostración como asegurado y llega al paso de pago (E4). */
async function aceptarHastaElPago(page: Page, oferta: string): Promise<PagoPagina> {
  const aceptacion = new AceptacionOfertaPagina(page);
  await page.goto(`/embebido/oferta/${oferta}`);
  await ingresar(page, 'asegurado');
  await expect(page).toHaveURL(new RegExp(`/embebido/oferta/${oferta}$`));
  await aceptacion.aceptarOferta();
  await expect(aceptacion.titulo).toHaveText('Suscripción aprobada', { timeout: 90_000 });
  await verificarAccesibilidad(page);
  await page.getByRole('link', { name: 'Ver el estado de tu pago' }).click();
  const pago = new PagoPagina(page);
  await expect(page.getByLabel(/Número de tarjeta/i)).toBeVisible({ timeout: 60_000 });
  await verificarAccesibilidad(page);
  return pago;
}

async function pagarConTarjeta(page: Page, numero: string): Promise<void> {
  await page.getByLabel(/Número de tarjeta/i).fill(numero);
  await page.getByLabel(/Vencimiento/i).fill('11/30');
  await page.getByLabel(/Código de seguridad/i).fill('123');
  await page.getByLabel(/Nombre del titular/i).fill('PRUEBA PORTAL');
  await page.getByRole('button', { name: /Pagar mi primera prima/i }).click();
}

test.describe('Portal desplegado en la nube (T5)', () => {
  test.beforeAll(() => {
    expect(process.env['E2E_BASE_URL'], 'Define E2E_BASE_URL con la URL del portal').toMatch(/^https:\/\//);
    expect(CONTRASENA_NUBE, 'Define NUBE_CONTRASENA (desde SOLVENTA_IDENTITY_SEED_PASSWORD)').not.toBe('');
  });

  test('1 · el asesor inicia sesión con Cognito real, ve su inicio y abre la bandeja', async ({ page }) => {
    await page.goto('/acceso/iniciar-sesion');
    await ingresar(page, 'asesor');

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await verificarAccesibilidad(page);
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Bandeja de decisión' }).click();

    await expect(page).toHaveURL(/\/originacion\/bandeja-decision$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bandeja de decisión humana');
    await verificarAccesibilidad(page);
  });

  test('2 · recargar una ruta profunda devuelve la aplicación (enlaces profundos de CloudFront)', async ({ page }) => {
    await page.goto('/originacion/bandeja-decision');
    await ingresar(page, 'asesor');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bandeja de decisión humana');

    await page.reload();

    await expect(page).toHaveURL(/\/originacion\/bandeja-decision$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bandeja de decisión humana');
    await verificarAccesibilidad(page);
  });

  test('3 · oferta de demostración → tarjeta por la pasarela → pago confirmado → póliza → PDF', async ({ page }) => {
    test.setTimeout(240_000);
    const pago = await aceptarHastaElPago(page, `demo-active-${CORRIDA_NUBE}`);

    await pagarConTarjeta(page, TARJETA_APROBADA);

    await expect(pago.titulo).toHaveText('Pago confirmado', { timeout: 120_000 });
    await verificarAccesibilidad(page);
    await page.getByRole('link', { name: 'Ver mi póliza' }).click();
    const poliza = new PolizaEmitidaPagina(page);
    await expect(poliza.titulo).toHaveText('¡Tu póliza está activa!', { timeout: 90_000 });
    await verificarAccesibilidad(page);

    const descarga = page.waitForEvent('download');
    await poliza.descargar.click();
    const archivo = await (await descarga).createReadStream();
    const primeros = await new Promise<string>((resolver, rechazar) => {
      archivo.once('data', (trozo) => resolver(trozo.toString('latin1', 0, 5)));
      archivo.once('error', rechazar);
    });
    expect(primeros).toBe('%PDF-');
  });

  test('4 · una tarjeta terminada en 0002 lleva al pago rechazado (E4c)', async ({ page }) => {
    test.setTimeout(240_000);
    const pago = await aceptarHastaElPago(page, `demo-active-${CORRIDA_NUBE}r`);

    await pagarConTarjeta(page, TARJETA_RECHAZADA);

    await expect(pago.titulo).toHaveText('Tu pago fue rechazado', { timeout: 120_000 });
    await verificarAccesibilidad(page);
  });

  test('5 · el perfil de riesgo del canal embebido llega por la ruta de socio sin sesión (E2)', async ({ page }) => {
    const perfil = new PerfilRiesgoPagina(page);

    await page.goto(`/embebido/perfil-riesgo/cliente-${CORRIDA_NUBE}?consentimiento=true`);

    await expect(perfil.verOferta).toBeVisible({ timeout: 30_000 });
    await expect(perfil.titulo).toHaveText('Tu oferta está lista');
    await verificarAccesibilidad(page);
  });

  test('6 · ninguna petición del navegador lleva x-api-key y config.json no trae secretos', async ({ page, request }) => {
    const conLlave: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.headers()['x-api-key'] !== undefined) {
        conLlave.push(new URL(peticion.url()).pathname);
      }
    });

    await page.goto(`/embebido/perfil-riesgo/cliente-${CORRIDA_NUBE}k?consentimiento=true`);
    await expect(new PerfilRiesgoPagina(page).verOferta).toBeVisible({ timeout: 30_000 });
    expect(conLlave).toEqual([]);

    const config = await request.get('/config.json');
    expect(config.status()).toBe(200);
    const cuerpo = (await config.json()) as Record<string, unknown>;
    expect(Object.keys(cuerpo).sort()).toEqual(['apiGatewayUrl', 'cognito', 'pasarelaPagosUrl']);
    expect(JSON.stringify(cuerpo)).not.toMatch(/api[-_]?key|secret|password/i);
  });

  test('7 · consentimiento → perfil → «Ver mi oferta» → oferta personalizada (solo con NUBE_AUDIT=1)', async ({ page }) => {
    test.skip(!CON_AUDIT, 'Las rutas de audit del aliado aún no están en el gateway (D-10): NUBE_AUDIT=1 las prueba');
    test.setTimeout(180_000);
    const consentimiento = new ConsentimientoPagina(page);
    // Un cliente nuevo por corrida: el consentimiento es idempotente por cliente, solicitud y versión de términos.
    await consentimiento.abrir({ ...CONTEXTO_ALIADO, cliente: { ...CONTEXTO_ALIADO.cliente, id: `cliente-${CORRIDA_NUBE}a` } });
    await verificarAccesibilidad(page);

    await consentimiento.marcarAmbas();
    await consentimiento.autorizar.click();
    await expect(consentimiento.titulo).toHaveText('Tu oferta está lista', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Ver mi oferta' }).click();
    await ingresar(page, 'asegurado');

    await expect(page).toHaveURL(/\/embebido\/oferta\/off-[0-9a-f]+$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu oferta personalizada');
    await verificarAccesibilidad(page);
  });
});
