import { Traductor, nombreRamo, nombreSoporte, nombreTipo } from './catalogo-siniestros';

/** Traductor de prueba: devuelve la clave pedida para ver qué se tradujo. */
const t: Traductor = (clave) => `«${clave}»`;

describe('catálogo de siniestros por código (HU-W2.1-01, F4)', () => {
  it('traduce los códigos conocidos con su clave', () => {
    expect(nombreRamo(t, 'auto', 'Autos')).toBe('«catalogo.ramos.autos»');
    expect(nombreTipo(t, 'third_party_damage')).toBe('«catalogo.tipos.danoTerceros.nombre»');
    expect(nombreTipo(t, 'collision', undefined, 'corto')).toBe('«catalogo.tipos.colision.corto»');
    expect(nombreSoporte(t, 'repair_quote', 'Factura')).toBe('«catalogo.soportes.cotizacionReparacion»');
  });

  it('cae al texto del backend con un código que no conoce (catálogo nuevo)', () => {
    expect(nombreRamo(t, 'pets', 'Mascotas')).toBe('Mascotas');
    expect(nombreTipo(t, 'hail', 'Granizo')).toBe('Granizo');
    expect(nombreSoporte(t, 'vet_report', 'Informe veterinario')).toBe('Informe veterinario');
  });

  it('sin texto de respaldo usa el código del tipo y deja el ramo vacío', () => {
    expect(nombreTipo(t, 'hail')).toBe('hail');
    expect(nombreRamo(t, null, null)).toBe('');
  });
});
