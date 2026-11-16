import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import {
  POLIZA_AL_DIA_DTO,
  POLIZA_CANCELADA_DTO,
  POLIZA_EN_GRACIA_DTO,
} from '@testing/cancelacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { PolizaListada, mapearPolizaListada } from '@core/api/originacion/renovacion.modelos';

import { MisPolizasPage } from './mis-polizas.page';

// HU-W1.6-02: A1 con el estado del pago, la cancelación por no pago y el enlace al detalle.

describe('MisPolizasPage · pago y cancelación (A1 · HU-W1.6-02)', () => {
  const api = { listarPolizas: vi.fn<() => Observable<PolizaListada[]>>() };
  const LISTA = [POLIZA_AL_DIA_DTO, POLIZA_EN_GRACIA_DTO, POLIZA_CANCELADA_DTO].map(
    mapearPolizaListada,
  );

  async function renderizar() {
    api.listarPolizas.mockReturnValue(of(LISTA));
    return render(MisPolizasPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), { provide: OriginacionApiService, useValue: api }],
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const fila = (id: string) => screen.getByRole('link', { name: id }).closest('tr') as HTMLElement;

  it('una póliza en gracia es «Pago pendiente», sigue activa y avisa cuándo se cancela', async () => {
    await renderizar();

    expect(
      within(fila('pol-acc-330417')).getByText('Pago pendiente', {
        selector: 'app-insignia-estado',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Pólizas activas').nextElementSibling?.textContent).toBe('2');
    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('Tu póliza pol-acc-330417 tiene un pago pendiente');
    expect(aviso.textContent).toContain('1 de septiembre de 2026');
    expect(aviso.textContent).toContain('2 de octubre de 2026');
  });

  it('una póliza cancelada es «No pago», sin reembolso, y su vigencia termina en la cancelación', async () => {
    await renderizar();

    const cancelada = fila('pol-acc-093377');
    expect(
      within(cancelada).getByText('No pago', { selector: 'app-insignia-estado' }),
    ).toBeTruthy();
    expect(within(cancelada).getByText('Cancelada por no pago · sin reembolso')).toBeTruthy();
    expect(cancelada.textContent).toContain('12 de septiembre de 2026');
    expect(cancelada.textContent).not.toContain('2027');
  });

  it('cada póliza lleva a su detalle (A2)', async () => {
    await renderizar();

    expect(screen.getByRole('link', { name: 'pol-acc-093377' }).getAttribute('href')).toBe(
      '/originacion/polizas/pol-acc-093377',
    );
    expect(
      screen
        .getByRole('link', { name: 'Ver el detalle de la póliza pol-acc-093377' })
        .getAttribute('href'),
    ).toBe('/originacion/polizas/pol-acc-093377');
  });

  it('el filtro por estado ofrece «Pago pendiente» y «No pago»', async () => {
    await renderizar();

    const opciones = Array.from((screen.getByLabelText('Estado') as HTMLSelectElement).options).map(
      (o) => o.textContent?.trim(),
    );
    expect(opciones).toContain('Pago pendiente');
    expect(opciones).toContain('No pago');
  });
});
