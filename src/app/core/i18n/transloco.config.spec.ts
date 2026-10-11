import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { IDIOMAS_DISPONIBLES, proveerI18n } from './transloco.config';

describe('proveerI18n', () => {
  let transloco: TranslocoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), proveerI18n()],
    });
    transloco = TestBed.inject(TranslocoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa es-CO como idioma predeterminado y ofrece los dos idiomas', () => {
    expect(transloco.getDefaultLang()).toBe('es-CO');
    expect(transloco.getAvailableLangs()).toEqual([...IDIOMAS_DISPONIBLES]);
  });

  it('carga el diccionario del idioma desde public/i18n en tiempo de ejecución', async () => {
    const carga = firstValueFrom(transloco.load('en-US'));

    // Con la traducción de respaldo activa, Transloco carga también es-CO.
    http.expectOne('i18n/en-US.json').flush({ comun: { cargando: 'Loading…' } });
    http.expectOne('i18n/es-CO.json').flush({ comun: { cargando: 'Cargando…' } });

    await carga;
    expect(transloco.translate('comun.cargando', {}, 'en-US')).toBe('Loading…');
  });
});

describe('proveerI18n al arrancar', () => {
  afterEach(() => localStorage.clear());

  it('aplica el idioma que el usuario eligió antes en este navegador', () => {
    localStorage.setItem('solventa.idioma', 'en-US');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), proveerI18n()],
    });

    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });
});
