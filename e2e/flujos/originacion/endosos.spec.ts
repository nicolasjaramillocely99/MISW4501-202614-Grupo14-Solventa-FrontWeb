import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import { POLIZA_CAROLINA, POLIZA_SIN_ENDOSOS, simularEndosos } from '../../fixtures/endosos';
import { simularCognito } from '../../fixtures/sesion-por-rol';
import { BandejaEndososPagina } from '../../paginas/bandeja-endosos.pagina';
import { DetalleEndosoPagina } from '../../paginas/detalle-endoso.pagina';
import { HistorialEndososPagina } from '../../paginas/historial-endosos.pagina';

/**
 * Endosos del analista de operaciones (HU-W1.4-02): O2 → O3 / O3b → O4. Cognito y el API Gateway se simulan con
 * `page.route`; el gateway guarda el estado de cada solicitud (`fixtures/endosos.ts`). Cada pantalla y estado pasa por axe.
 */
test.describe('Endosos del analista (HU-W1.4-02)', () => {
  test('revisa una solicitud de beneficiarios, la aplica y la ve en el historial (CA-1, CA-2, CA-3, CA-4)', async ({ page }) => {
    await simularCognito(page);
    const trafico = await simularEndosos(page);
    const o2 = new BandejaEndososPagina(page);
    const o3 = new DetalleEndosoPagina(page);
    const o4 = new HistorialEndososPagina(page);

    await o2.abrirComo();
    await expect(o2.titulo).toHaveText('Endosos');
    await expect(o2.indicadores).toContainText('1 lleva más de 24 h');
    await expect(o2.indicadores).toContainText('Documentos de identidad');
    await expect(o2.filas).toHaveCount(3);
    expect(trafico.consultas.at(-1)?.get('status')).toBe('pending');
    await verificarAccesibilidad(page);

    await o2.revisar('SOL-MOD-2026-0042').click();
    await expect(page).toHaveURL('/originacion/endosos/SOL-MOD-2026-0042');
    expect(trafico.tomadas).toEqual(['SOL-MOD-2026-0042']);
    await expect(o3.titulo).toHaveText('Endoso · SOL-MOD-2026-0042');
    await expect(o3.insignia).toHaveText('En revisión');
    await expect(o3.cambios).toHaveCount(3);
    await expect(o3.cambios.nth(0)).toContainText('Mateo Pérez Gómez · TI 1.140.223.001 · 60 %');
    await expect(o3.cambios.nth(1)).toContainText('Lucía Pérez Gómez · TI 1.142.998.310 · 40 %');
    await expect(o3.cambios.nth(2)).toContainText('Sin cambio');
    await expect(page.getByText('Cumple', { exact: true })).toHaveCount(5);
    await expect(o3.poliza).toContainText('1 · último: datos personales (16/09/2026)');
    await verificarAccesibilidad(page);

    await o3.aplicar.click();
    await expect(o3.aviso).toContainText('END-2026-0102 quedó registrado y el asegurado ya ve los cambios.');
    await expect(o3.insignia).toHaveText('Aplicada');
    await expect(page.getByText(/END-2026-0102 · aplicado por Andrés Ruiz \(operaciones\)/)).toBeVisible();
    await expect(o3.aplicar).toHaveCount(0);
    await expect(o3.poliza).toContainText('2 · último: beneficiarios');
    expect(trafico.aplicadas).toEqual(['SOL-MOD-2026-0042']);
    await verificarAccesibilidad(page);

    await o3.verHistorial.click();
    await expect(page).toHaveURL(`/originacion/polizas/${POLIZA_CAROLINA}/endosos`);
    await expect(o4.titulo).toHaveText('Historial de endosos');
    await expect(page.getByRole('link', { name: 'Endosos', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(o4.filas).toHaveCount(2);
    await expect(o4.filas.nth(0)).toContainText('END-2026-0102');
    await expect(o4.filas.nth(0)).toContainText('Mateo Pérez Gómez 60 % · Lucía Pérez Gómez 40 %');
    await expect(o4.filas.nth(0)).toContainText('Analista de operaciones');
    await expect(o4.filas.nth(1)).toContainText('END-2026-0099');
    await verificarAccesibilidad(page);
  });

  test('no aplica y devuelve al asegurado con sus observaciones (O3b, CA-2, CA-5)', async ({ page }) => {
    await simularCognito(page);
    const trafico = await simularEndosos(page);
    const o2 = new BandejaEndososPagina(page);
    const o3 = new DetalleEndosoPagina(page);

    await o2.abrirComo();
    await o2.continuar('SOL-MOD-2026-0043').click();
    await expect(o3.titulo).toHaveText('Endoso · SOL-MOD-2026-0043');

    await o3.aplicar.click();
    await expect(o3.insignia).toHaveText('No aplicado');
    await expect(o3.alerta).toContainText('La validación «Documentos de identidad válidos» no se cumple.');
    await expect(o3.validacion('Documentos de identidad válidos')).toContainText('No cumple');
    await expect(o3.validacion('Documentos de identidad válidos')).toContainText('TI 1.021.447.905 no encontrado');
    await expect(page.getByRole('heading', { name: 'Por qué no se aplicó' })).toBeVisible();
    await expect(o3.volverBandeja).toBeVisible();
    await verificarAccesibilidad(page);

    await o3.devolver.click();
    await expect(page.getByText('Escribe entre 10 y 500 caracteres: el asegurado los leerá.')).toBeVisible();
    await expect(o3.observaciones).toBeFocused();
    expect(trafico.cierres).toEqual([]);
    await verificarAccesibilidad(page);

    const motivo = 'El documento de Tomás no aparece en la Registraduría. Corrígelo y radica de nuevo.';
    await o3.observaciones.fill(motivo);
    await o3.devolver.click();
    await expect(o3.aviso).toContainText('Solicitud devuelta');
    await expect(page.getByText(/Andrés Ruiz lo devolvió al asegurado el/)).toBeVisible();
    await expect(page.getByText(motivo)).toBeVisible();
    await expect(o3.devolver).toHaveCount(0);
    expect(trafico.cierres).toEqual([{ solicitud: 'SOL-MOD-2026-0043', accion: 'return', cuerpo: { observations: motivo } }]);
    await verificarAccesibilidad(page);

    await o3.volverBandeja.click();
    await expect(o2.filas).toHaveCount(2);
    await o2.estado.selectOption('all');
    await expect(o2.filas.filter({ hasText: 'SOL-MOD-2026-0043' })).toContainText('Devuelta al asegurado');
  });

  test('un 503 no cambia nada y luego rechaza con observaciones (CA-2, CA-5)', async ({ page }) => {
    await simularCognito(page);
    const trafico = await simularEndosos(page, {
      aplicar: [
        { estado: 503, cuerpo: { error: 'validation_unverifiable', message: 'm', unverifiable: ['identity_documents_valid'] } },
      ],
    });
    const o3 = new DetalleEndosoPagina(page);

    await new BandejaEndososPagina(page).abrirComo('/originacion/endosos/SOL-MOD-2026-0042');
    await o3.aplicar.click();
    await expect(o3.alerta).toContainText('La verificación de documentos no respondió. No se cambió nada');
    await expect(o3.validacion('Documentos de identidad válidos')).toContainText('No verificable');
    await expect(o3.insignia).toHaveText('Radicada');
    await expect(o3.aplicar).toBeEnabled();
    await verificarAccesibilidad(page);

    const motivo = 'El parentesco declarado no permite esta designación.';
    await o3.observaciones.fill(motivo);
    await o3.rechazar.click();
    await expect(o3.aviso).toContainText('Solicitud rechazada');
    await expect(o3.insignia).toHaveText('Rechazada');
    await expect(page.getByText(/Rechazada por Andrés Ruiz \(operaciones\)/)).toBeVisible();
    await expect(page.getByText(/no se ejecutaron las validaciones/)).toBeVisible();
    expect(trafico.aplicadas).toEqual(['SOL-MOD-2026-0042']);
    expect(trafico.cierres).toEqual([{ solicitud: 'SOL-MOD-2026-0042', accion: 'rejection', cuerpo: { observations: motivo } }]);
    await verificarAccesibilidad(page);
  });

  test('consulta el historial en solo lectura, también sin endosos (CA-4)', async ({ page }) => {
    await simularCognito(page);
    await simularEndosos(page);
    const o4 = new HistorialEndososPagina(page);

    await new BandejaEndososPagina(page).abrirComo(`/originacion/polizas/${POLIZA_CAROLINA}/endosos`);
    await expect(o4.titulo).toHaveText('Historial de endosos');
    await expect(page.getByText('Solo lectura')).toBeVisible();
    await expect(page.getByText('Registro inmutable')).toBeVisible();
    await expect(o4.filas).toHaveCount(1);
    await expect(o4.filas.first()).toContainText('301 234 5678');
    await expect(o4.tabla.getByRole('button')).toHaveCount(0);
    await verificarAccesibilidad(page);

    await page.goto(`/originacion/polizas/${POLIZA_SIN_ENDOSOS}/endosos`);
    await expect(page.getByText('0 entradas · esta póliza no tiene endosos')).toBeVisible();
    await expect(o4.vacio).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await verificarAccesibilidad(page);
  });

  for (const rol of ['asegurado', 'asesor'] as const) {
    test(`${rol} no entra a la bandeja, al detalle ni al historial`, async ({ page }) => {
      await simularCognito(page);
      await simularEndosos(page);

      await new BandejaEndososPagina(page).abrirComo('/originacion/endosos', rol);
      await expect(page).toHaveURL('/acceso/no-autorizado');
      for (const ruta of ['/originacion/endosos/SOL-MOD-2026-0042', `/originacion/polizas/${POLIZA_CAROLINA}/endosos`]) {
        await page.goto(ruta);
        await expect(page).toHaveURL('/acceso/no-autorizado');
      }
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acceso no autorizado');
    });
  }
});
