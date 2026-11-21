import { render, screen, within } from '@testing-library/angular';
import { ResumenBandeja, mapearBandeja } from '@core/api/siniestros/asistencia.modelos';
import { BANDEJA_DTO, BANDEJA_SIN_DESPACHOS_DTO } from '@testing/asistencia-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { IndicadoresAsistenciasComponent } from './indicadores-asistencias.component';

describe('IndicadoresAsistenciasComponent (O9 · HU-W2.3-03, S2)', () => {
  const renderizar = (resumen: ResumenBandeja) =>
    render(IndicadoresAsistenciasComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { resumen },
    });

  const tarjeta = (titulo: string) => screen.getByText(titulo).closest('li') as HTMLElement;

  it('muestra las nuevas, las despachadas hoy y el tiempo medio con su objetivo', async () => {
    await renderizar(mapearBandeja(BANDEJA_DTO).resumen);

    expect(screen.getByRole('region', { name: 'Indicadores de hoy' })).toBeTruthy();
    expect(within(tarjeta('Nuevas')).getByText('2')).toBeTruthy();
    expect(within(tarjeta('Nuevas')).getByText('Llamadas entrantes')).toBeTruthy();
    expect(within(tarjeta('Despachadas hoy')).getByText('6')).toBeTruthy();
    expect(within(tarjeta('Despachadas hoy')).getByText('Con prestador despachado')).toBeTruthy();
    expect(within(tarjeta('Tiempo medio de despacho')).getByText('3 min 40 s')).toBeTruthy();
    expect(
      within(tarjeta('Tiempo medio de despacho')).getByText('Objetivo: menos de 5 min'),
    ).toBeTruthy();
    expect(screen.queryByText('Por encima del objetivo')).toBeNull();
  });

  it('sin despachos hoy lo dice en lugar de la media', async () => {
    await renderizar(mapearBandeja(BANDEJA_SIN_DESPACHOS_DTO).resumen);

    expect(within(tarjeta('Tiempo medio de despacho')).getByText('Sin despachos hoy')).toBeTruthy();
    expect(screen.queryByText('Por encima del objetivo')).toBeNull();
  });

  it('si la media no cumple el objetivo, lo dice en texto', async () => {
    await renderizar({ ...mapearBandeja(BANDEJA_DTO).resumen, tiempoMedioDespachoSegundos: 300 });

    expect(within(tarjeta('Tiempo medio de despacho')).getByText('5 min')).toBeTruthy();
    expect(screen.getByText('Por encima del objetivo')).toBeTruthy();
  });
});
