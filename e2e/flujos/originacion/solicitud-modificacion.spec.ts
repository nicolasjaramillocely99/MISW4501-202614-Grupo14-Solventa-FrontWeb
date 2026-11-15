import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { POLIZA, SOLICITUDES, condiciones } from '../../fixtures/solicitudes-modificacion';
import { SolicitudModificacionPagina } from '../../paginas/solicitud-modificacion.pagina';

/**
 * Solicitud de modificación del asegurado (HU-W1.4-01): A1 → A3 → A3b → A11. Cognito y el API Gateway se simulan con
 * `page.route`; la sesión es la de un asegurado. Los estados posteriores a «radicada» (los de HU-W1.4-02) llegan simulados.
 */
test.describe('Solicitud de modificación del asegurado (HU-W1.4-01)', () => {
  test('E1 · camino feliz: de «Mis pólizas» a radicar dos beneficiarios y verla en «Mis solicitudes» (CA-1, CA-2)', async ({ page }) => {
    await simularCognito(page);
    const a3 = new SolicitudModificacionPagina(page);
    const { radicadas } = await a3.simular();

    await a3.abrirComo('/originacion/polizas');
    await page.getByRole('link', { name: `Solicitar modificación de la póliza ${POLIZA}` }).click();
    await expect(page).toHaveURL(`/originacion/polizas/${POLIZA}/modificar`);
    await expect(a3.titulo).toHaveText('Solicitar una modificación');
    await expect(a3.tipo('Beneficiarios')).toBeChecked();
    await expect(page.getByRole('row', { name: /Banco Aliado/ })).toContainText('No modificable');
    await verificarAccesibilidad(page);

    await a3.escribirBeneficiario('Mateo Pérez Gómez', '1.140.223.001', '60');
    await a3.agregar.click();
    await a3.escribirBeneficiario('Lucía Pérez Gómez', '1142998310', '40');
    await expect(page.getByText('Mateo Pérez Gómez · 60 % · Lucía Pérez Gómez · 40 %')).toBeVisible();
    await expect(a3.radicar).toBeEnabled();
    await a3.radicar.click();

    await expect(page).toHaveURL('/originacion/solicitudes/SOL-MOD-2026-0061');
    expect(radicadas[0]).toEqual({
      change_type: 'beneficiaries',
      channel: 'web',
      beneficiaries: [
        { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 60 },
        { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310', share_percent: 40 },
      ],
    });
    await expect(a3.titulo).toHaveText('Solicitud SOL-MOD-2026-0061');
    await expect(page.getByText('Tu solicitud quedó radicada')).toBeVisible();
    await expect(page.getByText('Hasta 2 días hábiles')).toBeVisible();
    await expect(page.getByText('carolina.perez@solventa.co · portal web')).toBeVisible();
    await verificarAccesibilidad(page);

    await page.getByRole('link', { name: 'Ver mis solicitudes' }).click();
    await expect(page).toHaveURL('/originacion/solicitudes');
    await expect(a3.filas.first()).toContainText('SOL-MOD-2026-0050');
    await verificarAccesibilidad(page);
  });

  test('E2 · inválida o incompleta: suma de 120 %, campos vacíos y el 422 del servicio en su campo (CA-3)', async ({ page }) => {
    await simularCognito(page);
    const a3 = new SolicitudModificacionPagina(page);
    await a3.simular({
      radicar: [
        { estado: 422, cuerpo: { error: 'validation_failed', message: 'm', fields: [{ field: 'beneficiaries[0].document_number', code: 'invalid_format' }] } },
      ],
    });
    await a3.abrirModificar();

    await a3.escribirBeneficiario('Mateo Pérez Gómez', '1140223001', '60');
    await a3.agregar.click();
    await a3.escribirBeneficiario('Lucía Pérez Gómez', '1142998310', '60');
    await expect(page.getByText('La suma de participaciones debe ser 100 % (actual: 120 %)')).toBeVisible();
    await expect(a3.radicar).toBeDisabled();
    await verificarAccesibilidad(page);

    await a3.participacion.fill('');
    await a3.numeroDocumento.fill('');
    await a3.numeroDocumento.blur();
    await a3.participacion.blur();
    await expect(page.getByText('Completa este dato.').first()).toBeVisible();
    await expect(a3.radicar).toBeDisabled();

    await a3.numeroDocumento.fill('11A2998310');
    await a3.numeroDocumento.blur();
    await expect(page.getByText('De 5 a 20 letras o dígitos; solo dígitos en CC, TI y RC.')).toBeVisible();

    await a3.numeroDocumento.fill('1142998310');
    await a3.participacion.fill('40');
    await a3.participacion.blur();
    await a3.radicar.click();
    await expect(page.getByRole('row', { name: /Mateo Pérez Gómez/ })).toContainText('De 5 a 20 letras o dígitos');
    await verificarAccesibilidad(page);
  });

  test('E3 · suma asegurada y datos personales: fuera de rango, sin cambios, inválidos y válidos (CA-1, CA-3)', async ({ page }) => {
    await simularCognito(page);
    const a3 = new SolicitudModificacionPagina(page);
    const { radicadas } = await a3.simular();
    await a3.abrirModificar();

    await a3.tipo('Sumas aseguradas').check();
    const nuevo = page.getByLabel('Nuevo valor asegurado (COP)');
    await nuevo.fill('5.000.000');
    await nuevo.blur();
    await expect(page.getByRole('alert')).toContainText('Debe estar entre');
    await nuevo.fill('68.000.000');
    await expect(page.getByRole('alert')).toContainText('Es igual al valor asegurado actual.');
    await expect(a3.radicar).toBeDisabled();
    await verificarAccesibilidad(page);
    await nuevo.fill('300.000.000');
    await expect(page.getByText(/300\.000\.000 COP/)).toBeVisible();
    await a3.radicar.click();
    await expect(page).toHaveURL(/\/originacion\/solicitudes\/SOL-MOD-2026-0061$/);
    expect(radicadas[0]).toEqual({ change_type: 'insured_amount', channel: 'web', insured_amount: 300000000 });

    // La sesión sigue abierta: se vuelve a A3 sin pasar por el inicio de sesión.
    await page.goto(`/originacion/polizas/${POLIZA}/modificar`);
    await a3.tipo('Datos personales').check();
    await page.getByLabel('Correo de contacto de la póliza').fill('carolina@');
    await page.getByLabel('Teléfono', { exact: true }).fill('300 123');
    await page.getByLabel('Teléfono', { exact: true }).blur();
    await expect(page.getByText('Escribe un correo válido, como nombre@dominio.com.')).toBeVisible();
    await expect(page.getByText('El teléfono lleva 10 dígitos.', { exact: true })).toBeVisible();
    await expect(a3.radicar).toBeDisabled();
    await verificarAccesibilidad(page);
    await page.getByLabel('Correo de contacto de la póliza').fill('');
    await page.getByLabel('Teléfono', { exact: true }).fill('+57 301 234 5678');
    await page.getByLabel('Dirección', { exact: true }).fill('Calle 45 # 12-30, Bogotá');
    await a3.radicar.click();
    await expect(page).toHaveURL(/\/originacion\/solicitudes\/SOL-MOD-2026-0062$/);
    expect(radicadas[1]).toEqual({
      change_type: 'personal_data',
      channel: 'web',
      personal_data: { address: 'Calle 45 # 12-30, Bogotá', phone: '3012345678' },
    });
  });

  test('E4 · «Mis solicitudes»: cinco estados, indicadores, filtros en la URL, vacío, error y detalle rechazado (CA-2)', async ({ page }) => {
    await simularCognito(page);
    const a11 = new SolicitudModificacionPagina(page);
    const { consultas } = await a11.simular({
      detalles: { 'SOL-MOD-2026-0050': { estado: 200, cuerpo: SOLICITUDES.devuelta } },
    });
    await a11.abrirComo('/originacion/solicitudes');

    await expect(a11.titulo).toHaveText('Mis solicitudes');
    await expect(page.getByRole('region', { name: 'Resumen de tus solicitudes' })).toContainText('Aplicadas este año');
    await expect(a11.filas).toHaveCount(6);
    await expect(a11.filas.nth(0)).toContainText('Rechazada');
    await expect(a11.filas.nth(0)).toContainText('El documento de un beneficiario no es válido');
    await expect(a11.filas.nth(1)).toContainText('En revisión');
    await expect(a11.filas.nth(2)).toContainText('Radicada');
    await expect(a11.filas.nth(4)).toContainText('Aplicada');
    await verificarAccesibilidad(page);

    await page.getByLabel('Estado', { exact: true }).selectOption('rejected');
    await expect(page).toHaveURL('/originacion/solicitudes?estado=rejected');
    await expect(a11.filas).toHaveCount(2);
    expect(consultas.at(-1)?.toString()).toBe('page=1&page_size=20&status=rejected');
    await page.reload();
    await expect(a11.filas).toHaveCount(2);
    await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('rejected');

    await page.getByRole('link', { name: 'Ver detalle de SOL-MOD-2026-0050' }).click();
    await expect(page.getByText('Tu solicitud fue rechazada')).toBeVisible();
    await expect(page.getByText('El documento de un beneficiario no es válido')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Radicar una nueva' })).toHaveAttribute('href', `/originacion/polizas/${POLIZA}/modificar`);
    await verificarAccesibilidad(page);
  });

  test('E4b · «Mis solicitudes» vacía y con error', async ({ page }) => {
    await simularCognito(page);
    const a11 = new SolicitudModificacionPagina(page);
    await a11.simular({
      lista: {
        estado: 200,
        cuerpo: {
          items: [],
          page: 1,
          page_size: 20,
          total_items: 0,
          total_pages: 0,
          indicators: { open: { count: 0, latest: null }, applied_this_year: { count: 0, latest: null }, rejected: { count: 0, latest: null } },
          policies: [],
        },
      },
    });
    await a11.abrirComo('/originacion/solicitudes');
    await expect(page.getByText('Aún no tienes solicitudes')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver mis pólizas' })).toBeVisible();
    await verificarAccesibilidad(page);

    await page.unroute((url) => url.pathname === '/v1/policies/change-requests');
    await page.route(
      (url) => url.pathname === '/v1/policies/change-requests',
      (ruta) => ruta.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'change_request_unavailable', message: 'm' }) }),
    );
    await page.reload();
    await expect(page.getByText('No pudimos cargar tus solicitudes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await verificarAccesibilidad(page);
  });

  for (const rol of ['asesor', 'operaciones'] as const) {
    test(`E5 · ${rol} no entra a A3, A3b ni A11 (CA-4)`, async ({ page }) => {
      await simularCognito(page);
      const pagina = new SolicitudModificacionPagina(page);
      await pagina.simular();

      await pagina.abrirModificar(rol);
      await expect(page).toHaveURL('/acceso/no-autorizado');
      for (const ruta of ['/originacion/solicitudes', '/originacion/solicitudes/SOL-MOD-2026-0042']) {
        await page.goto(ruta);
        await expect(page).toHaveURL('/acceso/no-autorizado');
      }
      await verificarAccesibilidad(page);
    });
  }

  test('E5b · un 403 de la póliza de otro asegurado muestra «no autorizado» (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const pagina = new SolicitudModificacionPagina(page);
    await pagina.simular({ condiciones: { estado: 403, cuerpo: { error: 'forbidden', message: 'm' } } });

    await pagina.abrirComo('/originacion/polizas/pol-de-diego/modificar');

    await expect(page).toHaveURL('/acceso/no-autorizado');
    await verificarAccesibilidad(page);
  });

  test('E6 · una abierta del mismo tipo (409 con enlace), póliza no vigente y una póliza que no existe', async ({ page }) => {
    await simularCognito(page);
    const a3 = new SolicitudModificacionPagina(page);
    await a3.simular({
      condiciones: {
        estado: 200,
        cuerpo: condiciones({
          open_requests: [{ request_id: 'SOL-MOD-2026-0042', change_type: 'beneficiaries', status: 'filed', filed_at: '2026-09-16T20:10:00Z' }],
        }),
      },
      radicar: [{ estado: 409, cuerpo: { error: 'change_request_open', message: 'm', request_id: 'SOL-MOD-2026-0043' } }],
    });
    await a3.abrirModificar();

    await expect(a3.tipo('Beneficiarios')).toBeDisabled();
    await expect(page.getByText(/Ya tienes la solicitud SOL-MOD-2026-0042 en curso/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver solicitud' })).toHaveAttribute('href', '/originacion/solicitudes/SOL-MOD-2026-0042');
    await expect(a3.tipo('Sumas aseguradas')).toBeChecked();
    await verificarAccesibilidad(page);

    await page.getByLabel('Nuevo valor asegurado (COP)').fill('90000000');
    await a3.radicar.click();
    await expect(page.getByRole('alert')).toContainText('Ya tienes la solicitud SOL-MOD-2026-0043 en curso');
    await expect(a3.tipo('Sumas aseguradas')).toBeDisabled();
    await verificarAccesibilidad(page);
  });

  test('E6b · póliza no vigente y póliza inexistente no dejan radicar', async ({ page }) => {
    await simularCognito(page);
    const a3 = new SolicitudModificacionPagina(page);
    await a3.simular({
      condiciones: {
        estado: 200,
        cuerpo: condiciones({
          policy: {
            policy_id: POLIZA,
            line: 'life',
            holder_name: 'Carolina Pérez',
            coverage_start: '2025-01-01T12:00:00Z',
            coverage_end: '2026-01-01T12:00:00Z',
            in_force: false,
          },
        }),
      },
    });
    await a3.abrirModificar();
    await expect(page.getByText('Esta póliza no está vigente')).toBeVisible();
    await expect(a3.radicar).toBeDisabled();
    await verificarAccesibilidad(page);

    await page.unroute((url) => url.pathname.endsWith('/current-terms'));
    await page.route(
      (url) => url.pathname.endsWith('/current-terms'),
      (ruta) => ruta.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'policy_not_found', message: 'm' }) }),
    );
    await page.reload();
    await expect(page.getByText('No encontramos esta póliza')).toBeVisible();
    await verificarAccesibilidad(page);
  });
});
