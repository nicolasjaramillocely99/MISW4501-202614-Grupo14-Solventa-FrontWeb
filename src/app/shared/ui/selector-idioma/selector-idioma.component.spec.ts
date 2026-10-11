import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { SelectorIdiomaComponent } from './selector-idioma.component';

describe('SelectorIdiomaComponent', () => {
  async function renderizar(idioma = 'es-CO') {
    const cambio = vi.fn();
    const resultado = await render(SelectorIdiomaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { idioma, idiomas: ['es-CO', 'en-US'] },
      on: { cambio },
    });
    return { ...resultado, cambio };
  }

  it('es un selector con etiqueta permanente que muestra el código del idioma activo', async () => {
    await renderizar();

    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Idioma' });
    expect(selector.value).toBe('es-CO');
    expect(selector.selectedOptions[0].textContent?.trim()).toBe('ES');
  });

  it('anuncia cada idioma con su nombre completo y su propio lang', async () => {
    await renderizar();

    const opciones = screen.getAllByRole<HTMLOptionElement>('option');
    expect(opciones.map((opcion) => opcion.textContent?.trim())).toEqual(['ES', 'EN']);
    expect(opciones.map((opcion) => opcion.getAttribute('aria-label'))).toEqual([
      'Español (Colombia)',
      'English (United States)',
    ]);
    expect(opciones.map((opcion) => opcion.lang)).toEqual(['es-CO', 'en-US']);
  });

  it('refleja el idioma activo que recibe', async () => {
    await renderizar('en-US');

    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('en-US');
  });

  it('emite el idioma elegido', async () => {
    const { cambio } = await renderizar();

    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'en-US');

    expect(cambio).toHaveBeenCalledWith('en-US');
  });

  it('da a cada instancia un id propio para su etiqueta', async () => {
    await render(
      `<app-selector-idioma idioma="es-CO" [idiomas]="idiomas" />
       <app-selector-idioma idioma="en-US" [idiomas]="idiomas" />`,
      {
        imports: [SelectorIdiomaComponent, proveerTranslocoPruebas()],
        componentProperties: { idiomas: ['es-CO', 'en-US'] },
      },
    );

    const selectores = screen.getAllByRole('combobox', { name: 'Idioma' });
    expect(selectores).toHaveLength(2);
    expect(new Set(selectores.map((selector) => selector.id)).size).toBe(2);
  });
});
