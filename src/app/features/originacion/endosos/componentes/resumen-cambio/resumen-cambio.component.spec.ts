import { render, screen } from '@testing-library/angular';
import { CONDICIONES_CON_ABIERTA_DTO, CONDICIONES_VIGENTES_DTO } from '@testing/solicitud-modificacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { mapearCondicionesVigentes } from '@core/api/originacion/solicitud-modificacion.modelos';

import { AntesDeRadicarComponent } from '../antes-de-radicar/antes-de-radicar.component';
import { ResumenCambioComponent } from './resumen-cambio.component';

const VIGENTES = mapearCondicionesVigentes(CONDICIONES_VIGENTES_DTO);

function valores(): string[] {
  return Array.from(document.querySelectorAll('dd')).map((d) => d.textContent?.trim() ?? '');
}

describe('ResumenCambioComponent (HU-W1.4-01)', () => {
  it('beneficiarios: el actual, lo pedido mientras se escribe y el efecto', async () => {
    const { fixture } = await render(ResumenCambioComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { tipo: 'beneficiaries', condiciones: mapearCondicionesVigentes(CONDICIONES_CON_ABIERTA_DTO) },
    });
    expect(valores()).toEqual(['Mateo Pérez Gómez · 100 %', 'Aún sin definir', 'Aplica al remanente tras el saldo del crédito.']);

    fixture.componentRef.setInput('beneficiarios', [
      { nombreCompleto: 'Mateo Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '1', participacion: 60 },
      { nombreCompleto: 'Lucía Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '2', participacion: 40 },
    ]);
    fixture.detectChanges();
    expect(valores()[1]).toBe('Mateo Pérez Gómez · 60 % · Lucía Pérez Gómez · 40 %');
  });

  it('suma asegurada y datos personales', async () => {
    const { fixture } = await render(ResumenCambioComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { tipo: 'insured_amount', condiciones: VIGENTES, textoSuma: '300.000.000' },
    });
    expect(valores()[0]).toMatch(/68\.000\.000 COP/);
    expect(valores()[1]).toMatch(/300\.000\.000 COP/);

    fixture.componentRef.setInput('tipo', 'personal_data');
    fixture.componentRef.setInput('contacto', { direccion: 'Calle 45 # 12-30', correo: '', telefono: '+57 301 234 5678' });
    fixture.detectChanges();
    expect(valores()[0]).toBe('Dirección: no registrada · Teléfono: no registrado · Correo: carolina@example.com');
    expect(valores()[1]).toBe('Dirección: Calle 45 # 12-30 · Teléfono: 3012345678 · Correo: carolina@example.com');
    expect(screen.getByText(/tu usuario para iniciar sesión no cambia/)).toBeTruthy();
  });
});

describe('AntesDeRadicarComponent (HU-W1.4-01)', () => {
  it('recuerda la titularidad, el seguimiento y la regla del tipo', async () => {
    await render(AntesDeRadicarComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { tipo: 'insured_amount', limites: { valorMinimo: 10_000_000, valorMaximo: 2_000_000_000 }, conErrores: true },
    });

    expect(screen.getByText(/Solo tú, como titular autenticado/)).toBeTruthy();
    expect(screen.getByText(/radicada, en revisión, aplicada o rechazada/)).toBeTruthy();
    expect(screen.getByText(/El valor nuevo debe estar entre .*10\.000\.000 COP y .*2\.000\.000\.000 COP/)).toBeTruthy();
  });
});
