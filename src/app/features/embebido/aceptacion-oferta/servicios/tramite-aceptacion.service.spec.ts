import { TestBed } from '@angular/core/testing';

import { CLAVE_TRAMITE_ACEPTACION, TramiteAceptacionService } from './tramite-aceptacion.service';

describe('TramiteAceptacionService', () => {
  let servicio: TramiteAceptacionService;

  beforeEach(() => {
    servicio = TestBed.inject(TramiteAceptacionService);
  });

  afterEach(() => sessionStorage.clear());

  it('guarda y lee la oferta y la aceptación', () => {
    servicio.guardar({ ofertaId: 'demo-active-1', aceptacionId: 'a-1' });

    expect(servicio.leer()).toEqual({ ofertaId: 'demo-active-1', aceptacionId: 'a-1' });
  });

  it('devuelve null sin trámite, con JSON inválido o con campos incompletos', () => {
    expect(servicio.leer()).toBeNull();

    sessionStorage.setItem(CLAVE_TRAMITE_ACEPTACION, '{no es json');
    expect(servicio.leer()).toBeNull();

    sessionStorage.setItem(CLAVE_TRAMITE_ACEPTACION, JSON.stringify({ ofertaId: 'o-1' }));
    expect(servicio.leer()).toBeNull();
  });

  it('borra el trámite', () => {
    servicio.guardar({ ofertaId: 'o-1', aceptacionId: 'a-1' });
    servicio.borrar();

    expect(servicio.leer()).toBeNull();
  });
});
