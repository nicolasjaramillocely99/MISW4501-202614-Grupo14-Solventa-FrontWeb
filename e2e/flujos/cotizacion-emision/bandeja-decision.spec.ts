import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { BandejaDecisionPagina, GuionBandeja } from '../../paginas/bandeja-decision.pagina';

const ID = '6af8ce61-2424-4ed2-8375-57eaf9f9ee67';

/** Solicitud con la forma de las respuestas capturadas del backend (contrato HU-W1.1-02, §2). */
function solicitud(cambios: Record<string, unknown> = {}) {
  return {
    acceptance_id: ID,
    offer_id: 'demo-review-1792212135',
    customer_id: 'ff5a40b9-19f8-413a-8665-f73d9196fc6d',
    applicant: { full_name: 'Carolina Pérez Ruiz', document_id: 'CC 1020345678', email: 'carolina@example.com' },
    offer: { premium: 89500, currency: 'COP', mode: 'provisional', expires_at: '2026-10-18T04:42:19.9766934Z' },
    reason: 'provisional_offer',
    received_at: '2026-10-17T04:42:19.9766934Z',
    status: 'pending',
    decision: null,
    ...cambios,
  };
}

function decidida(tipo: 'accept' | 'adjust' | 'reject', observaciones: string) {
  return solicitud({
    offer: { premium: 89500, currency: 'COP' },
    status: 'decided',
    decision: {
      decision_id: 'a37c997a-e061-4042-8621-2d365ed021bc',
      type: tipo,
      advisor: { id: '413ed637-0f56-4b36-b181-70fe3ee8e578', email: 'asesor.local@example.com' },
      decided_at: '2026-10-17T04:42:20.022742Z',
      observations: observaciones,
      premium_adjustment_pct: tipo === 'adjust' ? 10 : null,
      adjusted_offer:
        tipo === 'adjust'
          ? { offer_id: `adj-${ID}`, premium: 98450, currency: 'COP', expires_at: '2026-10-18T04:42:20.022742Z' }
          : null,
      notification: tipo === 'accept' ? null : { channel: 'email', status: 'pending', attempts: 0, sent_at: null },
    },
  });
}

const lista = (items: unknown[], pendientes: number, decididas: number) => ({
  estado: 200,
  cuerpo: { items, counts: { pending: pendientes, decided: decididas } },
});

function guion(cambios: Partial<GuionBandeja> = {}): GuionBandeja {
  return {
    pendientes: lista([solicitud()], 1, 0),
    decididas: lista([], 1, 0),
    detalle: { estado: 200, cuerpo: solicitud() },
    decisiones: [{ estado: 201, cuerpo: decidida('adjust', 'Ingreso declarado sin verificar') }],
    ...cambios,
  };
}

/**
 * Bandeja de solicitudes enrutadas a decisión humana (HU-W1.1-02). Cognito y el API Gateway se simulan con
 * `page.route`; la sesión es la de un asesor comercial.
 */
test.describe('Bandeja de decisión humana (HU-W1.1-02)', () => {
  test('lista las solicitudes pendientes y abre una (CA-1)', async ({ page }) => {
    await simularCognito(page);
    const bandeja = new BandejaDecisionPagina(page);
    const llamadas = await bandeja.simularGateway(guion());

    await bandeja.abrirComo('/originacion/bandeja-decision');

    await expect(bandeja.titulo).toHaveText('Bandeja de decisión humana');
    await expect(bandeja.pendientes).toHaveText('Pendientes (1)');
    await expect(bandeja.pendientes).toHaveAttribute('aria-selected', 'true');
    const tabla = page.getByRole('table', { name: 'Solicitudes pendientes de decisión' });
    await expect(tabla.getByText('Carolina Pérez Ruiz')).toBeVisible();
    await expect(tabla.getByText('Perfil provisional (fuente caída)')).toBeVisible();
    expect(llamadas.listas[0]).toBe('status=pending&order=asc');
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: `Revisar la solicitud ${ID}` }).click();

    await expect(page).toHaveURL(`/originacion/bandeja-decision/${ID}`);
    await expect(bandeja.titulo).toHaveText(`Solicitud ${ID}`);
    await expect(page.getByText('Motivo del enrutamiento: Perfil provisional (fuente caída)')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Decisión' })).toBeVisible();
    expect(llamadas.detalles).toEqual([`/v1/review-requests/${ID}`]);
    await verificarAccesibilidad(page);
  });

  test('filtra por motivo, ordena por llegada y cambia de pestaña (CA-5)', async ({ page }) => {
    await simularCognito(page);
    const bandeja = new BandejaDecisionPagina(page);
    const llamadas = await bandeja.simularGateway(guion({ decididas: lista([decidida('reject', 'Fuera de política')], 1, 1) }));

    await bandeja.abrirComo('/originacion/bandeja-decision');
    await expect(bandeja.pendientes).toHaveText('Pendientes (1)');

    await bandeja.motivo.selectOption({ label: 'Puntaje de riesgo alto' });
    await bandeja.orden.selectOption({ label: 'La más reciente primero' });
    await bandeja.decididas.click();

    await expect(bandeja.decididas).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('table', { name: 'Solicitudes decididas' }).getByText('Rechazada')).toBeVisible();
    expect(llamadas.listas).toEqual([
      'status=pending&order=asc',
      'status=pending&order=asc&reason=high_risk_score',
      'status=pending&order=desc&reason=high_risk_score',
      'status=decided&order=desc&reason=high_risk_score',
    ]);
    await verificarAccesibilidad(page);
  });

  test('exige observaciones al ajustar y no envía nada (CA-2)', async ({ page }) => {
    await simularCognito(page);
    const bandeja = new BandejaDecisionPagina(page);
    const llamadas = await bandeja.simularGateway(guion());

    await bandeja.abrirComo(`/originacion/bandeja-decision/${ID}`);
    await bandeja.decision(/Ajustar/).check();
    await bandeja.ajuste.fill('10');
    await bandeja.registrar.click();

    await expect(page.getByText('Escribe las observaciones: son obligatorias al ajustar o rechazar.')).toBeVisible();
    await expect(bandeja.observaciones).toHaveAttribute('aria-invalid', 'true');
    await expect(bandeja.observaciones).toBeFocused();
    expect(llamadas.decisiones).toEqual([]);
    await verificarAccesibilidad(page);
  });

  const casos = [
    {
      nombre: 'ajusta la prima 10 %',
      opcion: /Ajustar/,
      ajuste: '10',
      observaciones: 'Ingreso declarado sin verificar',
      cuerpo: { type: 'adjust', observations: 'Ingreso declarado sin verificar', premium_adjustment_pct: 10 },
      tipo: 'adjust' as const,
    },
    {
      nombre: 'rechaza el riesgo',
      opcion: /Rechazar/,
      ajuste: null,
      observaciones: 'Riesgo fuera de la política',
      cuerpo: { type: 'reject', observations: 'Riesgo fuera de la política' },
      tipo: 'reject' as const,
    },
    {
      nombre: 'acepta el riesgo sin observaciones',
      opcion: /Aceptar el riesgo/,
      ajuste: null,
      observaciones: '',
      cuerpo: { type: 'accept' },
      tipo: 'accept' as const,
    },
  ];

  for (const caso of casos) {
    test(`${caso.nombre} y vuelve a la bandeja con «Decisión registrada» (CA-3)`, async ({ page }) => {
      await simularCognito(page);
      const bandeja = new BandejaDecisionPagina(page);
      const g = guion({ decisiones: [{ estado: 201, cuerpo: decidida(caso.tipo, caso.observaciones) }] });
      const llamadas = await bandeja.simularGateway(g);

      await bandeja.abrirComo(`/originacion/bandeja-decision/${ID}`);
      await bandeja.decision(caso.opcion).check();
      if (caso.ajuste) {
        await bandeja.ajuste.fill(caso.ajuste);
      }
      if (caso.observaciones) {
        await bandeja.observaciones.fill(caso.observaciones);
      }
      g.pendientes = lista([], 0, 1);
      await bandeja.registrar.click();

      await expect(page).toHaveURL('/originacion/bandeja-decision');
      await expect(bandeja.titulo).toHaveText('Decisión registrada');
      await expect(page.getByText(/La decisión de Carolina Pérez Ruiz quedó registrada/)).toBeVisible();
      await expect(page.getByText('No hay solicitudes pendientes de decisión.')).toBeVisible();
      expect(llamadas.decisiones).toEqual([caso.cuerpo]);
      await verificarAccesibilidad(page);
    });
  }

  test('muestra las decididas con asesor, fecha, tipo y observaciones (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const bandeja = new BandejaDecisionPagina(page);
    const ajustada = decidida('adjust', 'Ingreso declarado sin verificar');
    await bandeja.simularGateway(guion({ decididas: lista([ajustada], 0, 1), detalle: { estado: 200, cuerpo: ajustada } }));

    await bandeja.abrirComo('/originacion/bandeja-decision');
    await bandeja.decididas.click();
    const tabla = page.getByRole('table', { name: 'Solicitudes decididas' });
    await expect(tabla.getByText('Ajustada')).toBeVisible();
    await expect(tabla.getByText('asesor.local@example.com')).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: `Ver detalle de la solicitud ${ID}` }).click();

    await expect(page.getByRole('heading', { name: 'Decisión registrada' })).toBeVisible();
    await expect(page.getByText('Ingreso declarado sin verificar')).toBeVisible();
    await expect(page.getByText('10 %')).toBeVisible();
    await expect(page.getByText(`adj-${ID}`)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Decisión' })).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  test('si otro asesor decidió primero, recarga y muestra lo decidido (409)', async ({ page }) => {
    await simularCognito(page);
    const bandeja = new BandejaDecisionPagina(page);
    const g = guion({
      decisiones: [
        {
          estado: 409,
          cuerpo: { error: 'review_request_already_decided', message: 'the review request is already decided' },
        },
      ],
    });
    await bandeja.simularGateway(g);

    await bandeja.abrirComo(`/originacion/bandeja-decision/${ID}`);
    await bandeja.decision(/Rechazar/).check();
    await bandeja.observaciones.fill('Fuera de política');
    g.detalle = { estado: 200, cuerpo: decidida('accept', '') };
    await bandeja.registrar.click();

    await expect(page.getByText(/Otro asesor ya registró la decisión/)).toBeVisible();
    await expect(page.getByText('Aceptada')).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('un asegurado no puede entrar a la bandeja: ve acceso no autorizado', async ({ page }) => {
    await simularCognito(page);
    const bandeja = new BandejaDecisionPagina(page);
    const llamadas = await bandeja.simularGateway(guion());

    await bandeja.abrirComo('/originacion/bandeja-decision', 'asegurado');

    await expect(page).toHaveURL(/\/acceso\/no-autorizado$/);
    expect(llamadas.listas).toEqual([]);
  });
});
