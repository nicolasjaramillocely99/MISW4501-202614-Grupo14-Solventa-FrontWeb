import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DETALLE_AL_DIA_DTO } from '@testing/cancelacion-pruebas';
import {
  CANCELACION_EN_PROCESO_DTO,
  COTIZACION_CANCELACION_DTO,
  COTIZACION_DIA_SIGUIENTE_DTO,
  COTIZACION_EN_GRACIA_DTO,
  POLIZA_A_CANCELAR,
} from '@testing/cancelacion-voluntaria-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  CodigoErrorCancelacion,
  CotizacionCancelacion,
  ErrorCancelacion,
  SolicitudCancelacion,
  mapearCotizacionCancelacion,
} from '@core/api/originacion/cancelacion.modelos';
import { DetallePoliza, mapearDetallePoliza } from '@core/api/originacion/detalle-poliza.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { CancelacionAPedido, mapearCancelacion } from '@core/api/originacion/pago-poliza.modelos';

import { CancelarPolizaPage } from './cancelar-poliza.page';

// HU-W1.6-01: A5 · el cálculo del reembolso antes de confirmar (CA-1) y la confirmación (CA-2).

const POLIZA = mapearDetallePoliza(DETALLE_AL_DIA_DTO);
const COTIZACION = mapearCotizacionCancelacion(COTIZACION_CANCELACION_DTO);
const CANCELADA = mapearCancelacion(CANCELACION_EN_PROCESO_DTO) as CancelacionAPedido;
const falla = (codigo: CodigoErrorCancelacion, cotizacion: CotizacionCancelacion | null = null) =>
  throwError(() => new ErrorCancelacion(codigo, cotizacion));

describe('CancelarPolizaPage (A5 · HU-W1.6-01)', () => {
  const api = {
    consultarPoliza: vi.fn<(id: string) => Observable<DetallePoliza>>(),
    cotizarCancelacion: vi.fn<(id: string) => Observable<CotizacionCancelacion>>(),
    cancelarPoliza: vi.fn<(id: string, s: SolicitudCancelacion) => Observable<CancelacionAPedido>>(),
  };

  async function renderizar() {
    // La página puede navegar al iniciar (una póliza ya cancelada): el espía va antes de crearla.
    const navegar = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    const vista = await render(CancelarPolizaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: POLIZA_A_CANCELAR }) } } },
      ],
    });
    return { ...vista, navegar };
  }

  const confirmar = () => screen.getByRole('button', { name: 'Confirmar cancelación' }) as HTMLButtonElement;
  const casilla = () => screen.getByRole('checkbox') as HTMLInputElement;
  async function elegirYAceptar(): Promise<void> {
    await userEvent.selectOptions(screen.getByLabelText('Motivo de la cancelación'), 'mortgage_paid');
    await userEvent.click(casilla());
  }

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.resetAllMocks();
    api.consultarPoliza.mockReturnValue(of(POLIZA));
    api.cotizarCancelacion.mockReturnValue(of(COTIZACION));
    api.cancelarPoliza.mockReturnValue(of(CANCELADA));
  });

  it('muestra el cálculo y el monto antes de dejar confirmar (CA-1)', async () => {
    await renderizar();

    expect(api.cotizarCancelacion).toHaveBeenCalledWith(POLIZA_A_CANCELAR);
    expect(screen.getByRole('heading', { name: 'Cancelar póliza de vida hipotecario' })).toBeTruthy();
    const calculo = screen.getByRole('region', { name: 'Cálculo del reembolso' });
    expect(calculo.textContent).toContain('142.300 COP');
    expect(calculo.textContent).toContain('14 de 30');
    expect(calculo.textContent).toContain('46,7 %');
    expect(calculo.textContent).toContain('Visa •••• 1111 (medio de pago original)');
    expect(calculo.textContent).toMatch(/Hoy, \d{2}\/\d{2}\/2026, al final del día/);
    expect(screen.getByRole('region', { name: 'Monto a reembolsar' }).textContent).toContain('66.406 COP');
    expect(confirmar().disabled).toBe(true);
  });

  it('pide el motivo y la casilla, confirma con el monto visto y vuelve al detalle (CA-2)', async () => {
    const { navegar } = await renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Motivo de la cancelación'), 'mortgage_paid');
    expect(confirmar().disabled).toBe(true);
    await userEvent.click(casilla());
    await userEvent.type(screen.getByLabelText('Comentarios (opcional)'), 'Pagué el crédito');
    expect(confirmar().disabled).toBe(false);
    await userEvent.click(confirmar());

    expect(api.cancelarPoliza).toHaveBeenCalledWith(POLIZA_A_CANCELAR, {
      motivo: 'mortgage_paid',
      comentarios: 'Pagué el crédito',
      montoReembolso: 66406,
    });
    expect(navegar).toHaveBeenCalledWith(['/originacion/polizas', POLIZA_A_CANCELAR]);
  });

  it('«Conservar mi póliza» vuelve al detalle sin cancelar', async () => {
    await renderizar();

    const conservar = screen.getByRole('link', { name: 'Conservar mi póliza' });
    expect(conservar.getAttribute('href')).toBe(`/originacion/polizas/${POLIZA_A_CANCELAR}`);
    expect(api.cancelarPoliza).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: 'Solicitar modificación' }).getAttribute('href'),
    ).toBe(`/originacion/polizas/${POLIZA_A_CANCELAR}/modificar`);
  });

  it('si el monto cambió muestra el nuevo y pide aceptarlo otra vez', async () => {
    api.cancelarPoliza.mockReturnValueOnce(
      falla('refund_changed', mapearCotizacionCancelacion(COTIZACION_DIA_SIGUIENTE_DTO)),
    );
    const { navegar } = await renderizar();
    await elegirYAceptar();

    await userEvent.click(confirmar());

    expect(screen.getByRole('alert').textContent).toContain('El monto a reembolsar cambió');
    expect(screen.getByRole('region', { name: 'Monto a reembolsar' }).textContent).toContain('61.663 COP');
    expect(casilla().checked).toBe(false);
    expect(confirmar().disabled).toBe(true);
    expect(navegar).not.toHaveBeenCalled();

    await userEvent.click(casilla());
    await userEvent.click(confirmar());
    expect(api.cancelarPoliza).toHaveBeenLastCalledWith(POLIZA_A_CANCELAR, expect.objectContaining({ montoReembolso: 61663 }));
  });

  it('con la cuota en cobro avisa y deja intentar de nuevo', async () => {
    api.cancelarPoliza.mockReturnValueOnce(falla('payment_in_progress'));
    await renderizar();
    await elegirYAceptar();

    await userEvent.click(confirmar());

    expect(screen.getByRole('alert').textContent).toContain('Estamos cobrando la cuota de este mes');
    expect(confirmar().disabled).toBe(false);
  });

  it('con la cuota en gracia el reembolso es 0 y no aplica (D-6 a)', async () => {
    api.cotizarCancelacion.mockReturnValue(of(mapearCotizacionCancelacion(COTIZACION_EN_GRACIA_DTO)));
    await renderizar();

    const calculo = screen.getByRole('region', { name: 'Cálculo del reembolso' });
    expect(calculo.textContent).toContain('no está pagada: está en periodo de gracia');
    expect(calculo.textContent).toContain('cuota sin pagar');
    expect(calculo.textContent).toContain('No aplica');
    expect(screen.getByRole('region', { name: 'Monto a reembolsar' }).textContent).toMatch(/\$\s0 COP/);
    expect(screen.getByText('Entiendo que la cancelación es definitiva y que no hay reembolso.')).toBeTruthy();
  });

  it('una renovación en curso bloquea la cancelación sin mostrar el cálculo', async () => {
    api.cotizarCancelacion.mockReturnValue(falla('renewal_in_progress'));
    await renderizar();

    expect(screen.getByText('Esta póliza no se puede cancelar por ahora')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Cálculo del reembolso' })).toBeNull();
    expect(confirmar().disabled).toBe(true);
  });

  it('si no se pudo calcular ofrece reintentar', async () => {
    api.cotizarCancelacion.mockReturnValueOnce(falla('cancellation_unavailable'));
    await renderizar();

    expect(screen.getByRole('alert').textContent).toContain('No pudimos calcular tu reembolso');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('region', { name: 'Cálculo del reembolso' })).toBeTruthy();
  });

  it('una póliza ya cancelada lleva a su detalle', async () => {
    api.cotizarCancelacion.mockReturnValue(falla('policy_already_cancelled'));
    const { navegar } = await renderizar();

    expect(navegar).toHaveBeenCalledWith(['/originacion/polizas', POLIZA_A_CANCELAR]);
  });
});
