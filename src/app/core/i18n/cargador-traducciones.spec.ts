import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CargadorTraducciones } from './cargador-traducciones';

describe('CargadorTraducciones', () => {
  it('pide el JSON del idioma a public/i18n', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const cargador = TestBed.inject(CargadorTraducciones);
    const http = TestBed.inject(HttpTestingController);

    const respuesta = firstValueFrom(cargador.getTranslation('es-CO'));
    const peticion = http.expectOne('i18n/es-CO.json');
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ comun: { cargando: 'Cargando…' } });

    expect(await respuesta).toEqual({ comun: { cargando: 'Cargando…' } });
    http.verify();
  });
});
