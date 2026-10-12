import { render, screen, within } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { IndicadorPasosComponent, PasoFlujo } from './indicador-pasos.component';

const PASOS: PasoFlujo[] = [
  { etiqueta: 'embebido.pasos.consentimiento', estado: 'completado' },
  { etiqueta: 'embebido.pasos.perfilRiesgo', estado: 'actual' },
  { etiqueta: 'embebido.pasos.oferta', estado: 'pendiente' },
];

describe('IndicadorPasosComponent', () => {
  async function renderizar(pasos: PasoFlujo[] = PASOS) {
    return render(IndicadorPasosComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { pasos, etiqueta: 'embebido.pasos.navegacion' },
    });
  }

  it('lista los pasos con su etiqueta y estado anunciado con texto', async () => {
    await renderizar();

    const lista = screen.getByRole('list', { name: 'Pasos de la solicitud' });
    const pasos = within(lista).getAllByRole('listitem').filter((item) => item.textContent?.trim());
    expect(pasos).toHaveLength(3);
    expect(pasos[0].textContent).toContain('Consentimiento');
    expect(pasos[0].textContent).toContain('completado');
    expect(pasos[1].textContent).toContain('paso actual');
    expect(pasos[2].textContent).toContain('pendiente');
  });

  it('marca solo el paso actual con aria-current="step"', async () => {
    const { container } = await renderizar();

    const actuales = container.querySelectorAll('[aria-current="step"]');
    expect(actuales).toHaveLength(1);
    expect(actuales[0].textContent).toContain('Perfil de riesgo');
  });

  it('pinta con lima la línea hacia los pasos alcanzados y en gris hacia los pendientes', async () => {
    const { container } = await renderizar();

    const lineas = container.querySelectorAll('.pasos__linea');
    expect(lineas[0].classList).toContain('pasos__linea--alcanzada');
    expect(lineas[1].classList).not.toContain('pasos__linea--alcanzada');
  });

  it('muestra un check en los completados y el número en el resto', async () => {
    const { container } = await renderizar();

    const circulos = container.querySelectorAll('.paso__circulo');
    expect(circulos[0].querySelector('svg')).toBeTruthy();
    expect(circulos[1].textContent?.trim()).toBe('2');
    expect(circulos[2].textContent?.trim()).toBe('3');
  });
});
