import { render, screen } from '@testing-library/angular';
import {
  OFERTA_CON_CACHE_DTO,
  OFERTA_NORMAL_DTO,
  OFERTA_PERFIL_BASE_DTO,
  OFERTA_REDUCIDA_DTO,
} from '@testing/oferta-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { OfertaDto, mapearOferta } from '@core/api/originacion/oferta.modelos';

import { DetalleOfertaComponent } from './detalle-oferta.component';

async function renderizar(dto: OfertaDto, beneficiario: string | null = 'Banco Aliado') {
  return render(DetalleOfertaComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { oferta: mapearOferta(dto), beneficiario },
  });
}

describe('DetalleOfertaComponent (E3, E3b, E3c)', () => {
  describe('E3 · oferta normal', () => {
    beforeEach(() => renderizar(OFERTA_NORMAL_DTO));

    it('muestra la prima mensual, el valor asegurado, la vigencia y el beneficiario', () => {
      expect(screen.getByText('Prima mensual')).toBeTruthy();
      expect(screen.getByText(/132\.000 COP/)).toBeTruthy();
      expect(screen.getByText('Se suma a la cuota mensual de tu crédito')).toBeTruthy();
      expect(screen.getByText('20 años · igual al plazo del crédito')).toBeTruthy();
      expect(screen.getByText('Banco Aliado (saldo insoluto) · remanente a tus herederos')).toBeTruthy();
      expect(screen.getByText(/Individual · calculado el .*2026/)).toBeTruthy();
    });

    it('lista las coberturas y las condiciones por su código traducido', () => {
      expect(screen.getByText('Fallecimiento por cualquier causa')).toBeTruthy();
      expect(screen.getByText('Incapacidad total y permanente')).toBeTruthy();
      expect(screen.getAllByText(/Hasta .*250\.000\.000 COP/)).toHaveLength(2);
      expect(screen.getByRole('heading', { name: 'Condiciones' })).toBeTruthy();
      expect(screen.getAllByRole('listitem').length).toBe(6);
    });

    it('no muestra el aviso de oferta provisional', () => {
      expect(screen.queryByText(/Calculamos tu oferta con/)).toBeNull();
      expect(screen.queryByText('Fuente no disponible')).toBeNull();
    });
  });

  describe('E3b · provisional con perfil en caché', () => {
    beforeEach(() => renderizar(OFERTA_CON_CACHE_DTO));

    it('marca el modo degradado con la fuente caída, la fecha del perfil y la condición de recotización', () => {
      expect(screen.getByText('Calculamos tu oferta con tu último perfil')).toBeTruthy();
      expect(screen.getByText(/usamos tu último perfil, del .*2026/)).toBeTruthy();
      expect(screen.getByText('Prima mensual estimada')).toBeTruthy();
      expect(screen.getByText(/Con perfil en caché · sujeta a recotización/)).toBeTruthy();
      expect(screen.getByText(/En caché · .*2026/)).toBeTruthy();
      expect(screen.getByText('Fuente no disponible')).toBeTruthy();
      expect(screen.getAllByText('Open Finance').length).toBeGreaterThan(0);
      expect(screen.getByText(/Si la información vuelve a estar disponible, recalcularemos tu oferta/, { selector: 'li' })).toBeTruthy();
    });
  });

  describe('E3c · provisional con perfil base', () => {
    beforeEach(() => renderizar(OFERTA_PERFIL_BASE_DTO));

    it('explica que se usó un perfil general, sin fecha de perfil', () => {
      expect(screen.getByText('Calculamos tu oferta con un perfil general')).toBeTruthy();
      expect(screen.getByText(/Con perfil base · sujeta a recotización/)).toBeTruthy();
      expect(screen.getByText('Base actuarial · cliente sin perfil previo')).toBeTruthy();
    });
  });

  describe('vista reducida (ajustada o demostración)', () => {
    it('muestra solo la prima y no inventa coberturas, condiciones ni perfil', async () => {
      await renderizar(OFERTA_REDUCIDA_DTO, null);

      expect(screen.getByText(/89\.500 COP/)).toBeTruthy();
      expect(screen.queryByText('Valor asegurado')).toBeNull();
      expect(screen.queryByText('Vigencia')).toBeNull();
      expect(screen.queryByText('Beneficiario oneroso')).toBeNull();
      expect(screen.queryByText('Perfil aplicado')).toBeNull();
      expect(screen.queryByText('Coberturas incluidas')).toBeNull();
      expect(screen.queryByText('Condiciones')).toBeNull();
      expect(screen.queryByText(/Tu precio se calcula con tu perfil individual/)).toBeNull();
    });
  });

  it('un perfil reutilizado de la caché en una oferta normal llega sin fecha: dice «perfil vigente», sin inventarla', async () => {
    await renderizar({ ...OFERTA_NORMAL_DTO, profile: { category: 'standard', source: 'cache' } });

    expect(screen.getByText('Individual · perfil vigente')).toBeTruthy();
    expect(screen.queryByText(/En caché/)).toBeNull();
  });

  it('sin la solicitud del crédito omite el beneficiario', async () => {
    await renderizar(OFERTA_NORMAL_DTO, null);

    expect(screen.queryByText('Beneficiario oneroso')).toBeNull();
  });

  it('usa una fuente genérica si la fuente caída no es una conocida', async () => {
    await renderizar({ ...OFERTA_CON_CACHE_DTO, unavailable_source: 'otra_fuente' });

    expect(screen.getAllByText('Una fuente externa').length).toBeGreaterThan(0);
  });
});
