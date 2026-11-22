import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  DETALLE_CON_SUGERENCIA_DTO,
  SUGERENCIA_AGOTADA_DTO,
  SUGERENCIA_ENCONTRADA_DTO,
  SUGERENCIA_SIN_NECESIDAD_DTO,
  SUGERENCIA_SIN_UBICACION_DTO,
  detalleCon,
} from '@testing/asistencia-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { SugerenciaDto, mapearDetalleAsistencia } from '@core/api/siniestros/asistencia.modelos';

import { CandidatosAsistenciaComponent } from './candidatos-asistencia.component';

const sugerencia = (dto: SugerenciaDto) =>
  mapearDetalleAsistencia(detalleCon(DETALLE_CON_SUGERENCIA_DTO, { suggestion: dto })).sugerencia;

describe('CandidatosAsistenciaComponent (O9b · HU-W2.3-03, S14)', () => {
  const renderizar = async (
    dto: SugerenciaDto,
    entradas: {
      despachable?: boolean;
      deshabilitado?: boolean;
      radioMaximoKm?: number | null;
    } = {},
  ) => {
    const despachar = vi.fn();
    const buscarDeNuevo = vi.fn();
    const cerrarSinPrestador = vi.fn();
    await render(CandidatosAsistenciaComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { sugerencia: sugerencia(dto), hoy: '2026-11-21', radioMaximoKm: 20, ...entradas },
      on: { despachar, buscarDeNuevo, cerrarSinPrestador },
    });
    return { despachar, buscarDeNuevo, cerrarSinPrestador, usuario: userEvent.setup() };
  };

  const fila = (nombre: string) =>
    screen.getByRole('rowheader', { name: new RegExp(`^${nombre}`) }).closest('tr') as HTMLElement;

  it('found: solo los despachables en la tabla, con distancia, llegada y el sugerido (CA-2)', async () => {
    await renderizar(SUGERENCIA_ENCONTRADA_DTO);

    expect(screen.getByRole('heading', { name: 'Prestadores cercanos' })).toBeTruthy();
    const tabla = screen.getByRole('table', {
      name: 'Prestadores que se pueden despachar, del más cercano al más lejano',
    });
    expect(within(tabla).getAllByRole('row')).toHaveLength(3);

    const sugerido = within(fila('Grúas Autopista Norte'));
    expect(sugerido.getByText('Sin despachos hoy')).toBeTruthy();
    expect(sugerido.getByText('Grúa')).toBeTruthy();
    expect(sugerido.getByText('0,9 km')).toBeTruthy();
    expect(sugerido.getByText('12 min')).toBeTruthy();
    expect(sugerido.getByText('Sugerido')).toBeTruthy();
    expect(fila('Grúas Autopista Norte').classList).toContain('candidatos__fila--sugerida');

    const otro = within(fila('Auxilio Vial Norte'));
    expect(otro.getByText('Asistencia vial · Grúa')).toBeTruthy();
    expect(otro.getByText('15 min')).toBeTruthy();
    expect(otro.queryByText('Sugerido')).toBeNull();
    expect(fila('Auxilio Vial Norte').classList).not.toContain('candidatos__fila--sugerida');
  });

  it('la llegada lleva el tono del umbral provisional', async () => {
    await renderizar({
      ...SUGERENCIA_ENCONTRADA_DTO,
      candidates: SUGERENCIA_ENCONTRADA_DTO.candidates.map((c, i) => ({
        ...c,
        eligibility: 'eligible' as const,
        eta_minutes: [12, 16, 31, 606][i],
      })),
    });

    const tono = (texto: string) => screen.getByText(texto).closest('.insignia')?.className ?? '';
    expect(tono('12 min')).toContain('exito');
    expect(tono('16 min')).toContain('advertencia');
    expect(tono('31 min')).toContain('neutro');
  });

  it('«Despachar» lleva el nombre del prestador y emite el candidato', async () => {
    const { despachar, usuario } = await renderizar(SUGERENCIA_ENCONTRADA_DTO);

    await usuario.click(screen.getByRole('button', { name: 'Despachar a Auxilio Vial Norte' }));

    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({ prestadorId: 'prv-auxilio-vial-norte' }),
    );
  });

  it('los demás van plegados, sin acción, con su disponibilidad', async () => {
    await renderizar(SUGERENCIA_ENCONTRADA_DTO);

    const otros = screen
      .getByText('Otros prestadores con la especialidad (2) · no se pueden despachar')
      .closest('details') as HTMLElement;
    expect(otros.hasAttribute('open')).toBe(false);
    expect(within(otros).getByText('Grúas Calle 80')).toBeTruthy();
    expect(within(otros).getByText('297,6 km')).toBeTruthy();
    expect(within(otros).getAllByText('Fuera del radio')).toHaveLength(2);
    expect(within(otros).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Despachar a Grúas Calle 80' })).toBeNull();
  });

  it('sin la llamada en curso o con otra escritura, no se despacha', async () => {
    await renderizar(SUGERENCIA_ENCONTRADA_DTO, { deshabilitado: true });
    expect(
      (
        screen.getByRole('button', {
          name: 'Despachar a Grúas Autopista Norte',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('exhausted: las búsquedas hechas y las dos salidas', async () => {
    const { buscarDeNuevo, cerrarSinPrestador, usuario } = await renderizar(SUGERENCIA_AGOTADA_DTO);

    expect(screen.getByText('No hay prestadores disponibles a 20 km o menos')).toBeTruthy();
    expect(screen.getByText('5 km · 0 disponibles')).toBeTruthy();
    expect(screen.getByText('10 km · 0 disponibles')).toBeTruthy();
    expect(screen.getByText('20 km · 0 disponibles')).toBeTruthy();
    expect(screen.queryByRole('table', { name: /se pueden despachar, del/ })).toBeNull();
    expect(screen.getByText('Disponible mañana')).toBeTruthy();

    await usuario.click(screen.getByRole('button', { name: 'Buscar de nuevo' }));
    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar como «Sin prestador disponible»' }),
    );
    expect(buscarDeNuevo).toHaveBeenCalled();
    expect(cerrarSinPrestador).toHaveBeenCalled();
  });

  it('un intento con un solo elegible va en singular', async () => {
    await renderizar({
      ...SUGERENCIA_AGOTADA_DTO,
      attempts: [{ radius_km: 5, eligible_count: 1, attempted_at: '2026-11-21T16:16:11Z' }],
    });

    expect(screen.getByText('5 km · 1 disponible')).toBeTruthy();
  });

  it.each([
    [SUGERENCIA_SIN_NECESIDAD_DTO, 'Elige la necesidad para ver los prestadores sugeridos.'],
    [SUGERENCIA_SIN_UBICACION_DTO, 'Registra la ubicación para ver los prestadores sugeridos.'],
  ])('dice qué falta para ver la sugerencia (%#)', async (dto, texto) => {
    await renderizar(dto);

    expect(screen.getByText(texto)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
