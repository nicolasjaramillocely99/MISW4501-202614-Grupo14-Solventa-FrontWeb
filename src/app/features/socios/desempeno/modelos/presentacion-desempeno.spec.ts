import { claveDuracion, fechaHoraColombia, horaColombia, partesDuracion } from './presentacion-desempeno';

describe('presentación del desempeño técnico (HU-W3.2-03)', () => {
  it('parte la duración en días, horas y minutos', () => {
    expect(partesDuracion(840)).toEqual({ dias: 0, horas: 0, minutos: 14 });
    expect(partesDuracion(2 * 3600 + 5 * 60)).toEqual({ dias: 0, horas: 2, minutos: 5 });
    expect(partesDuracion(26 * 3600)).toEqual({ dias: 1, horas: 2, minutos: 0 });
    expect(partesDuracion(20)).toEqual({ dias: 0, horas: 0, minutos: 1 });
  });

  it('elige cómo decir la duración', () => {
    expect(claveDuracion(partesDuracion(840))).toBe('minutos');
    expect(claveDuracion(partesDuracion(7500))).toBe('horas');
    expect(claveDuracion(partesDuracion(93600))).toBe('dias');
  });

  it('muestra el inicio en la hora de Colombia', () => {
    expect(fechaHoraColombia('2026-09-16T21:20:00Z', 'es-CO')).toBe('16/09/2026 16:20');
    expect(fechaHoraColombia('2026-09-17T03:30:00Z', 'es-CO')).toBe('16/09/2026 22:30');
    expect(horaColombia('2026-09-17T03:30:00Z', 'es-CO')).toBe('22:30');
    expect(fechaHoraColombia('no-es-fecha', 'es-CO')).toBe('');
    expect(horaColombia('no-es-fecha', 'es-CO')).toBe('');
  });
});
