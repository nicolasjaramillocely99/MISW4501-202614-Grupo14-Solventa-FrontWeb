import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { AceptacionOfertaPagina, GuionAceptacion } from '../../paginas/aceptacion-oferta.pagina';

/** Aceptación con la forma de las respuestas capturadas del backend (contrato HU-W1.3-01, §2 y §5). */
function aceptacion(ofertaId: string, cambios: Record<string, unknown> = {}) {
  return {
    acceptance_id: 'b310b02b-9820-4725-bded-586d263dd16e',
    offer_id: ofertaId,
    customer_id: 'sub-asegurado',
    channel: 'web',
    accepted_at: '2026-10-12T01:54:41.0909319Z',
    status: 'registered',
    underwriting: null,
    processing: { attempts: 0, last_failure_at: null, next_attempt_at: '2026-10-12T01:54:41.0909319Z' },
    updated_at: '2026-10-12T01:54:41.0909319Z',
    ...cambios,
  };
}

const NO_ACEPTADA = {
  estado: 404,
  cuerpo: { error: 'acceptance_not_found', message: 'the acceptance does not exist' },
};

const TERMINADA = { processing: { attempts: 0, last_failure_at: null, next_attempt_at: null } };

function guion(ofertaId: string, cambios: Partial<GuionAceptacion> = {}): GuionAceptacion {
  return {
    deOferta: NO_ACEPTADA,
    aceptar: { estado: 202, cuerpo: aceptacion(ofertaId) },
    consultas: [{ estado: 200, cuerpo: aceptacion(ofertaId, { status: 'issuance_pending', ...TERMINADA }) }],
    ...cambios,
  };
}

/**
 * Paso 3 del canal embebido: aceptación de la oferta y disparo de la emisión (HU-W1.3-01). Cognito y el API
 * Gateway se simulan con `page.route`; la sesión es la de un asegurado.
 */
test.describe('Aceptación de la oferta (HU-W1.3-01)', () => {
  test('acepta la oferta, confirma la aceptación registrada y llega a la emisión iniciada', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    const llamadas = await oferta.simularGateway(
      guion('demo-active-e2e', {
        consultas: [
          { estado: 200, cuerpo: aceptacion('demo-active-e2e') },
          { estado: 200, cuerpo: aceptacion('demo-active-e2e', { status: 'issuance_pending', ...TERMINADA }) },
        ],
      }),
    );

    await oferta.abrirConSesion('demo-active-e2e');
    await expect(oferta.titulo).toHaveText('Tu oferta personalizada');
    await verificarAccesibilidad(page);

    await oferta.aceptarOferta();
    await expect(oferta.titulo).toHaveText('Registramos tu aceptación');
    await verificarAccesibilidad(page);

    await expect(oferta.titulo).toHaveText('Suscripción aprobada');
    expect(llamadas.aceptar).toEqual([{ channel: 'web' }]);
    expect(llamadas.consultas[0]).toBe('/v1/acceptances/b310b02b-9820-4725-bded-586d263dd16e');
    await verificarAccesibilidad(page);
  });

  test('muestra la solicitud en revisión dentro del mismo flujo', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    await oferta.simularGateway(
      guion('demo-highrisk-e2e', {
        consultas: [
          {
            estado: 200,
            cuerpo: aceptacion('demo-highrisk-e2e', {
              status: 'in_review',
              underwriting: { outcome: 'human_review', reason: 'high_risk_score', decided_at: '2026-10-12T01:54:42Z' },
              ...TERMINADA,
            }),
          },
        ],
      }),
    );

    await oferta.abrirConSesion('demo-highrisk-e2e');
    await oferta.aceptarOferta();

    await expect(oferta.titulo).toHaveText('Tu solicitud está en revisión');
    await expect(page.getByText('Tu perfil requiere una revisión adicional')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver estado de la solicitud' })).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('rechaza una oferta vencida con el motivo y ofrece generar una nueva', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    await oferta.simularGateway(
      guion('demo-expired-e2e', {
        aceptar: {
          estado: 422,
          cuerpo: {
            error: 'offer_expired',
            message: 'the offer validity is over; request a new offer',
            offer_id: 'demo-expired-e2e',
            expires_at: '2026-10-12T00:54:44.4210077Z',
          },
        },
      }),
    );

    await oferta.abrirConSesion('demo-expired-e2e');
    await oferta.aceptarOferta();

    await expect(oferta.titulo).toHaveText('Esta oferta venció');
    await expect(page.getByText(/La oferta demo-expired-e2e venció el 11\/10\/2026/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Generar una nueva oferta' })).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('conserva la aceptación ante una falla posterior y retoma el trámite solo, también tras recargar', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    const conFalla = aceptacion('demo-flaky-e2e', {
      processing: {
        attempts: 1,
        last_failure_at: '2026-10-12T01:54:44.4842859Z',
        next_attempt_at: '2026-10-12T01:54:46.4842859Z',
      },
    });
    const escenario = guion('demo-flaky-e2e', { consultas: [{ estado: 200, cuerpo: conFalla }] });
    const llamadas = await oferta.simularGateway(escenario);

    await oferta.abrirConSesion('demo-flaky-e2e');
    await oferta.aceptarOferta();
    await expect(oferta.titulo).toHaveText('Tu aceptación está guardada');
    await expect(page.getByText(/no necesitas repetirlo/)).toBeVisible();
    await verificarAccesibilidad(page);

    escenario.deOferta = { estado: 200, cuerpo: conFalla };
    await page.reload();
    await expect(oferta.titulo).toHaveText('Tu aceptación está guardada');
    expect(llamadas.aceptar).toHaveLength(1);

    escenario.consultas.push({
      estado: 200,
      cuerpo: aceptacion('demo-flaky-e2e', { status: 'issuance_pending', ...TERMINADA }),
    });
    await expect(oferta.titulo).toHaveText('Suscripción aprobada');
    expect(llamadas.aceptar).toHaveLength(1);
  });

  test('si no se pudo registrar la aceptación, reintentar reenvía el mismo POST', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    const escenario = guion('demo-active-503', {
      aceptar: {
        estado: 503,
        cuerpo: { error: 'acceptance_not_registered', message: 'retrying is safe' },
      },
    });
    const llamadas = await oferta.simularGateway(escenario);

    await oferta.abrirConSesion('demo-active-503');
    await oferta.aceptarOferta();
    await expect(page.getByRole('alert')).toContainText('No pudimos registrar tu aceptación');
    await verificarAccesibilidad(page);

    escenario.aceptar = { estado: 202, cuerpo: aceptacion('demo-active-503') };
    await page.getByRole('button', { name: /Reintentar/ }).click();

    await expect(oferta.titulo).toHaveText('Suscripción aprobada');
    expect(llamadas.aceptar).toHaveLength(2);
  });

  test('un asesor no puede aceptar ofertas: ve acceso no autorizado', async ({ page }) => {
    await simularCognito(page);
    const oferta = new AceptacionOfertaPagina(page);
    const llamadas = await oferta.simularGateway(guion('demo-active-asesor'));

    await oferta.abrirConSesion('demo-active-asesor', 'asesor');

    await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
    expect(llamadas.deOferta).toBe(0);
  });
});
