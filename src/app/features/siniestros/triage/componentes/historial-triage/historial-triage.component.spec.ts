import { render, screen, within } from '@testing-library/angular';
import { TRIAGE_OPERACIONES_DTO } from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { EntradaHistorialTriage, TriageOperaciones, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { HistorialTriageComponent } from './historial-triage.component';

const HISTORIAL = (mapearTriageSiniestro(TRIAGE_OPERACIONES_DTO) as TriageOperaciones).historial;

describe('HistorialTriageComponent (O6 · HU-W2.2-01, CA-3)', () => {
  const renderizar = (historial: readonly EntradaHistorialTriage[]) =>
    render(HistorialTriageComponent, { imports: [proveerTranslocoPruebas()], inputs: { historial } });

  const normalizar = (texto: string | null | undefined) => (texto ?? '').replace(/\s+/g, ' ').trim();

  it('lista del más reciente al más antiguo, cada cálculo con su fecha y hora', async () => {
    await renderizar(HISTORIAL);

    const filas = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(normalizar(filas[0].textContent)).toMatch(
      /^Prioridad recalculada: Triage 2 → Triage 1 · Cambió el monto estimado \d{2}\/\d{2}\/2026, \d{2}:\d{2}$/,
    );
    expect(normalizar(filas[1].textContent)).toMatch(/^Triage 2 asignado · automático \d{2}\/\d{2}\/2026, \d{2}:\d{2}$/);
  });

  it('una fila con previous_level igual al nivel dice que se mantiene', async () => {
    await renderizar([{ ...HISTORIAL[0], nivel: 1, nivelAnterior: 1, causas: ['coverage_changed'] }]);

    expect(normalizar(screen.getByRole('listitem').textContent)).toContain(
      'Prioridad revisada: se mantiene Triage 1 · Cambió la cobertura',
    );
  });

  it('une varias causas y deja cruda la que no conoce', async () => {
    await renderizar([
      { ...HISTORIAL[0], causas: ['provider_report_received', 'causa_nueva', 'policy_updated'] },
    ]);

    expect(screen.getByRole('listitem').textContent).toContain(
      'Llegó el informe del prestador, causa_nueva, Cambió la política de prioridad',
    );
  });

  it('un actor que no conoce se muestra crudo', async () => {
    await renderizar([{ ...HISTORIAL[1], actor: 'asesor' }]);

    expect(screen.getByRole('listitem').textContent).toContain('Triage 2 asignado · asesor');
  });

  it('cada fila lleva un ícono decorativo además del texto', async () => {
    await renderizar(HISTORIAL);

    for (const fila of screen.getAllByRole('listitem')) {
      expect(fila.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('sin cálculos dice que aún no hay', async () => {
    await renderizar([]);

    expect(screen.getByText('Aún no hay cálculos de prioridad.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
