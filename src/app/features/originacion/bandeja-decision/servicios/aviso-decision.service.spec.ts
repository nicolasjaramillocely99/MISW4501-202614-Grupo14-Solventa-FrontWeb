import { TestBed } from '@angular/core/testing';

import { AvisoDecisionService } from './aviso-decision.service';

describe('AvisoDecisionService (S4b · HU-W1.1-02)', () => {
  it('entrega el aviso publicado una sola vez', () => {
    const servicio = TestBed.inject(AvisoDecisionService);
    const aviso = { aceptacionId: 'acc-1', solicitante: 'Carolina Pérez Ruiz', tipo: 'adjust' as const };

    servicio.publicar(aviso);

    expect(servicio.consumir()).toEqual(aviso);
    expect(servicio.consumir()).toBeNull();
  });

  it('sin aviso publicado devuelve null', () => {
    expect(TestBed.inject(AvisoDecisionService).consumir()).toBeNull();
  });
});
