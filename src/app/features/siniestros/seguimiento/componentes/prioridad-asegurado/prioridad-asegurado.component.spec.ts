import { render, screen } from '@testing-library/angular';
import { TRIAGE_ASEGURADO_DTO, TRIAGE_ASEGURADO_PENDIENTE_DTO } from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { TriageAsegurado, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { PrioridadAseguradoComponent } from './prioridad-asegurado.component';

describe('PrioridadAseguradoComponent (A8 mínima · HU-W2.2-01, CA-4)', () => {
  const renderizar = (triage: TriageAsegurado) =>
    render(PrioridadAseguradoComponent, { imports: [proveerTranslocoPruebas()], inputs: { triage } });

  it('muestra el nivel y el tiempo estimado de resolución en días hábiles', async () => {
    const { container } = await renderizar(mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO) as TriageAsegurado);

    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Prioridad Triage 3 Tiempo estimado de resolución: 10 días hábiles',
    );
  });

  it('usa la forma singular con un solo día hábil', async () => {
    await renderizar({
      ...(mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO) as TriageAsegurado),
      nivel: 1,
      diasResolucion: 1,
    });

    expect(screen.getByText('Tiempo estimado de resolución: 1 día hábil')).toBeTruthy();
  });

  it('no muestra severidad, rango de monto ni historial', async () => {
    const { container } = await renderizar(mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO) as TriageAsegurado);

    expect(container.textContent).not.toMatch(/severidad|monto|historial/i);
  });

  it('con pending dice «Calculando prioridad…» y no muestra ningún nivel', async () => {
    await renderizar(mapearTriageSiniestro(TRIAGE_ASEGURADO_PENDIENTE_DTO) as TriageAsegurado);

    expect(screen.getByRole('status').textContent).toContain('Calculando prioridad…');
    expect(screen.queryByText(/Triage \d/)).toBeNull();
  });

  it('con not_applicable no pinta nada', async () => {
    const { container } = await renderizar({
      ...(mapearTriageSiniestro(TRIAGE_ASEGURADO_PENDIENTE_DTO) as TriageAsegurado),
      estado: 'not_applicable',
    });

    expect(container.textContent?.trim()).toBe('');
  });
});
