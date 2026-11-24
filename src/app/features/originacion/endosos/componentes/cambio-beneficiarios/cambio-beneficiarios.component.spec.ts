import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { BeneficiarioOneroso } from '@core/api/originacion/solicitud-modificacion.modelos';

import { BeneficiarioCaptura } from '../../modelos/validaciones-cambio';
import { CambioBeneficiariosComponent } from './cambio-beneficiarios.component';

const ONEROSO: BeneficiarioOneroso = { aliadoId: 'aliado-banco-1', nombre: 'Banco Aliado', base: 'outstanding_balance' };
const MATEO = { nombreCompleto: 'Mateo Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '1140223001', participacion: 100 };

async function escribirLucia(participacion: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('Nombre completo'), 'Lucía Pérez Gómez');
  await userEvent.selectOptions(screen.getByLabelText('Parentesco'), 'child');
  await userEvent.selectOptions(screen.getByLabelText('Tipo de documento'), 'TI');
  await userEvent.type(screen.getByLabelText('Número de documento'), '1.142.998.310');
  await userEvent.type(screen.getByLabelText('Participación (%)'), participacion);
}

describe('CambioBeneficiariosComponent (HU-W1.4-01)', () => {
  it('muestra el oneroso «No modificable» y los designados', async () => {
    await render(CambioBeneficiariosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { actuales: [MATEO], oneroso: ONEROSO },
    });

    const filas = within(screen.getByRole('table')).getAllByRole('row');
    expect(filas[1].textContent).toContain('Banco Aliado');
    expect(filas[1].textContent).toContain('Saldo insoluto');
    expect(filas[1].textContent).toContain('No modificable');
    expect(filas[2].textContent).toContain('Mateo Pérez Gómez');
    expect(filas[2].textContent).toContain('Hijo(a)');
    expect(screen.getByText('Total: 100 %')).toBeTruthy();
  });

  it('sin nombre del aliado muestra la etiqueta genérica y sin designados lo dice', async () => {
    await render(CambioBeneficiariosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { oneroso: { aliadoId: null, nombre: null, base: 'outstanding_balance' } },
    });

    expect(screen.getByText('Entidad que otorgó el crédito')).toBeTruthy();
    expect(screen.getByText('Aún no hay beneficiarios designados para el remanente.')).toBeTruthy();
  });

  it('la propuesta es la lista más lo escrito; «Agregar» lo lleva a la lista', async () => {
    const { fixture } = await render(CambioBeneficiariosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { actuales: [{ ...MATEO, participacion: 60 }], oneroso: ONEROSO },
    });
    const propuestas: BeneficiarioCaptura[][] = [];
    fixture.componentInstance.propuesta.subscribe((p) => propuestas.push(p));

    await escribirLucia('40');
    fixture.detectChanges();

    expect(fixture.componentInstance.propuesta().map((b) => b.participacion)).toEqual([60, 40]);
    expect(screen.getByText('Total: 100 %')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /Agregar beneficiario/ }));

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
    expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('');
    expect(fixture.componentInstance.propuesta()).toHaveLength(2);
  });

  it('muestra el error de la suma con el total y no agrega una entrada con errores', async () => {
    await render(CambioBeneficiariosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: {
        actuales: [{ ...MATEO, participacion: 60 }],
        errores: [
          { campo: 'beneficiaries', codigo: 'share_total_not_100' },
          { campo: 'beneficiaries[1].document_number', codigo: 'invalid_format' },
        ],
      },
    });

    await escribirLucia('60');

    expect(screen.getByRole('alert').textContent).toContain('La suma de participaciones debe ser 100 % (actual: 120 %)');
    await userEvent.click(screen.getByRole('button', { name: /Agregar beneficiario/ }));
    expect(screen.getByText('De 5 a 20 letras o dígitos; solo dígitos en CC, TI y RC.')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });

  it('edita y quita filas sin perder lo escrito', async () => {
    const { fixture } = await render(CambioBeneficiariosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { actuales: [MATEO] },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Editar a Mateo Pérez Gómez' }));
    expect(screen.getByRole('heading', { name: 'Editar beneficiario' })).toBeTruthy();
    expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('Mateo Pérez Gómez');
    expect((screen.getByLabelText('Participación (%)') as HTMLInputElement).value).toBe('100');
    fixture.detectChanges();
    expect(fixture.componentInstance.propuesta()).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /Agregar beneficiario/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar a Mateo Pérez Gómez' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.propuesta()).toEqual([]);
  });

  it('muestra los errores de los campos del formulario al intentar radicar', async () => {
    await render(CambioBeneficiariosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: {
        mostrarTodos: true,
        errores: [
          { campo: 'beneficiaries[0].full_name', codigo: 'required' },
          { campo: 'beneficiaries[0].share_percent', codigo: 'out_of_range' },
          { campo: 'beneficiaries', codigo: 'required' },
        ],
      },
    });

    expect(screen.getByLabelText('Nombre completo').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Completa este dato.')).toBeTruthy();
    expect(screen.getByText('Debe ser mayor que 0 y hasta 100.')).toBeTruthy();
  });
});
