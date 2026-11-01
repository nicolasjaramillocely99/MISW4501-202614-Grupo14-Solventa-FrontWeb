import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { FormatoFechaHoraPipe } from './formato-fecha-hora.pipe';
import { FormatoNumeroPipe } from './formato-numero.pipe';

describe('FormatoNumeroPipe y modos de hora con milisegundos (Intl)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [proveerTranslocoPruebas()] }));

  const crear = <T>(tipo: new () => T): T => TestBed.runInInjectionContext(() => new tipo());

  it('formatea el número en el idioma activo con hasta los decimales pedidos', () => {
    const pipe = crear(FormatoNumeroPipe);

    expect(pipe.transform(0.82)).toBe('0,82');
    expect(pipe.transform(0.000280123, 6)).toBe('0,00028');
    TestBed.inject(TranslocoService).setActiveLang('en-US');
    expect(pipe.transform(0.82)).toBe('0.82');
  });

  it('devuelve vacío sin valor', () => {
    const pipe = crear(FormatoNumeroPipe);

    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(Number.NaN)).toBe('');
  });

  it('muestra la hora con milisegundos y la fecha con zona horaria', () => {
    const pipe = crear(FormatoFechaHoraPipe);

    expect(pipe.transform('2026-10-20T15:04:05.120Z', 'horaMs')).toMatch(/^\d{2}:\d{2}:\d{2}[.,]120$/);
    expect(pipe.transform('2026-10-20T15:04:05.120Z', 'fechaHoraZona')).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}[.,]120 \S+/);
  });
});
