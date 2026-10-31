import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PAGINA_DTO, PAGINA_VACIA_DTO } from '@testing/listado-consentimientos-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { PaginaConsentimientos, mapearPaginaConsentimientos } from '@core/api/auditoria/listado-consentimientos.modelos';

import { DescripcionFiltro } from '../../modelos/filtro-listado';
import { TablaConsentimientosComponent } from './tabla-consentimientos.component';

const SIN_FILTRO: DescripcionFiltro = { entidad: null, estado: null, desde: null, hasta: null, cliente: false };
// Fecha y hora locales de la prueba: Intl con la zona del entorno, como la pantalla.
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
const fecha = (iso: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

describe('TablaConsentimientosComponent (O14 / O14b · HU-W4.2-01)', () => {
  async function renderizar(pagina: PaginaConsentimientos, filtro: DescripcionFiltro = SIN_FILTRO) {
    const anterior = vi.fn();
    const siguiente = vi.fn();
    const limpiar = vi.fn();
    await render(TablaConsentimientosComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([])],
      inputs: { pagina, filtro },
      on: { anterior, siguiente, limpiar },
    });
    return { anterior, siguiente, limpiar };
  }

  it('pinta cada fila con cliente, otorgado, vence, estado, alcance y «Ver» (CA-1)', async () => {
    await renderizar(mapearPaginaConsentimientos(PAGINA_DTO));

    const tabla = screen.getByRole('table', { name: 'Consentimientos de Open Finance' });
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual([
      'Cliente',
      'Otorgado',
      'Vence',
      'Estado',
      'Alcance',
      'Acciones',
    ]);
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(6);
    const primera = within(filas[0]);
    expect(primera.getByText('Carolina Pérez Ruiz')).toBeTruthy();
    // El id va en su propio span para no partirse en el guion; la línea completa se sigue leyendo igual.
    const id = primera.getByText('cns-55aa31');
    expect(id.parentElement?.textContent).toBe('******5678 · cns-55aa31');
    expect(primera.getByText(fechaHora('2026-09-16T20:52:00Z'))).toBeTruthy();
    expect(primera.getByText(fecha('2027-09-16T20:52:00Z'))).toBeTruthy();
    expect(primera.getByText('Activo')).toBeTruthy();
    expect(
      primera.getByText(
        'productos de crédito · saldos · comportamiento de pago · registros públicos · verificación de identidad · Banco Aliado',
      ),
    ).toBeTruthy();
    expect(primera.getByRole('link', { name: 'Ver el consentimiento cns-55aa31' }).getAttribute('href')).toBe('/auditoria/consentimientos/cns-55aa31');

    expect(within(filas[3]).getByText('Revocado 10/09')).toBeTruthy();
    expect(within(filas[4]).getByText('Vencido')).toBeTruthy();
    expect(within(filas[5]).getByText('Revocación parcial')).toBeTruthy();
    expect(document.querySelectorAll('app-insignia-estado.insignia--exito')).toHaveLength(3);
    expect(document.querySelector('app-insignia-estado.insignia--advertencia')).toBeTruthy();
    expect(document.querySelector('app-insignia-estado.insignia--error')).toBeTruthy();
  });

  it('el pie dice el rango, la página y que el filtro se conserva; «Anterior» está deshabilitado en la primera', async () => {
    const { anterior, siguiente } = await renderizar(mapearPaginaConsentimientos(PAGINA_DTO));

    expect(screen.getByText(/1 a 6 de 1\.433 registros · página 1 de 239 · el filtro se conserva al navegar/)).toBeTruthy();
    const navegacion = within(screen.getByRole('navigation', { name: 'Páginas del listado' }));
    expect(navegacion.getByRole('button', { name: 'Anterior' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(navegacion.getByRole('button', { name: 'Siguiente' }));
    expect(siguiente).toHaveBeenCalledTimes(1);
    expect(anterior).not.toHaveBeenCalled();
  });

  it('en la última página «Siguiente» está deshabilitado y «Anterior» navega', async () => {
    const ultima = { ...mapearPaginaConsentimientos(PAGINA_DTO), pagina: 239, totalRegistros: 1433 };
    ultima.items = ultima.items.slice(0, 5);
    const { anterior } = await renderizar(ultima);

    expect(screen.getByText(/1\.429 a 1\.433 de 1\.433 registros · página 239 de 239/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(anterior).toHaveBeenCalledTimes(1);
  });

  it('sin resultados describe el filtro aplicado, ofrece «Limpiar filtros» y deshabilita la paginación (CA-3)', async () => {
    const { limpiar } = await renderizar(mapearPaginaConsentimientos(PAGINA_VACIA_DTO), {
      entidad: 'Cooperativa Andina',
      estado: 'revoked',
      desde: '01/09/2026',
      hasta: '16/09/2026',
      cliente: true,
    });

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
    const vacio = within(screen.getByRole('status'));
    expect(vacio.getByRole('heading', { name: 'Sin consentimientos para el filtro aplicado' })).toBeTruthy();
    expect(
      vacio.getByText(
        'No hay consentimientos de Cooperativa Andina en estado Revocado, otorgados entre el 01/09/2026 y el 16/09/2026, para el cliente buscado.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/0 registros · página 1 de 1 · el filtro se conserva al navegar/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anterior' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true);

    await userEvent.click(vacio.getByRole('button', { name: 'Limpiar filtros' }));
    expect(limpiar).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ...SIN_FILTRO, desde: '01/09/2026' }, 'No hay consentimientos, otorgados desde el 01/09/2026.'],
    [{ ...SIN_FILTRO, hasta: '16/09/2026' }, 'No hay consentimientos, otorgados hasta el 16/09/2026.'],
    [SIN_FILTRO, 'No hay consentimientos.'],
  ])('describe solo lo que el filtro tiene', async (filtro, texto) => {
    await renderizar(mapearPaginaConsentimientos(PAGINA_VACIA_DTO), filtro);

    expect(screen.getByText(texto)).toBeTruthy();
  });

  it('una página después de la última lo dice y deja volver', async () => {
    const despues = { ...mapearPaginaConsentimientos(PAGINA_VACIA_DTO), pagina: 9, totalRegistros: 14, totalPaginas: 3 };
    const { anterior } = await renderizar(despues);

    expect(screen.getByRole('heading', { name: 'Esta página ya no tiene consentimientos' })).toBeTruthy();
    expect(screen.getByText(/0 a 0 de 14 registros · página 9 de 3/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(anterior).toHaveBeenCalledTimes(1);
  });
});
