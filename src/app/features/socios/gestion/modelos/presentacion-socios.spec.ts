import { LISTADO_SOCIOS_DTO } from '@testing/socios-pruebas';

import { mapearListadoSocios } from '@core/api/socios/socios.modelos';

import {
  FORMULARIO_INICIAL,
  aSolicitudRegistro,
  anchoBarra,
  etiquetaCredenciales,
  etiquetaEstadoSocio,
  separarProductos,
  tonoConsumo,
  validarHorasTransicion,
  validarRegistro,
  valoresDetalle,
} from './presentacion-socios';

const socios = mapearListadoSocios(LISTADO_SOCIOS_DTO).items;

describe('presentación de socios (HU-W3.1-01)', () => {
  it('etiqueta el estado de cada socio según su consumo de hoy', () => {
    expect(etiquetaEstadoSocio(socios[0])).toEqual({ clave: 'activo', tono: 'exito' });
    expect(etiquetaEstadoSocio(socios[1])).toEqual({ clave: 'cercaLimite', tono: 'advertencia' });
    expect(etiquetaEstadoSocio(socios[3])).toEqual({ clave: 'pendiente', tono: 'informacion' });
    expect(etiquetaEstadoSocio({ ...socios[0], estadoConsumo: 'exceeded' })).toEqual({ clave: 'excedido', tono: 'error' });
    expect(etiquetaEstadoSocio({ ...socios[0], estado: 'offboarded' })).toEqual({ clave: 'baja', tono: 'neutro' });
  });

  it('etiqueta las credenciales', () => {
    expect(etiquetaCredenciales('active').clave).toBe('activas');
    expect(etiquetaCredenciales('rotation_in_progress').clave).toBe('rotacion');
    expect(etiquetaCredenciales('disabled').clave).toBe('inhabilitadas');
    expect(etiquetaCredenciales('none').clave).toBe('sinCredenciales');
  });

  it('la barra de consumo cambia de tono y se limita a 0–100', () => {
    expect(tonoConsumo(null)).toBe('normal');
    expect(tonoConsumo(socios[0].consumo)).toBe('normal');
    expect(tonoConsumo(socios[1].consumo)).toBe('alerta');
    expect(tonoConsumo({ fecha: 'd', usadas: 1, restantes: 0, porcentaje: 120 })).toBe('excedido');
    expect(anchoBarra({ fecha: 'd', usadas: 1, restantes: 0, porcentaje: 120 })).toBe(100);
    expect(anchoBarra(null)).toBe(0);
  });

  it('el detalle del historial solo interpola textos y números', () => {
    expect(
      valoresDetalle({
        eventoId: 'e',
        tipo: 'credentials_issued',
        ocurridoEn: '',
        actor: { tipo: 'operations', id: 's', etiqueta: 'a' },
        estado: 'applied',
        detalles: { client_id: 'sol_1', daily_limit: 5, otro: { x: 1 } },
      }),
    ).toEqual({ client_id: 'sol_1', daily_limit: 5 });
  });

  it('valida el registro con las reglas del contrato', () => {
    expect([...validarRegistro(FORMULARIO_INICIAL).keys()]).toEqual(['nombre', 'codigo', 'tipo', 'productos', 'correoContactoTecnico']);
    const malo = validarRegistro({
      nombre: 'AB',
      codigo: 'Ten-1',
      tipo: 'bank',
      productos: 'x',
      correoContactoTecnico: 'no-es-correo',
      limiteDiario: 0,
      limiteRafaga: 20_000,
      rafagaMaxima: 5,
    });
    expect(Object.fromEntries(malo)).toEqual({
      nombre: 'out_of_range',
      codigo: 'invalid_format',
      productos: 'out_of_range',
      correoContactoTecnico: 'invalid_format',
      limiteDiario: 'out_of_range',
      limiteRafaga: 'out_of_range',
      rafagaMaxima: 'out_of_range',
    });
    expect(validarRegistro({ ...FORMULARIO_INICIAL, limiteDiario: null }).get('limiteDiario')).toBe('required');

    const bueno = { ...FORMULARIO_INICIAL, nombre: ' Banco ', codigo: 'ten_banco', tipo: 'bank' as const, productos: 'hogar, ,vida', correoContactoTecnico: 'a@b.co' };
    expect(validarRegistro(bueno).size).toBe(0);
    expect(aSolicitudRegistro(bueno)).toEqual({
      nombre: 'Banco',
      codigo: 'ten_banco',
      tipo: 'bank',
      productos: ['hogar', 'vida'],
      correoContactoTecnico: 'a@b.co',
      cuota: { limiteDiario: 5000, limiteRafaga: 100, rafagaMaxima: 200 },
    });
    expect(separarProductos('a,,b ')).toEqual(['a', 'b']);
  });

  it('valida el periodo de transición', () => {
    expect(validarHorasTransicion(null)).toBe('required');
    expect(validarHorasTransicion(0)).toBe('out_of_range');
    expect(validarHorasTransicion(1.5)).toBe('out_of_range');
    expect(validarHorasTransicion(168)).toBeNull();
  });
});
