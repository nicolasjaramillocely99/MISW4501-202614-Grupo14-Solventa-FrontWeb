import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  DETALLE_AL_DIA_DTO,
  DETALLE_CANCELADA_DTO,
  DETALLE_EN_GRACIA_DTO,
} from '@testing/cancelacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  DetallePoliza,
  ErrorPoliza,
  mapearDetallePoliza,
} from '@core/api/originacion/detalle-poliza.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { DetallePolizaPage, historialDe } from './detalle-poliza.page';

// HU-W1.6-02: A2 · Detalle de la póliza y A2b · Póliza cancelada por no pago.

describe('DetallePolizaPage (A2 y A2b · HU-W1.6-02)', () => {
  const api = {
    consultarPoliza: vi.fn<(id: string) => Observable<DetallePoliza>>(),
    descargarDocumentoContractual: vi.fn<(id: string) => Observable<Blob>>(),
  };

  async function renderizar(respuesta: Observable<DetallePoliza>, id = 'pol-acc-093377') {
    api.consultarPoliza.mockReturnValue(respuesta);
    return render(DetallePolizaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    });
  }

  beforeEach(() => vi.resetAllMocks());

  it('mientras consulta informa que carga', async () => {
    await renderizar(new Subject<DetallePoliza>());

    expect(screen.getByRole('status').textContent).toContain('Cargando la póliza');
  });

  it('A2b: dice el motivo, que no hay reembolso, la gracia vencida, los cobros rechazados y el aviso enviado', async () => {
    await renderizar(of(mapearDetallePoliza(DETALLE_CANCELADA_DTO)));

    expect(api.consultarPoliza).toHaveBeenCalledWith('pol-acc-093377');
    expect(screen.getByRole('heading', { level: 1, name: 'Vida · pol-acc-093377' })).toBeTruthy();
    expect(
      screen.getByText('Cancelada por no pago', { selector: 'app-insignia-estado' }),
    ).toBeTruthy();
    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('Póliza cancelada por incumplimiento de pago');
    expect(aviso.textContent).toContain('no genera reembolso');

    const detalle = within(screen.getByRole('region', { name: 'Detalle de la cancelación' }));
    expect(detalle.getByText('Reembolso').nextElementSibling?.textContent?.trim()).toBe(
      'No aplica',
    );
    expect(detalle.getByText('Motivo').nextElementSibling?.textContent).toContain(
      'No pago · cuota 2',
    );
    expect(detalle.getByText('Último pago recibido').nextElementSibling?.textContent).toContain(
      '12 de julio de 2026',
    );
    expect(detalle.getByText('Notificación').nextElementSibling?.textContent).toContain(
      'Correo y push enviados el 12 de septiembre de 2026',
    );
    expect(screen.getByRole('heading', { name: 'Coberturas (sin vigencia)' })).toBeTruthy();

    const historial = within(screen.getByRole('region', { name: 'Historial de cobros' }));
    const pasos = historial.getAllByRole('listitem');
    expect(pasos.map((p) => p.querySelector('.historial__titulo')?.textContent?.trim())).toEqual([
      'Cancelación automática',
      'Cobro de la cuota 2 rechazado (3 intentos)',
      'Cobro de la cuota 1 aplicado',
    ]);
    expect(pasos[1].textContent).toContain('fondos insuficientes');
    expect(screen.getByRole('heading', { name: '¿Qué puedo hacer?' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Mis pólizas' }).getAttribute('href')).toBe(
      '/originacion/polizas',
    );
  });

  it('una póliza en gracia avisa cuándo se cobra de nuevo y cuándo se cancela, y conserva la cobertura', async () => {
    await renderizar(of(mapearDetallePoliza(DETALLE_EN_GRACIA_DTO)), 'pol-acc-330417');

    expect(screen.getByText('Pago pendiente', { selector: 'app-insignia-estado' })).toBeTruthy();
    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('Tienes pendiente el pago de la cuota 4');
    expect(aviso.textContent).toContain('Conservas tu cobertura');
    expect(aviso.textContent).toContain('9 de septiembre de 2026');
    const resumen = within(screen.getByRole('region', { name: 'Resumen' }));
    expect(resumen.getByText('Estado de pago').nextElementSibling?.textContent).toContain(
      'Pago pendiente · cuota 4',
    );
    expect(resumen.getByText('Medio de pago').nextElementSibling?.textContent).toContain(
      'Visa •••• 0010',
    );
    expect(screen.getByRole('heading', { name: 'Coberturas' })).toBeTruthy();
  });

  it('A2: una póliza al día dice el próximo cobro y el medio de pago', async () => {
    await renderizar(of(mapearDetallePoliza(DETALLE_AL_DIA_DTO)), 'pol-acc-220331');

    expect(screen.getByText('Activa', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    const resumen = within(screen.getByRole('region', { name: 'Resumen' }));
    expect(resumen.getByText('Estado de pago').nextElementSibling?.textContent).toContain(
      'Al día · próximo cobro 1 de octubre de 2026',
    );
    expect(resumen.getByText('Prima mensual').nextElementSibling?.textContent).toContain('142.300');
    expect(screen.queryByRole('region', { name: 'Detalle de la cancelación' })).toBeNull();
  });

  it('A2 tiene todos los botones del prototipo; los que no tienen historia quedan deshabilitados', async () => {
    await renderizar(of(mapearDetallePoliza(DETALLE_AL_DIA_DTO)), 'pol-acc-220331');

    for (const nombre of ['Cancelar póliza', 'Solicitar modificación', 'Modificar', 'Ver todas']) {
      const boton = screen.getByRole('button', { name: nombre }) as HTMLButtonElement;
      expect(boton.disabled).toBe(true);
      expect(boton.getAttribute('aria-describedby')).toBe('proximamente');
    }
    expect(screen.getByText('Disponible próximamente.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Descargar póliza' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    const documentos = within(screen.getByRole('region', { name: 'Documentos' }));
    expect(
      (
        documentos.getByRole('button', {
          name: 'Descargar Condiciones particulares',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        documentos.getByRole('button', {
          name: 'Descargar Condiciones generales',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        documentos.getByRole('button', {
          name: 'Descargar Certificado de vigencia',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole('region', { name: 'Beneficiarios' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mis solicitudes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hablar con un asesor' })).toBeNull();
  });

  it('«Descargar póliza» baja el documento contractual, y si falla lo dice', async () => {
    const { detectChanges } = await renderizar(
      of(mapearDetallePoliza(DETALLE_AL_DIA_DTO)),
      'pol-acc-220331',
    );
    URL.createObjectURL = vi.fn().mockReturnValue('blob:poliza');
    URL.revokeObjectURL = vi.fn();
    api.descargarDocumentoContractual.mockReturnValue(of(new Blob(['%PDF'])));

    await userEvent.click(screen.getByRole('button', { name: 'Descargar póliza' }));
    expect(api.descargarDocumentoContractual).toHaveBeenCalledWith('pol-acc-220331');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:poliza');

    api.descargarDocumentoContractual.mockReturnValue(throwError(() => new Error('503')));
    await userEvent.click(
      screen.getByRole('button', { name: 'Descargar Condiciones particulares' }),
    );
    detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('No pudimos descargar la póliza');
  });

  it('A2b tiene «Hablar con un asesor» y «Solicitar nueva cotización», deshabilitados, y no los de A2', async () => {
    await renderizar(of(mapearDetallePoliza(DETALLE_CANCELADA_DTO)));

    for (const nombre of ['Hablar con un asesor', 'Solicitar nueva cotización']) {
      expect((screen.getByRole('button', { name: nombre }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    }
    expect(screen.queryByRole('button', { name: 'Descargar póliza' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Documentos' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Beneficiarios' })).toBeNull();
  });

  it('una póliza que no existe o no es del asegurado lo dice', async () => {
    await renderizar(throwError(() => new ErrorPoliza('policy_not_found')));

    expect(screen.getByRole('heading', { name: 'No encontramos la póliza' })).toBeTruthy();
  });

  it('si el servicio falla avisa y deja reintentar', async () => {
    await renderizar(throwError(() => new ErrorPoliza('renewal_unavailable')));
    api.consultarPoliza.mockReturnValue(of(mapearDetallePoliza(DETALLE_AL_DIA_DTO)));

    expect(screen.getByRole('alert').textContent).toContain('Intenta de nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('region', { name: 'Resumen' })).toBeTruthy();
  });
});

describe('historialDe', () => {
  it('una cuota sin intentos es pendiente y una con intentos, rechazada con sus fechas', () => {
    const p = mapearDetallePoliza(DETALLE_EN_GRACIA_DTO);
    const sinIntentos = mapearDetallePoliza({
      ...DETALLE_EN_GRACIA_DTO,
      payments: [{ ...DETALLE_EN_GRACIA_DTO.payments[0], attempts: [] }],
    });

    expect(historialDe(p)[0]).toMatchObject({
      tipo: 'rechazado',
      mes: 4,
      intentos: ['2026-09-02T12:00:00Z'],
      codigo: '51',
    });
    expect(historialDe(sinIntentos)[0]).toMatchObject({
      tipo: 'pendiente',
      fecha: '2026-09-01T12:00:00Z',
    });
  });
});
