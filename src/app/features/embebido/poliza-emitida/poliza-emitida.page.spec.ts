import { ActivatedRoute, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  EMISION_COMPLETADA_DTO,
  EMISION_PENDIENTE_DTO,
} from '@testing/emision-contractual-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  EmisionContractual,
  ErrorEmisionContractual,
  mapearEmisionContractual,
} from '@core/api/originacion/emision-contractual.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';
import { INTERVALO_CONSULTA_MS, PolizaEmitidaPage } from './poliza-emitida.page';

const COMPLETADA = mapearEmisionContractual(EMISION_COMPLETADA_DTO);
const PENDIENTE = mapearEmisionContractual(EMISION_PENDIENTE_DTO);
const LISTO_SIN_CORREO: EmisionContractual = {
  ...COMPLETADA,
  estado: 'failed',
  notificacion: { canal: 'email', estado: 'failed', intentos: 12, enviadaEn: null },
};

describe('PolizaEmitidaPage (E5 · HU-W1.3-03)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<EmisionContractual>>>;
  let descargar: ReturnType<typeof vi.fn<(id: string) => Observable<Blob>>>;

  async function renderizar(
    respuesta: Observable<EmisionContractual>,
    { solicitud = false } = {},
    ...siguientes: Observable<EmisionContractual>[]
  ) {
    const respuestas = [respuesta, ...siguientes];
    consultar = vi.fn();
    for (const r of respuestas) {
      consultar.mockReturnValueOnce(r);
    }
    consultar.mockReturnValue(respuestas[respuestas.length - 1]);
    descargar = vi.fn().mockReturnValue(of(new Blob(['%PDF-1'])));
    return render(PolizaEmitidaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        {
          provide: OriginacionApiService,
          useValue: {
            consultarEmisionContractual: consultar,
            descargarDocumentoContractual: descargar,
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { polizaId: 'pol-3f1c' } } } },
      ],
      configureTestBed: (bed) => {
        if (solicitud) {
          bed.inject(FlujoEmbebidoService).solicitud.set({
            numero: '48213',
            aliado: 'Banco Aliado',
            banco: 'Banco Aliado',
            montoAprobado: 250_000_000,
            plazoAnios: 20,
            cuotaEstimada: 2_180_000,
            moneda: 'COP',
          });
        }
      },
    });
  }

  it('mientras consulta informa que carga', async () => {
    await renderizar(new Subject<EmisionContractual>());

    expect(consultar).toHaveBeenCalledWith('pol-3f1c');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Consultando tu póliza');
  });

  it('con la emisión completada muestra el documento disponible, el correo enviado y permite descargar', async () => {
    await renderizar(of(COMPLETADA));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('¡Tu póliza está activa!');
    expect(screen.getByText(/Póliza N\.º pol-3f1c · Cobertura activa desde el/)).toBeTruthy();
    expect(screen.getByText(/Condiciones generales y particulares · PDF · 2,3 KB/)).toBeTruthy();
    expect(screen.getByText('Confirmación enviada')).toBeTruthy();
    expect(
      screen.getByText(
        /Enviamos la notificación de emisión y el documento a tu correo electrónico/,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Administra tu póliza desde la app Solventa')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Descargar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('lleva al portal del asegurado desde «Ver mi póliza en el portal»', async () => {
    await renderizar(of(COMPLETADA));

    expect(
      screen.getByRole('link', { name: 'Ver mi póliza en el portal' }).getAttribute('href'),
    ).toBe('/inicio');
  });

  it('sin la solicitud del aliado muestra el contexto genérico y no dibuja la tarjeta «Tu crédito»', async () => {
    await renderizar(of(COMPLETADA));

    expect(screen.getByText('Crédito de vivienda · Seguro de vida hipotecario')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Tu crédito' })).toBeNull();
    expect(document.querySelector('.pagina--sola')).not.toBeNull();
  });

  it('con la solicitud del flujo muestra «Tu crédito» y el número de la solicitud', async () => {
    await renderizar(of(COMPLETADA), { solicitud: true });

    expect(screen.getByRole('heading', { name: 'Tu crédito' })).toBeTruthy();
    expect(screen.getByText(/Solicitud N\.º 48213/)).toBeTruthy();
    expect(document.querySelector('.pagina--sola')).toBeNull();
  });

  it('descarga el PDF de la póliza al pulsar el botón', async () => {
    const usuario = userEvent.setup();
    const crear = vi.fn().mockReturnValue('blob:pdf');
    const revocar = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: revocar });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await renderizar(of(COMPLETADA));

    await usuario.click(screen.getByRole('button', { name: 'Descargar' }));

    expect(descargar).toHaveBeenCalledWith('pol-3f1c');
    expect(crear).toHaveBeenCalled();
    expect(clic).toHaveBeenCalled();
    expect(revocar).toHaveBeenCalledWith('blob:pdf');
    clic.mockRestore();
    vi.unstubAllGlobals();
  });

  it('un fallo al descargar muestra la alerta y deja reintentar', async () => {
    const usuario = userEvent.setup();
    await renderizar(of(COMPLETADA));
    descargar.mockReturnValue(
      throwError(() => new ErrorEmisionContractual('document_unavailable')),
    );

    await usuario.click(screen.getByRole('button', { name: 'Descargar' }));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos descargar el documento');
    expect((screen.getByRole('button', { name: 'Descargar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('si el correo no se pudo entregar avisa, pero el documento sigue disponible', async () => {
    await renderizar(of(LISTO_SIN_CORREO));

    expect(screen.getByText('No pudimos entregar el correo')).toBeTruthy();
    expect(screen.getByText(/No logramos enviarte el correo/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Descargar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  describe('seguimiento (polling)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('mientras el documento no está listo deshabilita la descarga y consulta cada 2 s hasta completar', async () => {
      const { fixture } = await renderizar(of(PENDIENTE), {}, of(PENDIENTE), of(COMPLETADA));

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'Estamos preparando tu documento',
      );
      expect(screen.getByText(/Estamos generando el documento/)).toBeTruthy();
      expect(
        (screen.getByRole('button', { name: 'Descargar' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(consultar).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_MS);
      expect(consultar).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_MS);
      expect(consultar).toHaveBeenCalledTimes(3);

      fixture.detectChanges();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('¡Tu póliza está activa!');
      await vi.advanceTimersByTimeAsync(10 * INTERVALO_CONSULTA_MS);
      expect(consultar).toHaveBeenCalledTimes(3);
    });

    it('con la notificación reintentándose lo dice mientras el documento ya está disponible', async () => {
      const reintentando: EmisionContractual = {
        ...COMPLETADA,
        estado: 'document_ready',
        notificacion: { canal: 'email', estado: 'pending', intentos: 2, enviadaEn: null },
      };
      await renderizar(of(reintentando));

      expect(screen.getByText(/lo seguimos intentando/)).toBeTruthy();
      expect(
        (screen.getByRole('button', { name: 'Descargar' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  describe('errores', () => {
    it('una póliza sin emisión aún lo dice y permite reintentar', async () => {
      const usuario = userEvent.setup();
      await renderizar(throwError(() => new ErrorEmisionContractual('policy_not_found')));

      expect(screen.getByRole('alert').textContent).toContain('Aún no encontramos una emisión');

      consultar.mockReturnValue(of(COMPLETADA));
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(consultar).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('¡Tu póliza está activa!');
    });

    it('una póliza de otro asegurado no ofrece reintentar', async () => {
      await renderizar(throwError(() => new ErrorEmisionContractual('forbidden')));

      expect(screen.getByRole('alert').textContent).toContain('no está asociada a tu sesión');
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('un fallo del servicio muestra el error genérico', async () => {
      await renderizar(throwError(() => new ErrorEmisionContractual('document_unavailable')));

      expect(screen.getByRole('alert').textContent).toContain(
        'Hubo un problema al consultar tu póliza',
      );
    });
  });
});
