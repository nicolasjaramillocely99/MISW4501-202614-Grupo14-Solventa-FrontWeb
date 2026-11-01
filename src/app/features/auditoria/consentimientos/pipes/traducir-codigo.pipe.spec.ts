import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { TraducirCodigoPipe } from './traducir-codigo.pipe';

describe('TraducirCodigoPipe', () => {
  let pipe: TraducirCodigoPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [proveerTranslocoPruebas()] });
    pipe = TestBed.runInInjectionContext(() => new TraducirCodigoPipe());
  });

  it('traduce un código conocido', () => {
    expect(pipe.transform('customer_request', 'auditoria.consentimientos.motivos')).toBe('Solicitud del cliente');
  });

  it('cae al código crudo si no hay clave', () => {
    expect(pipe.transform('canal_nuevo', 'auditoria.consentimientos.canales')).toBe('canal_nuevo');
  });

  it('sin código devuelve vacío', () => {
    expect(pipe.transform(null, 'auditoria.consentimientos.motivos')).toBe('');
    expect(pipe.transform('', 'auditoria.consentimientos.motivos')).toBe('');
  });

  it('sigue el idioma activo', () => {
    TestBed.inject(TranslocoService).setActiveLang('en-US');

    expect(pipe.transform('customer_request', 'auditoria.consentimientos.motivos')).toBe('Customer request');
  });
});
