import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { FormatoFechaPipe } from './formato-fecha.pipe';
import { FormatoMonedaPipe } from './formato-moneda.pipe';

describe('pipes de formato (Intl)', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [proveerTranslocoPruebas()] });
    transloco = TestBed.inject(TranslocoService);
  });

  function crear<T>(tipo: new () => T): T {
    return TestBed.runInInjectionContext(() => new tipo());
  }

  it('formatea la moneda en es-CO con separador de miles y el código', () => {
    const texto = crear(FormatoMonedaPipe).transform(250000000, 'COP').replace(/\s/g, ' ');

    expect(texto).toMatch(/^\$ ?250\.000\.000 COP$/);
  });

  it('cambia el formato al cambiar el idioma y admite otras monedas', () => {
    transloco.setActiveLang('en-US');

    const texto = crear(FormatoMonedaPipe).transform(2180000, 'MXN');

    expect(texto).toContain('2,180,000');
    expect(texto.endsWith('MXN')).toBe(true);
  });

  it('devuelve vacío sin monto', () => {
    expect(crear(FormatoMonedaPipe).transform(null, 'COP')).toBe('');
  });

  it('formatea la fecha en el idioma activo', () => {
    const pipe = crear(FormatoFechaPipe);

    expect(pipe.transform('2026-10-11T12:00:00Z')).toBe('11 de octubre de 2026');
    transloco.setActiveLang('en-US');
    expect(pipe.transform('2026-10-11T12:00:00Z')).toBe('October 11, 2026');
  });

  it('devuelve vacío con una fecha ausente o inválida', () => {
    const pipe = crear(FormatoFechaPipe);

    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('no-es-fecha')).toBe('');
  });
});
