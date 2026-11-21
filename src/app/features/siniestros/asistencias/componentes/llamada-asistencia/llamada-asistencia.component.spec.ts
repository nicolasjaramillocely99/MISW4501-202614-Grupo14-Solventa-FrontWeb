import { render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { EstadoAsistencia } from '@core/api/siniestros/asistencia.modelos';

import { LlamadaAsistenciaComponent, TIC_CRONOMETRO_MS } from './llamada-asistencia.component';

const INICIO = '2026-11-21T16:16:00Z';
const ANALISTA = { correo: 'operaciones.local@example.com', nombre: 'Andrés Ruiz' };

describe('LlamadaAsistenciaComponent (O9b · HU-W2.3-03, S9)', () => {
  afterEach(() => vi.useRealTimers());

  const renderizar = (estado: EstadoAsistencia, inicio: string | null = INICIO) =>
    render(LlamadaAsistenciaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { estado, inicio, atendidaPor: ANALISTA },
    });

  it('en llamada: el cronómetro avanza cada segundo, sin anuncios, y dice quién atiende', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-21T16:18:14Z') });
    const { fixture } = await renderizar('in_call');

    expect(screen.getByRole('heading', { name: 'Llamada en curso' })).toBeTruthy();
    const cronometro = screen.getByRole('timer', { name: 'Duración de la llamada' });
    expect(cronometro.textContent?.trim()).toBe('02:14');
    expect(cronometro.getAttribute('aria-live')).toBe('off');
    expect(screen.getByText('Atendida por Andrés Ruiz')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(TIC_CRONOMETRO_MS);
    fixture.detectChanges();
    expect(cronometro.textContent?.trim()).toBe('02:15');

    await vi.advanceTimersByTimeAsync(TIC_CRONOMETRO_MS * 60);
    fixture.detectChanges();
    expect(cronometro.textContent?.trim()).toBe('03:15');
  });

  it('deja de contar al destruirse', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-21T16:18:14Z') });
    const { fixture } = await renderizar('in_call');

    expect(vi.getTimerCount()).toBe(1);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('deja de contar cuando la llamada termina (despachada)', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-21T16:18:14Z') });
    const { fixture } = await renderizar('in_call');

    fixture.componentRef.setInput('estado', 'dispatched');
    fixture.detectChanges();

    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('sin el inicio en el historial no muestra un tiempo inventado', async () => {
    await renderizar('in_call', null);

    expect(screen.getByRole('heading', { name: 'Llamada en curso' })).toBeTruthy();
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('nueva: «Llamada entrante» con la indicación de atenderla', async () => {
    await renderizar('new', null);

    expect(screen.getByRole('heading', { name: 'Llamada entrante' })).toBeTruthy();
    expect(
      screen.getByText('Atiende la solicitud para registrar la necesidad y despachar.'),
    ).toBeTruthy();
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it.each(['dispatched', 'closed'] as const)('%s: no se muestra', async (estado) => {
    await renderizar(estado);

    expect(screen.queryByRole('heading')).toBeNull();
  });
});
