import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  CONSENTIMIENTO_ID as ID,
  activo,
  enCurso,
  errorHttp,
  noEncontrado,
  ok,
  parcial,
  parcialResuelto,
  revocado,
  revocadoDesdeApp,
  validacionFallida,
  vencido,
} from '../../fixtures/consentimientos';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { pagina, respuesta } from '../../fixtures/listado-consentimientos';
import { DetalleConsentimientoPagina } from '../../paginas/detalle-consentimiento.pagina';
import { ListadoConsentimientosPagina } from '../../paginas/listado-consentimientos.pagina';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** El sondeo consulta cada 5 s: se espera un poco más que un ciclo. */
const UN_CICLO_DE_SONDEO = { timeout: 15_000 };

/**
 * Revocación de un consentimiento de Open Finance desde el portal de cumplimiento (HU-W4.2-02). Cognito y el API Gateway se
 * simulan con `page.route`; la sesión es la de un analista de operaciones. Desde HU-W4.2-01 se entra por el listado (O14),
 * que reemplazó la búsqueda provisional por identificador.
 */
test.describe('Revocación de consentimientos desde el portal (HU-W4.2-02)', () => {
  test('desde el listado abre el consentimiento y el modal pide confirmar con datos, motivo y referencia (CA-1)', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await listado.simularListado();
    const peticiones = await detalle.simularGateway({ lecturas: [ok(activo())], revocaciones: [validacionFallida()] });

    await detalle.abrirComo('/auditoria/consentimientos');
    await expect(listado.titulo).toHaveText('Consentimientos Open Finance');
    await verificarAccesibilidad(page);

    await listado.ver(ID).click();

    await expect(page).toHaveURL(`/auditoria/consentimientos/${ID}`);
    await expect(detalle.titulo).toHaveText(`Consentimiento ${ID}`);
    await expect(detalle.estado).toHaveText('Activo');
    // El detalle lee su estado una sola vez.
    expect(peticiones.lecturas).toEqual([ID]);
    await expect(page.getByText(/Ana María Pérez · \*{6}4050\s+· otorgado el 20\/10\/2026/)).toBeVisible();
    await verificarAccesibilidad(page);

    await detalle.revocar.click();
    await expect(detalle.modal).toBeVisible();
    await expect(detalle.modal).toContainText('Ana María Pérez · ******4050');
    await expect(detalle.modal).toContainText('Open Finance, Open Data, KYC');
    await expect(detalle.modal).toContainText('1 · Banco Aliado');
    await expect(detalle.modal).toContainText('Bloqueadas de inmediato en Solventa');
    await expect(detalle.modal).toContainText('Efectivo en ≤ 5 min');
    // Sin motivo, referencia ni casilla: el botón no se habilita y el aviso dice qué falta.
    await expect(detalle.revocarAhora).toBeDisabled();
    await expect(detalle.modal).toContainText(/Para revocar falta:\s*el motivo,\s*una referencia válida,\s*confirmar tu rol\./);
    await verificarAccesibilidad(page);

    // Un 400 validation_failed marca los tres campos a la vez.
    await detalle.completarModal();
    await expect(detalle.revocarAhora).toBeEnabled();
    await detalle.revocarAhora.click();
    await expect(detalle.modal.getByRole('alert')).toHaveText([
      'Selecciona el motivo de la revocación.',
      /La referencia solo admite letras sin tilde/,
      'Confirma que actúas como responsable de cumplimiento.',
    ]);
    await expect(detalle.modal).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('revoca, muestra la revocación en curso y pasa a «Revocado» cuando la entidad confirma (CA-2, CA-5)', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    const peticiones = await detalle.simularGateway({
      lecturas: [ok(activo()), ok(revocado())],
      revocaciones: [ok(enCurso(), 201)],
    });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);
    await expect(detalle.estado).toHaveText('Activo');
    await detalle.revocar.click();
    await detalle.completarModal('  TCK-2026-0412 ');
    await detalle.revocarAhora.click();

    // Cuerpo exacto del contrato y la Idempotency-Key del modal.
    await expect(detalle.estado).toHaveText('Revocación en curso');
    expect(peticiones.revocaciones).toHaveLength(1);
    expect(peticiones.revocaciones[0].id).toBe(ID);
    expect(peticiones.revocaciones[0].cuerpo).toEqual({ reason: 'customer_request', reference: 'TCK-2026-0412', role_confirmed: true });
    expect(peticiones.revocaciones[0].claveIdempotencia).toMatch(UUID);
    await expect(detalle.modal).toBeHidden();
    await expect(detalle.revocar).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Solventa ya no consulta datos de este cliente');
    await expect(detalle.entidades.getByRole('row', { name: /Banco Aliado/ })).toContainText('Pendiente');
    await expect(detalle.entidades.getByRole('row', { name: /Banco Aliado/ })).toContainText(/Plazo hasta \d{2}:\d{2}/);
    await verificarAccesibilidad(page);

    // El sondeo (cada 5 s) lleva a «Revocado» cuando la entidad confirma.
    await expect(detalle.estado).toHaveText('Revocado', UN_CICLO_DE_SONDEO);
    await expect(detalle.entidades.getByRole('row', { name: /Banco Aliado/ })).toContainText('Revocado');
    expect(peticiones.lecturas.length).toBeGreaterThanOrEqual(2);
    const registro = page.getByRole('region', { name: 'Registro de la operación' });
    await expect(registro).toContainText('Andrés Ruiz · Analista de operaciones');
    await expect(registro).toContainText('Solicitud del cliente');
    await expect(registro).toContainText('TCK-2026-0412');
    await expect(registro).toContainText('REV-2026-0089 · Disponible en la app del cliente');
    const historial = page.getByRole('region', { name: 'Historial de estados' }).getByRole('listitem');
    await expect(historial).toHaveCount(4);
    await expect(historial.nth(1)).toContainText('Revocación solicitada');
    await expect(historial.nth(3)).toContainText('Revocación confirmada por la entidad');
    await verificarAccesibilidad(page);
  });

  test('una entidad que no confirma deja la revocación parcial y se reintenta solo con ella (CA-3)', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    const peticiones = await detalle.simularGateway({ lecturas: [ok(parcial()), ok(parcialResuelto())] });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);

    await expect(detalle.estado).toHaveText('Revocación parcial');
    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText(/Banco Central: sin confirmación, tiempo agotado a las \d{2}:\d{2}/);
    await expect(alerta).toContainText(/Banco Aliado: confirmó a las \d{2}:\d{2}/);
    await expect(detalle.revocar).toHaveCount(0);
    await expect(detalle.entidades.getByRole('row', { name: /Banco Central/ })).toContainText('Sin confirmación');
    await expect(detalle.entidades.getByRole('row', { name: /Banco Central/ })).toContainText(/Tiempo agotado a las \d{2}:\d{2}/);
    await expect(detalle.entidades.getByRole('row', { name: /Banco Aliado/ })).toContainText('Revocado');
    await verificarAccesibilidad(page);

    await detalle.reintentar.click();

    // POST sin cuerpo; la entidad vuelve a «Pendiente» y el seguimiento sondea hasta «Revocado».
    expect(peticiones.reintentos).toEqual([{ id: ID, cuerpo: null, claveIdempotencia: undefined }]);
    await expect(detalle.estado).toHaveText('Revocación parcial');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Reintento en curso');
    await expect(detalle.entidades.getByRole('row', { name: /Banco Central/ })).toContainText('Pendiente');
    await expect(detalle.reintentar).toHaveCount(0);
    await verificarAccesibilidad(page);
    await expect(detalle.estado).toHaveText('Revocado', UN_CICLO_DE_SONDEO);
    await expect(detalle.entidades.getByRole('row', { name: /Banco Central/ })).toContainText('Revocado');
    await verificarAccesibilidad(page);
  });

  test('un consentimiento revocado o vencido no ofrece «Revocar» y dice por qué (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await detalle.simularGateway({ lecturas: [ok(revocadoDesdeApp()), ok(vencido())] });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);
    await expect(detalle.estado).toHaveText('Revocado');
    await expect(detalle.revocar).toHaveCount(0);
    await expect(page.getByText(/ya está revocado: no se puede revocar de nuevo/)).toBeVisible();
    const registro = page.getByRole('region', { name: 'Registro de la operación' });
    await expect(registro).toContainText('El titular desde la app');
    await expect(registro).toContainText('App móvil');
    await expect(registro).not.toContainText('Motivo');
    await verificarAccesibilidad(page);

    await page.reload();
    await expect(detalle.estado).toHaveText('Vencido');
    await expect(detalle.revocar).toHaveCount(0);
    await expect(page.getByText(/está vencido: no hay nada que revocar/)).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('si el titular lo revoca mientras el modal está abierto, el 409 cierra el modal y avisa (CA-4)', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    const peticiones = await detalle.simularGateway({
      lecturas: [ok(activo()), ok(revocadoDesdeApp())],
      revocaciones: [errorHttp(409, 'consent_already_revoked')],
    });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);
    await detalle.revocar.click();
    await detalle.completarModal();
    await detalle.revocarAhora.click();

    await expect(detalle.modal).toBeHidden();
    await expect(page.getByRole('status')).toContainText('ya fue revocado mientras confirmabas');
    await expect(detalle.estado).toHaveText('Revocado');
    await expect(detalle.revocar).toHaveCount(0);
    expect(peticiones.revocaciones).toHaveLength(1);
    expect(peticiones.lecturas).toEqual([ID, ID]);
    await verificarAccesibilidad(page);
  });

  test('un 503 al revocar conserva lo diligenciado y reenvía la misma Idempotency-Key (resiliencia)', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    const peticiones = await detalle.simularGateway({
      lecturas: [ok(activo())],
      revocaciones: [errorHttp(503, 'service_unavailable'), ok(enCurso(), 201)],
    });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);
    await detalle.revocar.click();
    await detalle.completarModal();
    await detalle.revocarAhora.click();

    await expect(detalle.modal.getByRole('alert')).toContainText('no se cambió nada');
    await expect(detalle.referencia).toHaveValue('TCK-2026-0412');
    await expect(detalle.casillaRol).toBeChecked();
    await expect(detalle.estado).toHaveText('Activo');
    await verificarAccesibilidad(page);
    await detalle.revocarAhora.click();

    await expect(detalle.estado).toHaveText('Revocación en curso');
    expect(peticiones.revocaciones).toHaveLength(2);
    expect(peticiones.revocaciones[0].claveIdempotencia).toMatch(UUID);
    expect(peticiones.revocaciones[1].claveIdempotencia).toBe(peticiones.revocaciones[0].claveIdempotencia);
  });

  test('un 503 al cargar el detalle muestra el error con «Reintentar»', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await detalle.simularGateway({ lecturas: [errorHttp(503, 'service_unavailable'), ok(activo())] });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);

    await expect(page.getByRole('alert')).toContainText('El servicio de auditoría no respondió');
    await verificarAccesibilidad(page);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(detalle.titulo).toHaveText(`Consentimiento ${ID}`);
    await expect(detalle.estado).toHaveText('Activo');
  });

  test('solo el analista de operaciones entra y un 403 del gateway lleva a «no autorizado» (CA-6)', async ({ page }) => {
    await simularCognito(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await detalle.simularGateway({ lecturas: [errorHttp(403, 'forbidden')] });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);
    await expect(page).toHaveURL(/\/acceso\/no-autorizado/);

    for (const rol of ['asesor', 'asegurado'] as const) {
      const otra = await page.context().newPage();
      await simularCognito(otra);
      const peticiones = await new DetalleConsentimientoPagina(otra).simularGateway({ lecturas: [ok(activo())] });
      await new DetalleConsentimientoPagina(otra).abrirComo(`/auditoria/consentimientos/${ID}`, rol);
      await expect(otra).toHaveURL(/\/acceso\/no-autorizado/);
      expect(peticiones.lecturas).toEqual([]);
    }
  });

  test('un enlace directo inexistente muestra «no encontrado» y lleva al listado', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await listado.simularListado();
    await detalle.simularGateway({ lecturas: [noEncontrado()] });

    await detalle.abrirComo(`/auditoria/consentimientos/${ID}`);

    await expect(page.getByRole('heading', { name: 'No encontramos este consentimiento' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Por seguridad no se muestra información interna del sistema.');
    await verificarAccesibilidad(page);
    await page.getByRole('link', { name: 'Buscar otro' }).click();
    await expect(page).toHaveURL('/auditoria/consentimientos');
    await expect(listado.titulo).toHaveText('Consentimientos Open Finance');
  });

  test('una falla del servicio en el listado deja reintentar y luego abrir el detalle', async ({ page }) => {
    await simularCognito(page);
    const listado = new ListadoConsentimientosPagina(page);
    const detalle = new DetalleConsentimientoPagina(page);
    await listado.simularListado([errorHttp(503, 'service_unavailable'), respuesta(pagina())]);
    await detalle.simularGateway({ lecturas: [ok(activo())] });

    await detalle.abrirComo('/auditoria/consentimientos');

    await expect(page.getByRole('alert')).toContainText('No pudimos cargar los consentimientos');
    await verificarAccesibilidad(page);
    await listado.reintentar.click();
    await listado.ver(ID).click();
    await expect(page).toHaveURL(`/auditoria/consentimientos/${ID}`);
    await expect(detalle.estado).toHaveText('Activo');
  });
});
