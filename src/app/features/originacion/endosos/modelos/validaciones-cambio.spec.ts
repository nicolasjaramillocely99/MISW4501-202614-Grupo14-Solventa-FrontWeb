import { Beneficiario } from '@core/api/originacion/solicitud-modificacion.modelos';

import {
  BeneficiarioCaptura,
  aBeneficiarios,
  aPuntosBasicos,
  claveMensaje,
  leerMonto,
  normalizarTelefono,
  totalParticipacion,
  validarBeneficiarios,
  validarContacto,
  validarValorAsegurado,
} from './validaciones-cambio';

const mateo: BeneficiarioCaptura = {
  nombreCompleto: 'Mateo Pérez Gómez',
  parentesco: 'child',
  tipoDocumento: 'TI',
  numeroDocumento: '1.140.223.001',
  participacion: 60,
};
const lucia: BeneficiarioCaptura = { ...mateo, nombreCompleto: 'Lucía Pérez Gómez', numeroDocumento: '1142998310', participacion: 40 };

function campos(errores: { campo: string; codigo: string }[]): Record<string, string> {
  return Object.fromEntries(errores.map((e) => [e.campo, e.codigo]));
}

describe('validaciones-cambio (HU-W1.4-01 · CA-3)', () => {
  it('acepta dos beneficiarios que suman exactamente 100 %', () => {
    expect(validarBeneficiarios([mateo, lucia], [])).toEqual([]);
    expect(totalParticipacion([mateo, lucia])).toBe(100);
    expect(aBeneficiarios([{ ...mateo, nombreCompleto: '  Mateo   Pérez ' }])[0]).toEqual({
      nombreCompleto: 'Mateo Pérez',
      parentesco: 'child',
      tipoDocumento: 'TI',
      numeroDocumento: '1140223001',
      participacion: 60,
    });
  });

  it('señala la suma distinta de 100 con 99,99 y 100,01', () => {
    expect(campos(validarBeneficiarios([mateo, { ...lucia, participacion: 39.99 }], []))).toEqual({ beneficiaries: 'share_total_not_100' });
    expect(campos(validarBeneficiarios([mateo, { ...lucia, participacion: 40.01 }], []))).toEqual({ beneficiaries: 'share_total_not_100' });
    expect(totalParticipacion([mateo, { ...lucia, participacion: 60 }])).toBe(120);
  });

  it('señala todos los campos a la vez y no suma mientras una participación sea inválida', () => {
    const errores = validarBeneficiarios(
      [
        { nombreCompleto: '', parentesco: '', tipoDocumento: '', numeroDocumento: '', participacion: null },
        { nombreCompleto: 'Al', parentesco: 'primo', tipoDocumento: 'NIT', numeroDocumento: '12-3', participacion: 0 },
        { ...mateo, tipoDocumento: 'CC', numeroDocumento: '1234A6', participacion: 33.333 },
      ],
      [],
    );
    expect(campos(errores)).toEqual({
      'beneficiaries[0].full_name': 'required',
      'beneficiaries[0].relationship': 'required',
      'beneficiaries[0].document_type': 'required',
      'beneficiaries[0].document_number': 'required',
      'beneficiaries[0].share_percent': 'required',
      'beneficiaries[1].full_name': 'invalid_format',
      'beneficiaries[1].relationship': 'invalid_format',
      'beneficiaries[1].document_type': 'invalid_format',
      'beneficiaries[1].document_number': 'invalid_format',
      'beneficiaries[1].share_percent': 'out_of_range',
      'beneficiaries[2].document_number': 'invalid_format',
      'beneficiaries[2].share_percent': 'invalid_format',
    });
  });

  it('exige de 1 a 10, sin documentos repetidos y distinta de la vigente', () => {
    expect(campos(validarBeneficiarios([], []))).toEqual({ beneficiaries: 'required' });
    const once = Array.from({ length: 11 }, (_, i) => ({ ...mateo, numeroDocumento: `10000${i + 10}`, participacion: i === 0 ? 0.1 : 9.99 }));
    expect(campos(validarBeneficiarios(once, []))['beneficiaries']).toBe('out_of_range');
    expect(campos(validarBeneficiarios([{ ...mateo, participacion: 50 }, { ...mateo, nombreCompleto: 'Otro Nombre', participacion: 50 }], []))).toEqual({
      'beneficiaries[1].document_number': 'duplicate',
    });
    const vigentes: Beneficiario[] = [{ ...mateo, numeroDocumento: '1140223001', participacion: 100 }];
    expect(campos(validarBeneficiarios([{ ...mateo, nombreCompleto: 'mateo pérez gómez', participacion: 100 }], vigentes))).toEqual({
      beneficiaries: 'no_change',
    });
  });

  it('lee la participación con hasta dos decimales', () => {
    expect(aPuntosBasicos(33.33)).toBe(3333);
    expect(aPuntosBasicos(33.333)).toBeNull();
    expect(aPuntosBasicos(null)).toBeNull();
    expect(aPuntosBasicos(Number.NaN)).toBeNull();
  });

  it('valida el valor asegurado entero, dentro de los límites y distinto del actual', () => {
    const limites = { valorMinimo: 10_000_000, valorMaximo: 2_000_000_000 };
    expect(validarValorAsegurado('', 68_000_000, limites)).toEqual([{ campo: 'insured_amount', codigo: 'required' }]);
    expect(validarValorAsegurado('80.000.000,5', 68_000_000, limites)).toEqual([{ campo: 'insured_amount', codigo: 'invalid_format' }]);
    expect(validarValorAsegurado('9.999.999', 68_000_000, limites)).toEqual([{ campo: 'insured_amount', codigo: 'out_of_range' }]);
    expect(validarValorAsegurado('68000000', 68_000_000, limites)).toEqual([{ campo: 'insured_amount', codigo: 'no_change' }]);
    expect(validarValorAsegurado('300.000.000', 68_000_000, limites)).toEqual([]);
    expect(leerMonto('2 000 000 000')).toBe(2_000_000_000);
    expect(leerMonto('abc')).toBeNull();
  });

  it('valida el contacto: al menos un dato, con su forma y distinto del actual', () => {
    const actual = { direccion: null, correo: 'carolina@example.com', telefono: null };
    expect(validarContacto({ direccion: '', correo: '', telefono: '' }, actual)).toEqual([{ campo: 'personal_data', codigo: 'required' }]);
    expect(campos(validarContacto({ direccion: 'Cl 1', correo: 'carolina@', telefono: '300 123 456' }, actual))).toEqual({
      'personal_data.address': 'invalid_format',
      'personal_data.email': 'invalid_format',
      'personal_data.phone': 'invalid_format',
    });
    expect(campos(validarContacto({ direccion: '', correo: ' Carolina@Example.com ', telefono: '' }, actual))).toEqual({
      'personal_data.email': 'no_change',
    });
    expect(validarContacto({ direccion: 'Calle 45 # 12-30, Bogotá', correo: '', telefono: '+57 301 234 5678' }, actual)).toEqual([]);
    expect(
      campos(validarContacto({ direccion: 'Calle 45', correo: '', telefono: '3012345678' }, { direccion: 'calle 45', correo: null, telefono: '3012345678' })),
    ).toEqual({ 'personal_data.address': 'no_change', 'personal_data.phone': 'no_change' });
    expect(normalizarTelefono('+57 301-234-5678')).toBe('3012345678');
  });

  it('elige el mensaje específico del control o el general', () => {
    expect(claveMensaje('telefono', 'invalid_format')).toBe('errores.campos.telefono.invalid_format');
    expect(claveMensaje('telefono', 'no_change')).toBe('errores.no_change');
    expect(claveMensaje('desconocido', 'required')).toBe('errores.required');
  });
});
