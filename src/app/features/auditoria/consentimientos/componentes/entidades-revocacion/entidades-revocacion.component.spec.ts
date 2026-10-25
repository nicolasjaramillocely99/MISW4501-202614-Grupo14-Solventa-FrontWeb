import { render, screen, within } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import {
  ESTADO_ACTIVO_DTO,
  ESTADO_EN_CURSO_DTO,
  ESTADO_PARCIAL_DTO,
  ESTADO_REVOCADO_DTO,
  ESTADO_VENCIDO_DTO,
} from '@testing/revocacion-pruebas';

import { EstadoRevocacionDto, mapearEstadoRevocacion } from '@core/api/auditoria/revocacion.modelos';

import { EntidadesRevocacionComponent } from './entidades-revocacion.component';

async function renderizar(dto: EstadoRevocacionDto) {
  return render(EntidadesRevocacionComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: { estado: mapearEstadoRevocacion(dto) },
  });
}

const fila = (nombre: string) => screen.getByRole('row', { name: new RegExp(nombre) });
// Hora local de la prueba: Intl con la zona del entorno.
const hora = (iso: string) => new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

describe('EntidadesRevocacionComponent (HU-W4.2-02)', () => {
  it('sin revocación muestra solo el estado del consentimiento en cada entidad', async () => {
    await renderizar(ESTADO_ACTIVO_DTO);

    const tabla = screen.getByRole('table', { name: 'Entidades financieras autorizadas' });
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual(['Entidad', 'Estado en la entidad']);
    expect(within(fila('Banco Aliado')).getByText('Activo')).toBeTruthy();
    expect(screen.queryByText(/NIT/)).toBeNull();
  });

  it('un consentimiento vencido lo dice en cada entidad', async () => {
    await renderizar(ESTADO_VENCIDO_DTO);

    expect(within(fila('Banco Aliado')).getByText('Vencido')).toBeTruthy();
  });

  it('con el aviso en curso la entidad está pendiente con la hora de su plazo', async () => {
    await renderizar(ESTADO_EN_CURSO_DTO);

    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual([
      'Entidad',
      'Revocación',
      'Confirmación',
    ]);
    const celdas = fila('Banco Aliado');
    expect(within(celdas).getByText('Pendiente')).toBeTruthy();
    expect(celdas.textContent).toContain(`Plazo hasta ${hora('2026-10-25T16:05:00.123456Z')}`);
  });

  it('una entidad que confirmó dice «Revocado» y cuándo', async () => {
    await renderizar(ESTADO_REVOCADO_DTO);

    const celdas = fila('Banco Aliado');
    expect(within(celdas).getByText('Revocado')).toBeTruthy();
    expect(celdas.textContent).toMatch(/Confirmó el 25\/10\/2026/);
  });

  it('una entidad que no confirmó dice «Sin confirmación» y la hora en que se agotó el plazo', async () => {
    await renderizar(ESTADO_PARCIAL_DTO);

    const celdas = fila('Banco Aliado');
    expect(within(celdas).getByText('Sin confirmación')).toBeTruthy();
    expect(celdas.textContent).toContain(`Tiempo agotado a las ${hora('2026-10-25T16:05:00.123456Z')}`);
  });
});
