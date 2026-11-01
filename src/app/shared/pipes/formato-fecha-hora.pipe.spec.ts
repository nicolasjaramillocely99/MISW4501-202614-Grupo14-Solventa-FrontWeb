import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { FormatoFechaHoraPipe } from './formato-fecha-hora.pipe';

describe('FormatoFechaHoraPipe', () => {
  let pipe: FormatoFechaHoraPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [proveerTranslocoPruebas()] });
    pipe = TestBed.runInInjectionContext(() => new FormatoFechaHoraPipe());
  });

  it('muestra día, mes, año y hora de 24 horas en es-CO', () => {
    const local = new Date(2026, 8, 16, 14, 5);

    expect(pipe.transform(local)).toMatch(/^16\/09\/2026,? 14:05$/);
  });

  it('cambia el orden al cambiar a inglés', () => {
    TestBed.inject(TranslocoService).setActiveLang('en-US');

    expect(pipe.transform(new Date(2026, 8, 16, 14, 5))).toMatch(/^09\/16\/2026,? 14:05$/);
  });

  it('muestra solo la hora en el modo hora', () => {
    expect(pipe.transform(new Date(2026, 8, 16, 9, 7), 'hora')).toBe('09:07');
  });

  it('acepta RFC 3339 con fracción de segundo de siete dígitos', () => {
    expect(pipe.transform('2026-10-12T01:54:41.0909319Z')).not.toBe('');
  });

  it('devuelve vacío sin fecha o con una fecha inválida', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('no-es-fecha')).toBe('');
  });
});
