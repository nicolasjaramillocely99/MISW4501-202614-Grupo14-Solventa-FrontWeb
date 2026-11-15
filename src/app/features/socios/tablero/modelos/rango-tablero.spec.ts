import {
  diaEnColombia,
  diasDelRango,
  opcionMasAmplia,
  problemaDelRango,
  rangoDeOpcion,
  sumarDias,
} from './rango-tablero';

describe('rangos del tablero del socio (HU-W3.2-01)', () => {
  it('toma el día de Colombia aunque en UTC ya sea el día siguiente', () => {
    expect(diaEnColombia(new Date('2026-09-17T03:30:00Z'))).toBe('2026-09-16');
    expect(diaEnColombia(new Date('2026-09-17T05:00:00Z'))).toBe('2026-09-17');
  });

  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-09-16', -29)).toBe('2026-08-18');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('las opciones fijas incluyen hoy y cuentan sus días hacia atrás (CA-2)', () => {
    expect(rangoDeOpcion('hoy', '2026-09-16')).toEqual({ desde: '2026-09-16', hasta: '2026-09-16' });
    expect(rangoDeOpcion('ultimos7', '2026-09-16')).toEqual({ desde: '2026-09-10', hasta: '2026-09-16' });
    expect(rangoDeOpcion('ultimos30', '2026-09-16')).toEqual({ desde: '2026-08-18', hasta: '2026-09-16' });
    expect(diasDelRango(rangoDeOpcion('ultimos30', '2026-09-16'))).toBe(30);
  });

  it('el personalizado incluye los dos días y no admite la inicial después de la final (CA-2)', () => {
    expect(problemaDelRango('2026-09-01', '2026-09-15')).toBeNull();
    expect(problemaDelRango('2026-09-16', '2026-09-16')).toBeNull();
    expect(problemaDelRango('2026-09-16', '2026-09-15')).toBe('invertido');
    expect(problemaDelRango('', '2026-09-15')).toBe('incompleto');
    expect(problemaDelRango('2025-09-15', '2026-09-16')).toBe('muyLargo');
    expect(problemaDelRango('2025-09-16', '2026-09-16')).toBeNull();
  });

  it('sin datos sugiere la opción más amplia siguiente', () => {
    expect(opcionMasAmplia('hoy')).toBe('ultimos7');
    expect(opcionMasAmplia('ultimos7')).toBe('ultimos30');
    expect(opcionMasAmplia('ultimos30')).toBeNull();
    expect(opcionMasAmplia('personalizado')).toBeNull();
  });
});
