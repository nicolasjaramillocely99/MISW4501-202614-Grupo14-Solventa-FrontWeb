import { render, screen, within } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import {
  RENOVACION_DEL_ASEGURADO_DTO,
  RENOVACION_FORMALIZADA_DTO,
  RENOVACION_NO_RENOVADA_DTO,
  RENOVACION_PAGO_FALLIDO_DTO,
  RENOVACION_RENOVADA_DTO,
} from '@testing/renovacion-asistida-pruebas';

import { EmisionContractual } from '@core/api/originacion/emision-contractual.modelos';
import { RenovacionAsistidaDto, mapearRenovacionAsistida } from '@core/api/originacion/renovacion-asistida.modelos';

import { EstadoCobroRenovacionComponent } from './estado-cobro-renovacion.component';

const EMISION: EmisionContractual = {
  polizaId: 'pol-ren-118204',
  estado: 'completed',
  activadaEn: '2026-09-16T21:07:00Z',
  disponibleEn: '2026-09-16T21:07:05Z',
  dentroDelPlazo: true,
  documento: { documentoId: 'doc-1', version: 1, tamanoBytes: 2048, generadoEn: '2026-09-16T21:07:05Z' },
  notificacion: { canal: 'email', estado: 'sent', intentos: 0, enviadaEn: '2026-09-16T21:07:06Z' },
};

async function renderizar(dto: RenovacionAsistidaDto, emision: EmisionContractual | null = null) {
  const vista = mapearRenovacionAsistida(dto);
  return render(EstadoCobroRenovacionComponent, {
    imports: [proveerTranslocoPruebas()],
    inputs: {
      renovacion: vista.renovacion!,
      cobro: vista.cobro,
      medioDePago: vista.medioDePago,
      emision,
      nuevaVigenciaDesde: vista.renovacion?.condiciones?.vigenciaDesde ?? null,
      nuevaVigenciaHasta: vista.renovacion?.condiciones?.vigenciaHasta ?? null,
    },
  });
}

function fila(nombre: string): HTMLElement {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(nombre)) as HTMLElement;
}

describe('EstadoCobroRenovacionComponent (HU-W1.5-03 · CA-3, 01·D-3 a+)', () => {
  it('con el cobro en curso: la tarjeta registrada y los pasos pendientes', async () => {
    await renderizar(RENOVACION_FORMALIZADA_DTO);

    expect(screen.getByRole('heading', { name: 'Emisión de la renovación' })).toBeTruthy();
    expect(fila('Cobro de la prima').textContent).toMatch(/Visa •••• 1111 · iniciado el/);
    expect(fila('Cobro de la prima').textContent).toContain('En curso');
    expect(fila('Certificado renovado').textContent).toContain('Pendiente');
    expect(fila('Notificación al cliente').textContent).toContain('Pendiente');
    expect(screen.getByText(/Cuando el pago se confirme, aquí aparecen la póliza nueva/)).toBeTruthy();
  });

  it('renovada: el cobro confirmado, el certificado con la póliza nueva y el correo enviado', async () => {
    await renderizar(RENOVACION_RENOVADA_DTO, EMISION);

    expect(fila('Cobro de la prima').textContent).toMatch(/Confirmado el 16\/09\/2026, \d{2}:\d{2} · Visa •••• 1111/);
    expect(fila('Certificado renovado').textContent).toContain('Póliza nueva pol-ren-118204 · vigente del 02/10/2026 al 02/10/2027');
    expect(fila('Certificado renovado').textContent).toContain('Emitido');
    expect(fila('Notificación al cliente').textContent).toContain('Enviada');
    expect(screen.getByText(/la nueva vence el 02\/10\/2027/)).toBeTruthy();
  });

  it('pago fallido: la fecha del rechazo y hasta cuándo puede reintentar el cliente', async () => {
    await renderizar(RENOVACION_PAGO_FALLIDO_DTO);

    const cobro = fila('Cobro de la prima');
    expect(cobro.textContent).toMatch(/Rechazado el 16\/09\/2026.* · reintento hasta el 19\/09\/2026/);
    expect(cobro.textContent).toContain('Falló');
    expect(screen.getByText(/puede reintentar con otro medio de pago desde su portal/)).toBeTruthy();
  });

  it('renovación del asegurado con otro medio: el cobro sin tarjeta', async () => {
    await renderizar({ ...RENOVACION_DEL_ASEGURADO_DTO, payment_method: null });

    expect(fila('Cobro de la prima').textContent).toMatch(/Iniciado el 16\/09\/2026/);
  });

  it('no renovada: dice por qué y no muestra el certificado', async () => {
    await renderizar(RENOVACION_NO_RENOVADA_DTO);

    expect(fila('Cobro de la prima').textContent).toContain('El pago no se logró dentro del plazo');
    expect(fila('Cobro de la prima').textContent).toContain('No renovada');
    expect(screen.queryByText('Certificado renovado')).toBeNull();
    expect(screen.getByText('La póliza no se renovó para este periodo.')).toBeTruthy();
  });
});
