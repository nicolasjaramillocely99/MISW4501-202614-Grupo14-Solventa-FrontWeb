import { UltimoListadoService } from './ultimo-listado.service';

describe('UltimoListadoService (HU-W4.2-01)', () => {
  it('empieza sin parámetros y guarda una copia de los últimos', () => {
    const servicio = new UltimoListadoService();
    expect(servicio.parametros()).toEqual({});

    const parametros = { estado: 'revoked', pagina: '2' };
    servicio.guardar(parametros);
    parametros.estado = 'active';

    expect(servicio.parametros()).toEqual({ estado: 'revoked', pagina: '2' });
  });
});
