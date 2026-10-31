import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { POLITICA_TRIAGE_DTO } from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { mapearPoliticaTriage } from '@core/api/siniestros/triage.modelos';

import { IndicadoresTriageComponent } from './indicadores-triage.component';

const POLITICA = mapearPoliticaTriage(POLITICA_TRIAGE_DTO);

describe('IndicadoresTriageComponent (O5 · HU-W2.2-01, CA-5)', () => {
  it('muestra una tarjeta por nivel con su objetivo, leído de la política', async () => {
    await render(IndicadoresTriageComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { estado: 'listo', politica: POLITICA },
    });

    const tarjetas = within(screen.getByRole('list')).getAllByRole('listitem');
    // La insignia y el objetivo son elementos distintos: el texto del nivel va siempre, no solo el color.
    expect(tarjetas.map((tarjeta) => tarjeta.textContent?.trim())).toEqual([
      'Triage 1Atención inmediata',
      'Triage 2Objetivo: 5 días hábiles',
      'Triage 3Objetivo: 10 días hábiles',
    ]);
  });

  it('si la política cambia de plazos, los indicadores cambian con ella (el front no los fija)', async () => {
    const otra = {
      ...POLITICA,
      objetivos: [{ nivel: 2 as const, objetivo: { tipo: 'business_days' as const, diasHabiles: 1, diasResolucion: 1 } }],
    };

    await render(IndicadoresTriageComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { estado: 'listo', politica: otra },
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Objetivo: 1 día hábil')).toBeTruthy();
  });

  it('cargando avisa que consulta la política', async () => {
    await render(IndicadoresTriageComponent, { imports: [proveerTranslocoPruebas()], inputs: { estado: 'cargando' } });

    expect(screen.getByRole('status').textContent).toContain('Consultando la política de prioridad');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('con error muestra su propio aviso y «Reintentar» emite', async () => {
    const reintentar = vi.fn();
    await render(IndicadoresTriageComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { estado: 'error' },
      on: { reintentar },
    });

    expect(screen.getByRole('alert').textContent).toContain('No pudimos consultar el objetivo de cada nivel');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(reintentar).toHaveBeenCalledTimes(1);
  });
});
