import { render, screen } from '@testing-library/angular';
import { PAGINA_DTO } from '@testing/listado-consentimientos-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { mapearPaginaConsentimientos } from '@core/api/auditoria/listado-consentimientos.modelos';

import { IndicadoresConsentimientosComponent } from './indicadores-consentimientos.component';

describe('IndicadoresConsentimientosComponent (O14 · HU-W4.2-01)', () => {
  const indicadores = mapearPaginaConsentimientos(PAGINA_DTO).indicadores;

  it('muestra las cuatro tarjetas con los números del idioma activo (D-5 a)', async () => {
    await render(IndicadoresConsentimientosComponent, { imports: [proveerTranslocoPruebas()], inputs: { indicadores } });

    const region = screen.getByRole('region', { name: 'Indicadores de los consentimientos' });
    expect(region.textContent).toContain('Activos');
    expect(screen.getByText('1.284')).toBeTruthy();
    expect(screen.getByText('Vigentes hoy')).toBeTruthy();
    expect(screen.getByText('Revocados (30 días)')).toBeTruthy();
    expect(screen.getByText('37')).toBeTruthy();
    expect(screen.getByText('12 desde la app · 25 desde el portal')).toBeTruthy();
    expect(screen.getByText('112')).toBeTruthy();
    expect(screen.getByText('Sin renovación')).toBeTruthy();
    expect(screen.getByText('Revocaciones fuera de plazo')).toBeTruthy();
    expect(screen.getByText('0').classList).toContain('indicador__valor--exito');
    expect(screen.getByText('Objetivo: 100 % en ≤ 5 min')).toBeTruthy();
  });

  it('una revocación fuera de plazo no se pinta en verde', async () => {
    await render(IndicadoresConsentimientosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { indicadores: { ...indicadores, fueraDePlazo: 3 } },
    });

    expect(screen.getByText('3').classList).not.toContain('indicador__valor--exito');
  });

  it('en inglés usa el separador de miles del idioma', async () => {
    await render(IndicadoresConsentimientosComponent, {
      imports: [proveerTranslocoPruebas({ translocoConfig: { defaultLang: 'en-US' } })],
      inputs: { indicadores },
    });

    expect(screen.getByText('1,284')).toBeTruthy();
    expect(screen.getByText('12 from the app · 25 from the portal')).toBeTruthy();
  });
});
