import { ActivatedRoute, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { COTIZACION_DTO } from '@testing/cotizacion-asistida-pruebas';
import { CONFIRMACION_ENVIADA_DTO, FORMALIZACION_DTO } from '@testing/formalizacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  CotizacionAsistida,
  ErrorCotizacionAsistida,
  mapearCotizacionAsistida,
} from '@core/api/originacion/cotizacion-asistida.modelos';
import {
  CodigoErrorFormalizacion,
  ErrorDeCampoFormalizacion,
  ErrorFormalizacion,
  mapearConfirmacionEnviada,
  mapearFormalizacion,
} from '@core/api/originacion/formalizacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { FormalizarCompraPage, aFechaHoraLocal } from './formalizar-compra.page';

const VIGENTE = mapearCotizacionAsistida(COTIZACION_DTO);
const VENCIDA: CotizacionAsistida = { ...VIGENTE, estado: 'expired', puedeFormalizar: false, motivoBloqueo: 'quote_expired' };
const ENVIO = mapearConfirmacionEnviada(CONFIRMACION_ENVIADA_DTO);
const FORMALIZACION = mapearFormalizacion(FORMALIZACION_DTO);
const falla = (codigo: CodigoErrorFormalizacion, campos: ErrorDeCampoFormalizacion[] = []) =>
  throwError(() => new ErrorFormalizacion(codigo, campos));
const sinFormalizar = () => falla('formalization_not_found');

describe('FormalizarCompraPage (S3 / S3c · HU-W1.1-03)', () => {
  const api = {
    consultarCotizacionAsistida: vi.fn<(id: string) => Observable<CotizacionAsistida>>(),
    consultarFormalizacion: vi.fn(),
    solicitarConfirmacion: vi.fn(),
    formalizarCompra: vi.fn(),
  };

  async function renderizar(cotizacion: Observable<CotizacionAsistida> = of(VIGENTE)) {
    api.consultarCotizacionAsistida.mockReturnValue(cotizacion);
    return render(FormalizarCompraPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: VIGENTE.cotizacionId } } } },
      ],
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.consultarFormalizacion.mockReturnValue(sinFormalizar());
    api.solicitarConfirmacion.mockReturnValue(of(ENVIO));
    api.formalizarCompra.mockReturnValue(of({ formalizacion: FORMALIZACION, creada: true }));
  });

  const confirmar = () => userEvent.click(screen.getByRole('checkbox', { name: /Confirmo que el cliente aceptó/ }));
  const formalizar = () => userEvent.click(screen.getByRole('button', { name: 'Formalizar y emitir' }));
  const elegirMedio = (nombre: string) => userEvent.selectOptions(screen.getByLabelText('Medio de aceptación'), nombre);

  /** Llamada grabada con su referencia, confirmada: lo mínimo para formalizar. */
  async function completarLlamada(referencia = 'GRAB-2026-88910') {
    await userEvent.type(screen.getByLabelText('Referencia'), referencia);
    await confirmar();
  }

  it('mientras consulta la cotización informa que carga', async () => {
    await renderizar(new Subject<CotizacionAsistida>());

    expect(screen.getByRole('status').textContent).toContain('Cargando la cotización');
  });

  it('una cotización inexistente ofrece generar una nueva', async () => {
    await renderizar(throwError(() => new ErrorCotizacionAsistida('quote_not_found')));

    expect(screen.getByRole('heading', { name: 'No encontramos la cotización' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nueva cotización' }).getAttribute('href')).toBe('/originacion/cotizaciones/nueva');
  });

  it('si falla la consulta avisa y deja reintentar', async () => {
    await renderizar(throwError(() => new ErrorCotizacionAsistida('quote_unavailable')));
    api.consultarCotizacionAsistida.mockReturnValue(of(VIGENTE));

    expect(screen.getByRole('alert').textContent).toContain('Hubo un problema al consultar la cotización');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Formalizar compra' })).toBeTruthy();
  });

  describe('cotización vigente (S3, CA-1)', () => {
    it('muestra el encabezado con la insignia, el regreso a la cotización y las acciones', async () => {
      await renderizar();

      expect(screen.getByRole('heading', { level: 1, name: 'Formalizar compra' })).toBeTruthy();
      expect(screen.getByText('Cotización vigente')).toBeTruthy();
      expect(screen.getByText(/La formalización dispara la emisión sin pasos manuales adicionales/)).toBeTruthy();
      const volver = `/originacion/cotizaciones/${VIGENTE.cotizacionId}`;
      expect(screen.getByRole('link', { name: `← Cotización ${VIGENTE.cotizacionId}` }).getAttribute('href')).toBe(volver);
      expect(screen.getByRole('link', { name: 'Volver a la cotización' }).getAttribute('href')).toBe(volver);
      expect(screen.getByRole('button', { name: 'Formalizar y emitir' })).toBeTruthy();
    });

    it('muestra la confirmación de datos del cliente y las condiciones ofertadas', async () => {
      await renderizar();

      expect(screen.getByRole('heading', { name: 'Confirmación de datos del cliente' })).toBeTruthy();
      expect(screen.getByText('Ana María Pérez')).toBeTruthy();
      expect(screen.getByText('1032456789')).toBeTruthy();
      expect(screen.getByText('ana@example.com')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Condiciones ofertadas' })).toBeTruthy();
      expect(screen.getByText(/132\.800 COP/)).toBeTruthy();
      expect(screen.getByText('15 años')).toBeTruthy();
      expect(screen.getByText('Cotización vigente hasta')).toBeTruthy();
      expect(screen.getByText('Fallecimiento del asegurado')).toBeTruthy();
    });

    it('explica qué ocurre al formalizar y qué queda registrado', async () => {
      await renderizar();

      expect(screen.getByRole('heading', { name: 'Qué ocurre al formalizar' })).toBeTruthy();
      for (const paso of ['Suscripción automática', 'Cobro de la prima', 'Activación de la cobertura', 'Documento y notificación']) {
        expect(screen.getByText(paso)).toBeTruthy();
      }
      expect(screen.getByRole('heading', { name: 'Registro' })).toBeTruthy();
      expect(screen.getByText(/Queda registrado: asesor, fecha y hora, cotización de origen/)).toBeTruthy();
    });

    it('ofrece los tres medios de aceptación, con la llamada grabada y la hora actual por defecto', async () => {
      await renderizar();

      const medio = screen.getByLabelText('Medio de aceptación') as HTMLSelectElement;
      expect(Array.from(medio.options).map((o) => o.text)).toEqual(['Llamada grabada', 'Firma remota', 'Código de confirmación']);
      expect(medio.value).toBe('recorded_call');
      expect((screen.getByLabelText('Fecha y hora') as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(screen.getByText('DD/MM/AAAA · HH:MM')).toBeTruthy();
      expect(screen.queryByLabelText('Código de confirmación')).toBeNull();
    });

    it('no formaliza sin la referencia ni la confirmación, y señala cada campo', async () => {
      await renderizar();

      await formalizar();

      expect(screen.getByText('Indica la referencia de la grabación o de la firma.')).toBeTruthy();
      expect(screen.getByText('Confirma que el cliente aceptó las condiciones y autorizó el cobro.')).toBeTruthy();
      expect((screen.getByLabelText('Referencia') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
      expect(api.formalizarCompra).not.toHaveBeenCalled();
    });

    it('no admite que el cliente haya aceptado en el futuro', async () => {
      await renderizar();
      await completarLlamada();

      fireEvent.input(screen.getByLabelText('Fecha y hora'), { target: { value: '2999-01-01T10:00' } });
      await formalizar();

      expect(screen.getByText(/no pudo aceptar en el futuro/)).toBeTruthy();
      expect(api.formalizarCompra).not.toHaveBeenCalled();
    });

    it('formaliza con la llamada grabada, su referencia y la fecha elegida (CA-1, CA-5)', async () => {
      await renderizar();
      fireEvent.input(screen.getByLabelText('Fecha y hora'), { target: { value: '2026-10-16T15:40' } });
      await completarLlamada();

      await formalizar();

      expect(api.formalizarCompra).toHaveBeenCalledWith(VIGENTE.cotizacionId, {
        metodo: 'recorded_call',
        aceptadaEn: new Date('2026-10-16T15:40').toISOString(),
        referencia: 'GRAB-2026-88910',
        codigo: '',
      });
      expect(api.solicitarConfirmacion).not.toHaveBeenCalled();
    });

    it('muestra la compra formalizada con su aceptación y su trazabilidad (S3c, CA-3, CA-4)', async () => {
      await renderizar();
      await completarLlamada();

      await formalizar();

      expect(screen.getByRole('heading', { level: 1, name: 'Compra formalizada' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Datos confirmados del cliente' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Aceptación registrada' })).toBeTruthy();
      expect(screen.getByText('GRAB-2026-88910')).toBeTruthy();
      expect(screen.getByText('Llamada grabada')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Próximos pasos de emisión' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Trazabilidad de la formalización' })).toBeTruthy();
      expect(screen.getByText(/asesor laura\.gomez@solventa\.example, fecha y hora/)).toBeTruthy();
      expect(screen.getByText(new RegExp(`cotización de origen ${VIGENTE.cotizacionId}`))).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Formalizar y emitir' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Ver cotización' })).toBeTruthy();
    });

    describe('con el código de confirmación', () => {
      async function conCodigo() {
        await renderizar();
        await elegirMedio('Código de confirmación');
      }

      it('pide el código del cliente y deja la referencia como opcional', async () => {
        await conCodigo();

        expect(screen.getByLabelText('Código de confirmación')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Enviar código al cliente' })).toBeTruthy();
        await confirmar();
        await userEvent.type(screen.getByLabelText('Código de confirmación'), '482913');
        await formalizar();

        expect(api.formalizarCompra).toHaveBeenCalledWith(
          VIGENTE.cotizacionId,
          expect.objectContaining({ metodo: 'confirmation_code', codigo: '482913', referencia: '' }),
        );
      });

      it('envía el código y dice a qué correo, sin mostrar el código (CA-5)', async () => {
        await conCodigo();

        await userEvent.click(screen.getByRole('button', { name: 'Enviar código al cliente' }));

        expect(api.solicitarConfirmacion).toHaveBeenCalledWith(VIGENTE.cotizacionId);
        expect(screen.getByRole('status').textContent).toContain('an***@example.com');
        expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeTruthy();
      });

      it('avisa cuando el código no se pudo entregar', async () => {
        api.solicitarConfirmacion.mockReturnValue(falla('code_delivery_unavailable'));
        await conCodigo();

        await userEvent.click(screen.getByRole('button', { name: 'Enviar código al cliente' }));

        expect(screen.getByRole('alert').textContent).toContain('No pudimos enviar el código al cliente');
      });

      it('rechaza un código que no tiene 6 dígitos sin llamar al servicio', async () => {
        await conCodigo();
        await confirmar();

        await userEvent.type(screen.getByLabelText('Código de confirmación'), '12ab');
        await formalizar();

        expect(screen.getByText('El código son 6 dígitos.')).toBeTruthy();
        expect(api.formalizarCompra).not.toHaveBeenCalled();
      });
    });

    it('muestra en cada campo los errores de validación del servicio', async () => {
      api.formalizarCompra.mockReturnValue(
        falla('validation_failed', [
          { campo: 'referencia', codigo: 'invalid_format' },
          { campo: 'fecha', codigo: 'out_of_range' },
        ]),
      );
      await renderizar();
      await completarLlamada('grabacion 1');

      await formalizar();

      expect(screen.getByText(/La referencia solo admite letras/)).toBeTruthy();
      expect(screen.getByText(/antes de que existiera la cotización/)).toBeTruthy();
      expect(screen.queryByText('Compra formalizada')).toBeNull();
    });

    it.each<[CodigoErrorFormalizacion, string]>([
      ['invalid_confirmation_code', 'El código no es el que recibió el cliente'],
      ['confirmation_code_expired', 'El código venció'],
      ['too_many_attempts', 'Se agotaron los intentos'],
      ['consent_code_required', 'Primero envía el código'],
      ['formalization_unavailable', 'No pudimos formalizar la compra'],
    ])('si el servicio responde %s lo explica y no formaliza', async (codigo, texto) => {
      api.formalizarCompra.mockReturnValue(falla(codigo));
      await renderizar();
      await completarLlamada();

      await formalizar();

      expect(screen.getByRole('alert').textContent).toContain(texto);
      expect(screen.queryByRole('heading', { name: 'Compra formalizada' })).toBeNull();
    });

    it('si otro asesor formalizó primero lo dice y muestra el resultado registrado (CA-6)', async () => {
      api.formalizarCompra.mockReturnValue(falla('already_formalized'));
      await renderizar();
      await completarLlamada();
      api.consultarFormalizacion.mockReturnValue(of(FORMALIZACION));

      await formalizar();

      expect(screen.getByRole('alert').textContent).toContain('Otro asesor ya formalizó la compra');
      expect(screen.getByRole('heading', { level: 1, name: 'Compra formalizada' })).toBeTruthy();
    });

    it('si la cotización vence mientras el asesor trabaja pasa al estado de vencida (CA-2)', async () => {
      api.formalizarCompra.mockReturnValue(falla('quote_expired'));
      await renderizar();
      await completarLlamada();

      await formalizar();

      expect(screen.getByText(/La cotización venció/)).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Formalizar y emitir' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('no muestra aviso propio ante un 401 o 403, que resuelve el interceptor', async () => {
      api.formalizarCompra.mockReturnValue(falla('forbidden'));
      await renderizar();
      await completarLlamada();

      await formalizar();

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('una cotización vencida no se formaliza y ofrece generar una nueva con el documento del cliente (CA-2)', async () => {
    await renderizar(of(VENCIDA));

    expect(screen.getByText('Vencida')).toBeTruthy();
    expect(screen.getByText('Siguiente paso')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No es posible formalizar');
    expect((screen.getByRole('button', { name: 'Formalizar y emitir' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Generar una nueva cotización' }).getAttribute('href')).toBe(
      '/originacion/cotizaciones/nueva?documento=1032456789',
    );
  });

  it('una cotización ya formalizada muestra directamente la compra formalizada', async () => {
    api.consultarFormalizacion.mockReturnValue(of(FORMALIZACION));
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Compra formalizada' })).toBeTruthy();
    expect(screen.queryByLabelText('Medio de aceptación')).toBeNull();
  });

  it('una formalización con código de confirmación no tiene referencia y lo dice', async () => {
    api.consultarFormalizacion.mockReturnValue(
      of({ ...FORMALIZACION, metodo: 'confirmation_code' as const, referencia: '' }),
    );
    await renderizar();

    expect(screen.getByText('Sin referencia (código de confirmación)')).toBeTruthy();
  });

  it('aFechaHoraLocal da el valor de un campo de fecha y hora en hora local', () => {
    expect(aFechaHoraLocal(new Date(2026, 9, 5, 8, 7))).toBe('2026-10-05T08:07');
  });
});
