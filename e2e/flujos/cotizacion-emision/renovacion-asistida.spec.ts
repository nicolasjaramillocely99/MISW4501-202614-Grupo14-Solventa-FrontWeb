import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  CODIGO_ENVIADO,
  EMISION_NUEVA,
  POLIZA,
  RECOTIZACION_BASE,
  RECOTIZACION_CACHE,
  delAsegurado,
  error,
  formalizacion,
  formalizada,
  fueraDeVentana,
  pagoFallido,
  recotizacion,
  recotizada,
  renovada,
  vista,
} from '../../fixtures/renovaciones';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { RenovacionAsistidaPagina } from '../../paginas/renovacion-asistida.pagina';

/**
 * Renovación asistida con recotización del asesor (HU-W1.5-03, pantallas S7 y S7b). Cognito y el API Gateway se simulan
 * con `page.route`; la sesión es la de un asesor comercial. Cada estado pasa la verificación de accesibilidad (axe).
 */
const RUTA = `/originacion/renovaciones/${POLIZA}`;
const ok = (cuerpo: unknown, estado = 200) => ({ estado, cuerpo });

test.describe('Renovación asistida del asesor (HU-W1.5-03)', () => {
  test.beforeEach(async ({ page }) => {
    await simularCognito(page);
  });

  test('E1 · recotiza, registra la llamada grabada y formaliza hasta la póliza renovada (CA-1 a CA-4)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const llamadas = await s7.simularGateway({
      vista: [ok(vista()), ok(recotizada()), ok(renovada())],
      recotizar: ok(recotizacion(), 201),
      formalizar: ok(formalizada(), 201),
      emision: ok(EMISION_NUEVA),
    });

    await s7.abrirComo(RUTA);

    await expect(s7.titulo).toHaveText(`Renovación asistida · ${POLIZA}`);
    await expect(s7.subtitulo).toContainText('Carolina Pérez Ruiz · 1.020.345.678 · Vida hipotecario · sin recotizar');
    await expect(page.getByText('Vence el 02/10/2026')).toBeVisible();
    await expect(s7.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.recotizar.click();
    await expect(s7.subtitulo).toContainText(/Recotizada el .* con el motor de rating/);
    expect(llamadas.recotizaciones).toEqual([{}]);
    await expect(s7.comparativo).toContainText(/149\.800\sCOP \(\+5,3\s?%\)/);
    await expect(s7.comparativo).toContainText('02/10/2026 → 02/10/2027');
    await expect(s7.prima).toContainText(/149\.800\sCOP/);
    await expect(s7.fuente('Open Finance')).toContainText('Consultado · 96 ms');
    await expect(s7.fuente('Open Finance')).toContainText('Operativo');
    await expect(s7.fuente('Motor de rating')).toContainText('Versión v1 · edad, riesgo y plazo');
    await expect(s7.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.aceptarPorLlamada();
    await expect(s7.formalizar).toBeEnabled();
    await s7.formalizar.click();

    await expect(s7.titulo).toHaveText(`Renovación formalizada · ${POLIZA}`);
    expect(llamadas.formalizaciones).toEqual([
      {
        requote_id: recotizacion().requote_id,
        acceptance: expect.objectContaining({ method: 'recorded_call', reference: 'GRAB-2026-88931' }),
      },
    ]);
    await expect(s7.subtitulo).toContainText(/renovada el .* por Laura Gómez/);
    await expect(page.getByRole('heading', { name: 'Aceptación registrada' })).toBeVisible();
    await expect(page.getByText('GRAB-2026-88931')).toBeVisible();

    // El cobro se confirma: la pantalla lo sigue cada 2 s y muestra la póliza nueva con su certificado.
    await expect(page.getByText('Renovada', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(s7.paso('Cobro de la prima')).toContainText('Confirmado · Visa •••• 1111');
    await expect(s7.paso('Certificado renovado')).toContainText('Póliza nueva pol-ren-118204');
    await expect(s7.paso('Certificado renovado')).toContainText('Emitido');
    await expect(s7.paso('Notificación al cliente')).toContainText('Enviada');
    await expect(page.getByRole('button', { name: 'Ver certificado' })).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('E2 · la aceptación incompleta o inválida no deja formalizar y marca cada campo (CA-2)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const llamadas = await s7.simularGateway({
      vista: ok(recotizada()),
      formalizar: ok(error('validation_failed', { fields: [{ field: 'acceptance.reference', code: 'invalid_format' }] }), 422),
    });
    await s7.abrirComo(RUTA);
    await expect(s7.formalizar).toBeDisabled();

    await s7.referencia.fill('GRAB 1;');
    await s7.referencia.blur();
    await expect(page.getByText(/Hasta 64 caracteres/)).toBeVisible();
    await s7.referencia.fill('');
    await s7.referencia.blur();
    await expect(page.getByText('Indica la referencia de la grabación o de la firma.')).toBeVisible();
    await s7.fecha.fill('2099-01-01T10:00');
    await s7.fecha.blur();
    await expect(page.getByText('La fecha no puede ser futura ni anterior a la recotización.')).toBeVisible();
    await s7.casillaAceptacion.check();
    await s7.casillaAceptacion.uncheck();
    await expect(page.getByText('Confirma que el cliente aceptó y autorizó el cobro.')).toBeVisible();
    await expect(s7.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);

    // El servicio valida lo mismo: sus errores por campo se marcan y no se crea nada.
    await s7.fecha.fill('2026-09-16T16:05');
    await s7.aceptarPorLlamada('GRAB-2026-88931');
    await s7.formalizar.click();
    await expect(s7.referencia).toHaveAttribute('aria-invalid', 'true');
    expect(llamadas.formalizaciones).toHaveLength(1);
    await expect(s7.titulo).toHaveText(`Renovación asistida · ${POLIZA}`);
  });

  test('E3 · en modo degradado avisa el perfil en caché con su fecha o el actuarial base (CA-5, D-7)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({
      vista: [ok(vista()), ok(recotizada(RECOTIZACION_CACHE)), ok(recotizada(RECOTIZACION_BASE))],
      recotizar: [ok(RECOTIZACION_CACHE, 201), ok(RECOTIZACION_BASE, 201)],
    });
    await s7.abrirComo(RUTA);

    await s7.recotizar.click();
    await expect(page.getByText('Modo degradado', { exact: true })).toBeVisible();
    await expect(s7.subtitulo).toContainText(/Recotizada el .* en modo degradado/);
    await expect(page.getByText(/usó el último perfil del cliente en caché, del 27\/08\/2026/)).toBeVisible();
    await expect(s7.fuente('Open Finance')).toContainText('No disponible');
    await expect(s7.fuente('Open Finance')).toContainText('Sin respuesta · corte a los 120 ms');
    await verificarAccesibilidad(page);

    await s7.recotizar.click();
    await expect(page.getByText(/no hay un perfil reciente en caché: la recotización usó el perfil actuarial base/)).toBeVisible();
    await expect(page.getByText('Modo degradado', { exact: true })).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('E4 · la recotización vencida o reemplazada pide recotizar', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({
      vista: [ok(recotizada(recotizacion({ status: 'expired' }))), ok(recotizada())],
      recotizar: ok(recotizacion(), 201),
      formalizar: ok(error('requote_superseded'), 409),
    });
    await s7.abrirComo(RUTA);

    await expect(page.getByText('La recotización venció')).toBeVisible();
    await expect(s7.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.recotizar.click();
    await expect(page.getByText('La recotización venció')).toBeHidden();
    await s7.aceptarPorLlamada();
    await s7.formalizar.click();
    await expect(page.getByText('Hay una recotización más reciente')).toBeVisible();
    await expect(s7.formalizar).toBeDisabled();
  });

  test('E4 · si otro asesor formalizó primero lo dice y muestra su renovación (409)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({
      vista: [ok(recotizada()), ok(formalizada({ formalization: formalizacion({ advisor_name: 'Andrés Rojas' }) }))],
      formalizar: ok(error('already_formalized'), 409),
    });
    await s7.abrirComo(RUTA);

    await s7.aceptarPorLlamada();
    await s7.formalizar.click();

    await expect(s7.alerta).toContainText('Otro asesor ya formalizó esta renovación.');
    await expect(s7.titulo).toHaveText(`Renovación en curso · ${POLIZA}`);
    await expect(s7.subtitulo).toContainText('por Andrés Rojas');
    await verificarAccesibilidad(page);
  });

  test('E4 · si el asegurado renovó primero queda en solo lectura (409)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({
      vista: [ok(recotizada()), ok(delAsegurado())],
      formalizar: ok(error('renewal_closed'), 409),
    });
    await s7.abrirComo(RUTA);

    await s7.aceptarPorLlamada();
    await s7.formalizar.click();

    await expect(s7.alerta).toContainText('El cliente ya renovó este periodo desde su portal.');
    await expect(page.getByText('El cliente renovó desde su portal')).toBeVisible();
    await expect(s7.recotizar).toHaveCount(0);
  });

  test('E5 · un asegurado no entra a la renovación asistida', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const llamadas = await s7.simularGateway({ vista: ok(vista()) });

    await s7.abrirComo(RUTA, 'asegurado');

    await expect(page).toHaveURL('/acceso/no-autorizado');
    expect(llamadas.vistas).toBe(0);
  });

  test('E6 · una póliza fuera de su ventana o inexistente no se renueva', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({ vista: [ok(fueraDeVentana()), ok(error('policy_not_found'), 404)] });
    await s7.abrirComo('/originacion/renovaciones/pol-acc-004512');

    await expect(page.getByText('Esta póliza todavía no se puede renovar')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('su ventana de renovación abre el');
    await expect(s7.recotizar).toHaveCount(0);
    await expect(s7.formalizar).toHaveCount(0);
    await verificarAccesibilidad(page);

    await page.reload();
    await expect(s7.titulo).toHaveText('No encontramos la póliza');
    await verificarAccesibilidad(page);
  });

  test('E7 · con el código de confirmación: enviar, reenviar, errores del código y formalizar (D-9)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const conCodigo = formalizada({
      formalization: formalizacion({
        acceptance: { method: 'confirmation_code', accepted_at: '2026-09-16T21:05:00Z', reference: null },
      }),
    });
    const llamadas = await s7.simularGateway({
      vista: ok(recotizada()),
      codigo: [ok(CODIGO_ENVIADO), ok(CODIGO_ENVIADO), ok(CODIGO_ENVIADO), ok(error('too_many_codes'), 429)],
      formalizar: [
        ok(error('invalid_confirmation_code'), 422),
        ok(error('confirmation_code_expired'), 422),
        ok(error('too_many_attempts'), 429),
        ok(conCodigo, 201),
      ],
    });
    await s7.abrirComo(RUTA);

    await s7.medio.selectOption('confirmation_code');
    await expect(s7.referencia).toHaveCount(0);
    await s7.enviarCodigo.click();
    await expect(page.getByRole('status').filter({ hasText: 'ca***@example.com' })).toContainText(/Enviado a ca\*\*\*@example\.com · vence a las/);
    expect(llamadas.codigos).toEqual([{ requote_id: recotizacion().requote_id }]);
    await s7.reenviarCodigo.click();
    await s7.reenviarCodigo.click();
    await expect(s7.reenviarCodigo).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.codigo.fill('4829');
    await s7.codigo.blur();
    await expect(page.getByText('El código tiene 6 dígitos.')).toBeVisible();
    await s7.codigo.fill('482913');
    await s7.casillaAceptacion.check();
    await s7.formalizar.click();
    await expect(page.getByText('El código no es el que recibió el cliente.')).toBeVisible();
    await s7.formalizar.click();
    await expect(page.getByText(/El código venció/)).toBeVisible();
    await s7.formalizar.click();
    await expect(page.getByText(/Se agotaron los intentos/)).toBeVisible();
    await verificarAccesibilidad(page);

    await s7.formalizar.click();
    await expect(s7.titulo).toHaveText(`Renovación formalizada · ${POLIZA}`);
    expect(llamadas.formalizaciones.at(-1)).toEqual({
      requote_id: recotizacion().requote_id,
      acceptance: expect.objectContaining({ method: 'confirmation_code' }),
      confirmation_code: '482913',
    });
    await expect(page.getByText('Sin referencia (código de confirmación)')).toBeVisible();
  });

  test('E8 · sin consentimiento o sin poder verificarlo no recotiza (D-8)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const llamadas = await s7.simularGateway({
      vista: [ok(vista()), ok(recotizada())],
      recotizar: [ok(error('consent_required'), 422), ok(error('consent_unverifiable'), 503), ok(recotizacion(), 201)],
    });
    await s7.abrirComo(RUTA);

    await s7.recotizar.click();
    await expect(s7.alerta).toContainText('El cliente revocó su autorización de Open Finance');
    await expect(s7.fuente('Open Finance')).toContainText('Sin autorización');
    await expect(s7.formalizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.recotizar.click();
    await expect(s7.alerta).toContainText('No pudimos verificar la autorización del cliente');
    await expect(s7.fuente('Open Finance')).toContainText('Sin verificar');
    await verificarAccesibilidad(page);

    await s7.reintentar.click();
    await expect(s7.subtitulo).toContainText(/Recotizada el .* con el motor de rating/);
    expect(llamadas.recotizaciones).toHaveLength(3);
  });

  test('E8 · en una póliza vendida por un asesor «Recotizar» espera la casilla de consentimiento (D-13 c)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const afirmada = recotizacion({ consent_basis: 'advisor_affirmed', consent_affirmed_at: '2026-09-16T21:02:00Z' });
    const llamadas = await s7.simularGateway({
      vista: [ok(vista({ consent_mode: 'advisor_affirmation' })), ok(recotizada(afirmada))],
      recotizar: ok(afirmada, 201),
    });
    await s7.abrirComo(RUTA);

    await expect(page.getByText('Póliza vendida por un asesor')).toBeVisible();
    await expect(s7.subtitulo).toContainText('vendida por un asesor · sin recotizar');
    await expect(s7.fuente('Open Finance')).toContainText('Pendiente de la autorización');
    await expect(s7.recotizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.casillaConsentimiento.check();
    await expect(s7.recotizar).toBeEnabled();
    await s7.recotizar.click();

    await expect(s7.subtitulo).toContainText(/Recotizada el .* con el motor de rating/);
    expect(llamadas.recotizaciones).toEqual([{ consent_affirmed: true }]);
  });

  test('E8 · si el servicio pide la casilla (422) la muestra con su error y recotiza al marcarla (D-13 c)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const llamadas = await s7.simularGateway({
      vista: [ok(vista()), ok(recotizada())],
      recotizar: [
        ok(error('validation_failed', { fields: [{ field: 'consent_affirmed', code: 'required' }] }), 422),
        ok(recotizacion(), 201),
      ],
    });
    await s7.abrirComo(RUTA);

    await s7.recotizar.click();
    await expect(s7.casillaConsentimiento).toBeVisible();
    await expect(s7.alerta).toContainText('sin la autorización del cliente no se consulta ningún dato');
    await expect(s7.recotizar).toBeDisabled();
    await verificarAccesibilidad(page);

    await s7.casillaConsentimiento.check();
    await s7.recotizar.click();
    await expect(s7.subtitulo).toContainText(/Recotizada el .* con el motor de rating/);
    expect(llamadas.recotizaciones).toEqual([{}, { consent_affirmed: true }]);
  });

  test('E9 · sin medio de pago registrado no deja formalizar (D-10)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({
      vista: ok(vista({ requote: recotizacion(), payment_method: null, blocked_reason: 'payment_method_missing' })),
    });
    await s7.abrirComo(RUTA);

    await expect(page.getByText('La póliza no tiene un medio de pago registrado')).toBeVisible();
    await expect(s7.formalizar).toBeDisabled();
    await expect(s7.referencia).toBeDisabled();
    await verificarAccesibilidad(page);
  });

  test('E10 · «Ver» una renovación con el cobro en curso', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({ vista: ok(formalizada()) });
    await s7.abrirComo(RUTA);

    await expect(s7.titulo).toHaveText(`Renovación en curso · ${POLIZA}`);
    await expect(page.getByText('Renovación en curso', { exact: true })).toBeVisible();
    await expect(s7.paso('Cobro de la prima')).toContainText('En curso');
    await expect(s7.paso('Certificado renovado')).toContainText('Pendiente');
    await expect(s7.volverARenovaciones).toBeVisible();
    await verificarAccesibilidad(page);
  });

  test('E10 · «Ver» con el pago fallido dice la fecha y hasta cuándo puede reintentar el cliente (01·D-3 a+)', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    const llamadas = await s7.simularGateway({ vista: ok(pagoFallido()) });
    await s7.abrirComo(RUTA);

    await expect(s7.alerta).toContainText('El pago de la renovación falló');
    await expect(s7.alerta).toContainText(/El cobro del 16\/09\/2026.* fue rechazado/);
    await expect(s7.alerta).toContainText(/desde su portal hasta el 19\/09\/2026/);
    await expect(s7.paso('Cobro de la prima')).toContainText('Rechazado el 16/09/2026');
    await expect(s7.paso('Cobro de la prima')).toContainText('reintento hasta el 19/09/2026');
    await expect(s7.paso('Cobro de la prima')).toContainText('Falló');
    await verificarAccesibilidad(page);
    // Con el pago fallido la pantalla deja de consultar: el reintento es del cliente en su portal.
    await page.waitForTimeout(2_500);
    expect(llamadas.vistas).toBe(1);
  });

  test('E10 · la renovación del asegurado se ve en solo lectura con su cobro', async ({ page }) => {
    const s7 = new RenovacionAsistidaPagina(page);
    await s7.simularGateway({ vista: ok(delAsegurado()) });
    await s7.abrirComo(RUTA);

    await expect(page.getByText('El cliente renovó desde su portal')).toBeVisible();
    await expect(s7.subtitulo).toContainText('aceptada por el cliente en su portal el');
    await expect(s7.paso('Cobro de la prima')).toContainText('En curso');
    await expect(s7.recotizar).toHaveCount(0);
    await expect(s7.formalizar).toHaveCount(0);
    await verificarAccesibilidad(page);
  });
});
