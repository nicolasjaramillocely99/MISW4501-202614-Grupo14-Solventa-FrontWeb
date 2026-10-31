import { Observable, Subject, of, throwError } from 'rxjs';

import { EmisionSondeo, sondearMientrasPendiente } from './sondeo-triage';

describe('sondearMientrasPendiente (HU-W2.2-01, S1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function correr<T>(consulta: () => Observable<T>, esPendiente: (valor: T) => boolean) {
    const emisiones: EmisionSondeo<T>[] = [];
    const estado = { completo: false, error: null as unknown };
    const suscripcion = sondearMientrasPendiente(consulta, esPendiente).subscribe({
      next: (emision) => emisiones.push(emision),
      complete: () => (estado.completo = true),
      error: (error: unknown) => (estado.error = error),
    });
    return { emisiones, estado, suscripcion };
  }

  it('si la primera lectura ya no está pendiente emite al-dia y completa sin esperar', () => {
    const consulta = vi.fn(() => of('listo'));

    const { emisiones, estado } = correr(consulta, () => false);

    expect(emisiones).toEqual([{ valor: 'listo', actualizacion: 'al-dia' }]);
    expect(estado.completo).toBe(true);
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('sale de pending: pide cada 5 s y completa cuando deja de estar pendiente', async () => {
    const respuestas = ['pending', 'pending', 'assessed'];
    const consulta = vi.fn(() => of(respuestas[consulta.mock.calls.length - 1]));

    const { emisiones, estado } = correr(consulta, (valor) => valor === 'pending');

    expect(emisiones.map((e) => e.actualizacion)).toEqual(['sondeando']);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(consulta).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(consulta).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(emisiones).toEqual([
      { valor: 'pending', actualizacion: 'sondeando' },
      { valor: 'pending', actualizacion: 'sondeando' },
      { valor: 'assessed', actualizacion: 'al-dia' },
    ]);
    expect(estado.completo).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(consulta).toHaveBeenCalledTimes(3);
  });

  it('not_applicable corta el sondeo (no es pendiente)', () => {
    const { emisiones, estado } = correr(
      () => of('not_applicable'),
      (valor) => valor === 'pending',
    );

    expect(emisiones).toEqual([{ valor: 'not_applicable', actualizacion: 'al-dia' }]);
    expect(estado.completo).toBe(true);
  });

  it('el primer error se propaga: aún no hay nada que mostrar', () => {
    const { emisiones, estado } = correr(
      () => throwError(() => new Error('503')),
      () => true,
    );

    expect(emisiones).toEqual([]);
    expect(estado.error).toBeInstanceOf(Error);
  });

  it('tres fallos seguidos detienen el sondeo con la última lectura', async () => {
    let llamadas = 0;
    const consulta = () => (++llamadas === 1 ? of('pending') : throwError(() => new Error('503')));

    const { emisiones, estado } = correr(consulta, () => true);
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(estado.completo).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(emisiones.at(-1)).toEqual({ valor: 'pending', actualizacion: 'detenido' });
    expect(estado.completo).toBe(true);
    expect(llamadas).toBe(4);
  });

  it('un fallo aislado no corta el sondeo y reinicia la cuenta', async () => {
    const pasos = ['ok', 'fallo', 'ok', 'fallo', 'fallo', 'listo'];
    let llamadas = 0;
    const consulta = () => {
      const paso = pasos[llamadas++];
      return paso === 'fallo' ? throwError(() => new Error('503')) : of(paso);
    };

    const { emisiones, estado } = correr(consulta, (valor) => valor !== 'listo');
    await vi.advanceTimersByTimeAsync(5_000 * 5);

    expect(emisiones.at(-1)).toEqual({ valor: 'listo', actualizacion: 'al-dia' });
    expect(estado.completo).toBe(true);
    expect(llamadas).toBe(6);
  });

  it('se detiene a los 90 s sin salir de pending', async () => {
    const consulta = vi.fn(() => of('pending'));

    const { emisiones, estado } = correr(consulta, () => true);
    await vi.advanceTimersByTimeAsync(89_000);
    expect(estado.completo).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(estado.completo).toBe(true);
    expect(emisiones.at(-1)).toEqual({ valor: 'pending', actualizacion: 'detenido' });
    expect(consulta.mock.calls.length).toBeLessThanOrEqual(19);
    const llamadas = consulta.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(consulta).toHaveBeenCalledTimes(llamadas);
  });

  it('al cancelar la suscripción se cancela la espera y la lectura en curso', async () => {
    const lectura = new Subject<string>();
    const consulta = vi.fn(() => lectura);

    const { suscripcion } = correr(consulta, () => true);
    suscripcion.unsubscribe();
    lectura.next('pending');
    await vi.advanceTimersByTimeAsync(60_000);

    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('cancelar durante la espera evita la siguiente lectura', async () => {
    const consulta = vi.fn(() => of('pending'));

    const { suscripcion } = correr(consulta, () => true);
    await vi.advanceTimersByTimeAsync(5_000);
    suscripcion.unsubscribe();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(consulta).toHaveBeenCalledTimes(2);
  });
});
