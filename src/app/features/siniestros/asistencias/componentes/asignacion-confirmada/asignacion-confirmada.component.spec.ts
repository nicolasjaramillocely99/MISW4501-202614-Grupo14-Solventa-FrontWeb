import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ASIGNACION_ASIGNADA_DTO, ASIGNACION_AVISADA_DTO } from '@testing/asignacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { Asignacion, mapearAsignacionSiniestro } from '@core/api/siniestros/asignacion.modelos';

import { AsignacionConfirmadaComponent } from './asignacion-confirmada.component';

const PENDIENTE = mapearAsignacionSiniestro(ASIGNACION_ASIGNADA_DTO).asignacion as Asignacion;
const ENVIADA = mapearAsignacionSiniestro(ASIGNACION_AVISADA_DTO).asignacion as Asignacion;

describe('AsignacionConfirmadaComponent (HU-W2.3-01, CA-5)', () => {
  const renderizar = (asignacion: Asignacion, avisoDetenido = false) => {
    const actualizar = vi.fn();
    return render(AsignacionConfirmadaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { asignacion, avisoDetenido },
      on: { actualizar },
    }).then((vista) => ({ ...vista, actualizar }));
  };

  const dato = (nombre: string) =>
    screen
      .getByText(nombre, { selector: 'dt' })
      .nextElementSibling?.textContent?.replace(/\s+/g, ' ')
      .trim();

  it('muestra el prestador, su contacto, la distancia, quién asignó y la ubicación compartida', async () => {
    await renderizar(PENDIENTE);

    expect(screen.getByRole('heading', { name: 'Prestador asignado' })).toBeTruthy();
    expect(screen.getByText('Servicios Hogar Norte')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'despachos@hogarnorte.example.com' }).getAttribute('href'),
    ).toBe('mailto:despachos@hogarnorte.example.com');
    expect(screen.getByRole('link', { name: '+576015550102' }).getAttribute('href')).toBe(
      'tel:+576015550102',
    );
    expect(dato('Distancia')).toBe('2,3 km');
    expect(dato('Asignado')).toMatch(/^\d{2}\/\d{2}\/2026, \d{2}:\d{2} por Andrés Ruiz$/);
    expect(dato('Ubicación compartida')).toBe(
      '4,6771 N · 74,0483 O · Capturadas desde la app · precisión 8 m',
    );
  });

  it('con el aviso pendiente dice que se está enviando', async () => {
    await renderizar(PENDIENTE);

    expect(screen.getByRole('status').textContent).toContain(
      'Enviando la asignación al prestador…',
    );
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });

  it('con el aviso enviado muestra la fecha', async () => {
    await renderizar(ENVIADA);

    expect(screen.getByRole('status').textContent).toMatch(
      /Aviso enviado al prestador · \d{2}\/\d{2}\/2026/,
    );
  });

  it('si la página dejó de seguir el aviso, ofrece «Actualizar»', async () => {
    const { actualizar } = await renderizar(PENDIENTE, true);

    expect(screen.getByRole('status').textContent).toContain('el sistema lo sigue intentando');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(actualizar).toHaveBeenCalled();
  });

  it('sin teléfono no lo muestra, y con dirección la agrega', async () => {
    await renderizar({
      ...PENDIENTE,
      prestador: { ...PENDIENTE.prestador, telefono: null },
      ubicacionCompartida: {
        ...PENDIENTE.ubicacionCompartida,
        precisionM: null,
        direccion: 'Carrera 15 # 93-40',
      },
    });

    expect(screen.queryByText('Teléfono')).toBeNull();
    expect(dato('Ubicación compartida')).toBe('4,6771 N · 74,0483 O Carrera 15 # 93-40');
  });
});
