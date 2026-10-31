import { render, screen, within } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { ESTADO_ACTIVO_DTO, ESTADO_PARCIAL_DTO, ESTADO_REVOCADO_DTO } from '@testing/revocacion-pruebas';

import { EstadoRevocacionDto, mapearEstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';

import { HistorialConsentimientoComponent } from './historial-consentimiento.component';

async function renderizar(dto: EstadoRevocacionDto) {
  return render(HistorialConsentimientoComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { estado: mapearEstadoRevocacion(dto) },
  });
}

describe('HistorialConsentimientoComponent · canales (HU-W4.2-01)', () => {
  it('la entrada «Otorgado» muestra el canal con su entidad y la revocación su canal', async () => {
    await renderizar(ESTADO_REVOCADO_DTO);

    const pasos = screen.getAllByRole('listitem');
    expect(pasos[0].textContent).toContain('canal Banco Aliado (flujo embebido)');
    expect(pasos[1].textContent).toContain('canal Portal de cumplimiento');
  });
});

describe('HistorialConsentimientoComponent (HU-W4.2-02 · CA-5)', () => {
  it('lista una entrada por cambio, en orden, con ícono y texto', async () => {
    await renderizar(ESTADO_REVOCADO_DTO);

    const entradas = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(entradas.map((e) => e.querySelector('.paso__titulo')?.textContent?.trim())).toEqual([
      'Otorgado',
      'Revocación solicitada',
      'Consentimiento revocado en Solventa',
      'Revocación confirmada por la entidad',
    ]);
    expect(entradas.at(-1)?.getAttribute('aria-current')).toBe('step');
    expect(entradas[0].getAttribute('aria-current')).toBeNull();
  });

  it('muestra la entidad por nombre, el actor, el motivo y la referencia cuando existen', async () => {
    await renderizar(ESTADO_REVOCADO_DTO);

    const solicitada = screen.getByText('Revocación solicitada').closest('li')!;
    expect(solicitada.textContent).toContain('Analista de operaciones');
    expect(solicitada.textContent).toContain('Solicitud del cliente');
    expect(solicitada.textContent).toContain('Referencia TCK-2026-0412');
    const confirmada = screen.getByText('Revocación confirmada por la entidad').closest('li')!;
    expect(confirmada.textContent).toContain('Banco Aliado');
    expect(confirmada.textContent).toContain('Sistema');
  });

  it('rotula como «de la entidad» la referencia de una entrada de una entidad, y no la del ticket', async () => {
    const dto = structuredClone(ESTADO_REVOCADO_DTO);
    dto.history.at(-1)!.reference = 'of-rev-2';

    await renderizar(dto);

    const confirmada = screen.getByText('Revocación confirmada por la entidad').closest('li')!;
    expect(confirmada.textContent).toContain('Referencia de la entidad of-rev-2');
    const solicitada = screen.getByText('Revocación solicitada').closest('li')!;
    expect(solicitada.textContent).toContain('Referencia TCK-2026-0412');
    expect(solicitada.textContent).not.toContain('de la entidad');
  });

  it('muestra la hora en que la entidad no confirmó', async () => {
    await renderizar(ESTADO_PARCIAL_DTO);

    const entrada = screen.getByText('La entidad no confirmó en el plazo').closest('li')!;
    expect(entrada.textContent).toContain('Banco Aliado');
    expect(entrada.textContent).toMatch(/25\/10\/2026/);
  });

  it('sin revocaciones solo trae el otorgamiento', async () => {
    await renderizar(ESTADO_ACTIVO_DTO);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Otorgado')).toBeTruthy();
  });

  it('un estado, actor o motivo que el diccionario no conoce se muestran crudos', async () => {
    const dto = structuredClone(ESTADO_REVOCADO_DTO);
    dto.history.push({
      status: 'estado_nuevo',
      occurred_at: '2026-10-25T16:02:00Z',
      entity_code: 'otra-entidad',
      actor_type: 'robot',
      reason: 'motivo_nuevo',
      reference: null,
    });

    await renderizar(dto);

    const entrada = screen.getByText('estado_nuevo').closest('li')!;
    expect(entrada.textContent).toContain('otra-entidad');
    expect(entrada.textContent).toContain('robot');
    expect(entrada.textContent).toContain('motivo_nuevo');
  });
});
