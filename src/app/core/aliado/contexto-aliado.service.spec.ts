import { TestBed } from '@angular/core/testing';

import { ContextoAliadoService } from './contexto-aliado.service';

describe('ContextoAliadoService', () => {
  it('no tiene aliado hasta que se establece y permite limpiarlo', () => {
    const servicio = TestBed.inject(ContextoAliadoService);
    expect(servicio.nombre()).toBeNull();

    servicio.establecer('Banco Aliado');
    expect(servicio.nombre()).toBe('Banco Aliado');

    servicio.establecer(null);
    expect(servicio.nombre()).toBeNull();
  });
});
