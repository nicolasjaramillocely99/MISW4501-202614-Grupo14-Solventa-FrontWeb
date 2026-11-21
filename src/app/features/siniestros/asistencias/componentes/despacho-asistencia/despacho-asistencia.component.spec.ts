import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DETALLE_AVISADA_DTO, DETALLE_DESPACHADA_DTO } from '@testing/asistencia-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import {
  Despacho,
  DetalleAsistenciaDto,
  mapearDetalleAsistencia,
} from '@core/api/siniestros/asistencia.modelos';

import { DespachoAsistenciaComponent } from './despacho-asistencia.component';

const despachoDe = (dto: DetalleAsistenciaDto) => mapearDetalleAsistencia(dto).despacho as Despacho;

describe('DespachoAsistenciaComponent (O9b · HU-W2.3-03, S17, CA-3)', () => {
  const renderizar = async (
    despacho: Despacho,
    entradas: { nombreSugerido?: string | null; avisoDetenido?: boolean } = {},
  ) => {
    const actualizar = vi.fn();
    await render(DespachoAsistenciaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { despacho, ...entradas },
      on: { actualizar },
    });
    return { actualizar, usuario: userEvent.setup() };
  };

  it('muestra el prestador, su contacto, quién y cuándo despachó y la ubicación compartida', async () => {
    await renderizar(despachoDe(DETALLE_DESPACHADA_DTO));

    expect(screen.getByRole('heading', { name: 'Prestador despachado' })).toBeTruthy();
    expect(screen.getByText('Grúas Autopista Norte')).toBeTruthy();
    expect(screen.getByText('Sugerido por el sistema')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'despachos@gruasautopistanorte.example.com' })
        .getAttribute('href'),
    ).toBe('mailto:despachos@gruasautopistanorte.example.com');
    expect(screen.getByRole('link', { name: '+576015550301' }).getAttribute('href')).toBe(
      'tel:+576015550301',
    );
    expect(screen.getByText('0,9 km')).toBeTruthy();
    expect(screen.getByText('12 min')).toBeTruthy();
    expect(screen.getByText('Grúa')).toBeTruthy();
    expect(screen.getByText(/^\d\d\/\d\d\/2026, \d\d:\d\d por Andrés Ruiz$/)).toBeTruthy();
    expect(screen.getByText(/4,7712 N · 74,0452 O\s+· precisión 8 m/)).toBeTruthy();
    expect(screen.getByText('Autopista Norte km 12, Bogotá')).toBeTruthy();
  });

  it('con el aviso pendiente lo dice, sin «Actualizar»', async () => {
    const despacho = despachoDe(DETALLE_DESPACHADA_DTO);
    await renderizar(despacho);
    expect(screen.getByText('Enviando el despacho al prestador…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });

  it('el seguimiento detenido ofrece «Actualizar»', async () => {
    const { actualizar, usuario } = await renderizar(despachoDe(DETALLE_DESPACHADA_DTO), {
      avisoDetenido: true,
    });

    expect(screen.getByText(/El aviso al prestador sigue pendiente/)).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(actualizar).toHaveBeenCalled();
  });

  it('con el aviso enviado, la hora', async () => {
    await renderizar(despachoDe(DETALLE_AVISADA_DTO));

    expect(screen.getByText(/^Aviso enviado al prestador · \d\d:\d\d$/)).toBeTruthy();
  });

  it('sin teléfono no lo muestra; por voz lo dice y muestra la dirección', async () => {
    const base = despachoDe(DETALLE_DESPACHADA_DTO);
    await renderizar({
      ...base,
      prestador: { ...base.prestador, telefono: null },
      ubicacionCompartida: {
        fuente: 'voice',
        latitud: 3.4921,
        longitud: -76.4203,
        precisionM: null,
        direccion: 'Vía Cali–Palmira km 4',
        lugar: null,
      },
    });

    expect(screen.queryByText('Teléfono')).toBeNull();
    expect(screen.getByText(/3,4921 N · 76,4203 O\s+· indicada por voz/)).toBeTruthy();
    expect(screen.getByText('Vía Cali–Palmira km 4')).toBeTruthy();
  });

  it('si el analista no despachó al sugerido, dice a quién sugería el sistema', async () => {
    const base = despachoDe(DETALLE_DESPACHADA_DTO);
    const otro = { ...base, prestadorSugeridoId: 'prv-auxilio-vial-norte' };

    await renderizar(otro, { nombreSugerido: 'Auxilio Vial Norte' });
    expect(screen.getByText('El sistema sugería Auxilio Vial Norte')).toBeTruthy();
  });

  it('sin el nombre del sugerido, su id', async () => {
    const base = despachoDe(DETALLE_DESPACHADA_DTO);

    await renderizar({ ...base, prestadorSugeridoId: 'prv-auxilio-vial-norte' });
    expect(screen.getByText('El sistema sugería prv-auxilio-vial-norte')).toBeTruthy();
  });
});
