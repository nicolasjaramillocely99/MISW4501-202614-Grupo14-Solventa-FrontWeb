import { render, screen, within } from '@testing-library/angular';
import { TRIAGE_OPERACIONES_DTO, TRIAGE_OPERACIONES_PENDIENTE_DTO } from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { TriageOperaciones, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { PrioridadTriageComponent } from './prioridad-triage.component';

const ASIGNADO = mapearTriageSiniestro(TRIAGE_OPERACIONES_DTO) as TriageOperaciones;

describe('PrioridadTriageComponent (O6 · HU-W2.2-01, CA-1 a CA-4)', () => {
  const renderizar = (triage: TriageOperaciones) =>
    render(PrioridadTriageComponent, { imports: [proveerTranslocoPruebas()], inputs: { triage } });

  it('resume el nivel con su severidad y su rango de monto', async () => {
    await renderizar(ASIGNADO);

    expect(screen.getByRole('heading', { level: 2, name: 'Prioridad' })).toBeTruthy();
    expect(screen.getByText('Triage 1 · severidad media · monto alto', { selector: 'span:not(.insignia)' })).toBeTruthy();
  });

  it('muestra monto, tipo, cobertura, objetivo, fecha y hora del cálculo y política', async () => {
    await renderizar(ASIGNADO);

    const datos = (nombre: string) => screen.getByText(nombre, { selector: 'dt' }).nextElementSibling as HTMLElement;
    expect(datos('Monto estimado').textContent).toMatch(/40\.000\.000 COP/);
    expect(datos('Tipo de siniestro').textContent).toBe('Daño por agua');
    expect(datos('Cobertura').textContent).toBe('Daño por agua');
    expect(datos('Objetivo de atención').textContent).toBe('Atención inmediata');
    expect(datos('Calculada el').textContent).toMatch(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/);
    expect(datos('Política').textContent).toBe('triage-policy-v1');
  });

  it('sin monto muestra «—»', async () => {
    const sinMonto: TriageOperaciones = {
      ...ASIGNADO,
      actual: ASIGNADO.actual ? { ...ASIGNADO.actual, montoEstimadoMinor: null, banda: 'unknown' } : null,
    };

    await renderizar(sinMonto);

    expect(screen.getByText('Monto estimado', { selector: 'dt' }).nextElementSibling?.textContent).toBe('—');
    expect(screen.getByText(/sin monto declarado/)).toBeTruthy();
  });

  it('un tipo o una cobertura que no conoce se muestra con su código', async () => {
    const nuevo: TriageOperaciones = {
      ...ASIGNADO,
      actual: ASIGNADO.actual ? { ...ASIGNADO.actual, tipoSiniestro: 'flood', cobertura: 'natural_events' } : null,
    };

    await renderizar(nuevo);

    expect(screen.getByText('flood')).toBeTruthy();
    expect(screen.getByText('natural_events')).toBeTruthy();
  });

  it('con pending dice «Calculando prioridad…» y no muestra ningún nivel', async () => {
    await renderizar(mapearTriageSiniestro(TRIAGE_OPERACIONES_PENDIENTE_DTO) as TriageOperaciones);

    const tarjeta = screen.getByRole('region', { name: 'Prioridad' });
    expect(within(tarjeta).getByRole('status').textContent).toContain('Calculando prioridad…');
    expect(within(tarjeta).queryByText(/Triage \d/)).toBeNull();
  });

  it('con not_applicable dice «Sin prioridad»', async () => {
    await renderizar({ ...ASIGNADO, estado: 'not_applicable', actual: null, historial: [] });

    expect(screen.getByText('Sin prioridad')).toBeTruthy();
    expect(screen.getByText(/no entró a evaluación/)).toBeTruthy();
  });
});
