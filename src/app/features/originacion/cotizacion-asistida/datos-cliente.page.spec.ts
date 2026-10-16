import { Router, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { COTIZACION_DTO } from '@testing/cotizacion-asistida-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ClienteCotizacion, ErrorCotizacionAsistida, SolicitudCotizacionAsistida, mapearCotizacionAsistida } from '@core/api/originacion/cotizacion-asistida.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { DatosClientePage, edadEn } from './datos-cliente.page';

const COTIZACION = mapearCotizacionAsistida(COTIZACION_DTO);

const CLIENTE: ClienteCotizacion = {
  clienteId: 'c1',
  documento: '1032456789',
  nombreCompleto: 'Ana María Pérez',
  correo: 'ana@example.com',
  fechaNacimiento: '1990-05-20',
};

describe('DatosClientePage (S1 · HU-W1.1-01)', () => {
  let crear: ReturnType<typeof vi.fn<(s: SolicitudCotizacionAsistida) => Observable<typeof COTIZACION>>>;
  let buscar: ReturnType<typeof vi.fn<(d: string) => Observable<ClienteCotizacion>>>;

  async function renderizar(queryDocumento: string | null = null) {
    crear = vi.fn().mockReturnValue(of(COTIZACION));
    buscar = vi.fn().mockReturnValue(of(CLIENTE));
    const resultado = await render(DatosClientePage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: { crearCotizacionAsistida: crear, buscarClientePorDocumento: buscar } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'documento' ? queryDocumento : null) } } },
        },
      ],
    });
    return { ...resultado, router: resultado.fixture.debugElement.injector.get(Router) };
  }

  async function llenar(usuario: ReturnType<typeof userEvent.setup>, valores: Partial<Record<string, string>> = {}) {
    const v = {
      documento: '1032456789',
      nombre: 'Ana María Pérez',
      correo: 'ana@example.com',
      nacimiento: '1990-05-20',
      monto: '250000000',
      plazo: '180',
      ...valores,
    };
    await usuario.type(screen.getByLabelText('Documento de identidad'), v.documento);
    await usuario.type(screen.getByLabelText('Nombre completo'), v.nombre);
    await usuario.type(screen.getByLabelText('Correo electrónico'), v.correo);
    await usuario.type(screen.getByLabelText('Fecha de nacimiento'), v.nacimiento);
    await usuario.type(screen.getByLabelText('Monto asegurado (COP)'), v.monto);
    await usuario.type(screen.getByLabelText('Plazo (meses)'), v.plazo);
  }

  it('muestra los campos del cliente, las reglas y el botón para cotizar', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Nueva cotización asistida' })).toBeTruthy();
    for (const etiqueta of ['Documento de identidad', 'Nombre completo', 'Correo electrónico', 'Fecha de nacimiento', 'Monto asegurado (COP)', 'Plazo (meses)']) {
      expect(screen.getByLabelText(etiqueta)).toBeTruthy();
    }
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generar cotización' })).toBeTruthy();
    expect(screen.getByText(/vigencia de 24 horas/)).toBeTruthy();
  });

  it('con campos vacíos señala cada campo con su error y no cotiza (criterio 3)', async () => {
    const usuario = userEvent.setup();
    await renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));

    expect(screen.getByText('Escribe el documento del cliente.')).toBeTruthy();
    expect(screen.getByText('Escribe el nombre completo del cliente.')).toBeTruthy();
    expect(screen.getByText('Escribe el correo electrónico del cliente.')).toBeTruthy();
    expect(screen.getByText('Indica la fecha de nacimiento del cliente.')).toBeTruthy();
    expect(screen.getByText('Indica el monto a asegurar.')).toBeTruthy();
    expect(screen.getByText('Indica el plazo del crédito en meses.')).toBeTruthy();
    expect(screen.getByText('Confirma el consentimiento del cliente para poder cotizar.')).toBeTruthy();
    expect(screen.getByLabelText('Documento de identidad').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Documento de identidad'));
    expect(crear).not.toHaveBeenCalled();
  });

  it('señala el formato o el rango específico de cada campo antes de llamar al backend', async () => {
    const usuario = userEvent.setup();
    await renderizar();

    await llenar(usuario, { documento: '12', correo: 'no-es-correo', nacimiento: '2015-01-01', monto: '5000', plazo: '6' });
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));

    expect(screen.getByText(/entre 5 y 20 letras o números/)).toBeTruthy();
    expect(screen.getByText(/Escribe un correo válido/)).toBeTruthy();
    expect(screen.getByText('El cliente debe tener entre 18 y 70 años para este seguro.')).toBeTruthy();
    expect(screen.getByText(/El monto debe estar entre/)).toBeTruthy();
    expect(screen.getByText('El plazo debe estar entre 12 y 360 meses.')).toBeTruthy();
    expect(crear).not.toHaveBeenCalled();
  });

  it('con datos válidos pide la cotización con el consentimiento afirmado y abre el resultado', async () => {
    const usuario = userEvent.setup();
    const { router } = await renderizar();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await llenar(usuario);
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));

    expect(crear).toHaveBeenCalledWith({
      documento: '1032456789',
      nombreCompleto: 'Ana María Pérez',
      correo: 'ana@example.com',
      fechaNacimiento: '1990-05-20',
      montoAsegurado: 250000000,
      plazoMeses: 180,
      consentimientoActivo: true,
    });
    expect(navegar).toHaveBeenCalledWith(['/originacion/cotizaciones', COTIZACION.cotizacionId]);
  });

  it('mientras cotiza deshabilita el botón y no duplica la solicitud', async () => {
    const usuario = userEvent.setup();
    const pendiente = new Subject<typeof COTIZACION>();
    await renderizar();
    crear.mockReturnValue(pendiente);

    await llenar(usuario);
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));

    const boton = screen.getByRole('button', { name: 'Cotizando…' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('muestra junto a cada campo el error específico que devuelve el backend y lo limpia al editar', async () => {
    const usuario = userEvent.setup();
    await renderizar();
    crear.mockReturnValue(
      throwError(
        () =>
          new ErrorCotizacionAsistida('validation_failed', [
            { campo: 'correo', codigo: 'invalid_format' },
            { campo: 'fechaNacimiento', codigo: 'out_of_range' },
          ]),
      ),
    );

    await llenar(usuario);
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));

    expect(screen.getByText(/Escribe un correo válido/)).toBeTruthy();
    expect(screen.getByText(/entre 18 y 70 años/)).toBeTruthy();
    expect(screen.getByLabelText('Correo electrónico').getAttribute('aria-invalid')).toBe('true');

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'x');
    expect(screen.queryByText(/Escribe un correo válido/)).toBeNull();
    expect(screen.getByText(/entre 18 y 70 años/)).toBeTruthy();
  });

  it('sin consentimiento aceptado por el backend marca el campo del consentimiento', async () => {
    const usuario = userEvent.setup();
    await renderizar();
    crear.mockReturnValue(throwError(() => new ErrorCotizacionAsistida('consent_required')));

    await llenar(usuario);
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));

    expect(screen.getByText('Confirma el consentimiento del cliente para poder cotizar.')).toBeTruthy();
  });

  it('un fallo del servicio o de permisos se muestra como alerta y permite reintentar', async () => {
    const usuario = userEvent.setup();
    await renderizar();
    crear.mockReturnValue(throwError(() => new ErrorCotizacionAsistida('quote_unavailable')));

    await llenar(usuario);
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));
    expect(screen.getByRole('alert').textContent).toContain('No pudimos generar la cotización');

    crear.mockReturnValue(throwError(() => new ErrorCotizacionAsistida('forbidden')));
    await usuario.click(screen.getByRole('button', { name: 'Generar cotización' }));
    expect(screen.getByRole('alert').textContent).toContain('no tiene permiso para cotizar');
  });

  describe('recuperar al cliente por documento (criterio 2)', () => {
    it('carga nombre, correo y fecha de nacimiento del cliente existente', async () => {
      const usuario = userEvent.setup();
      await renderizar();

      await usuario.type(screen.getByLabelText('Documento de identidad'), '1032456789');
      await usuario.click(screen.getByRole('button', { name: 'Buscar cliente' }));

      expect(buscar).toHaveBeenCalledWith('1032456789');
      expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('Ana María Pérez');
      expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('ana@example.com');
      expect((screen.getByLabelText('Fecha de nacimiento') as HTMLInputElement).value).toBe('1990-05-20');
      expect(screen.getByText(/Cliente encontrado/)).toBeTruthy();
    });

    it('con Enter en el documento busca en vez de enviar el formulario', async () => {
      const usuario = userEvent.setup();
      await renderizar();

      await usuario.type(screen.getByLabelText('Documento de identidad'), '1032456789{Enter}');

      expect(buscar).toHaveBeenCalledTimes(1);
      expect(crear).not.toHaveBeenCalled();
    });

    it('si el documento no existe lo informa y deja completar los datos', async () => {
      const usuario = userEvent.setup();
      await renderizar();
      buscar.mockReturnValue(throwError(() => new ErrorCotizacionAsistida('customer_not_found')));

      await usuario.type(screen.getByLabelText('Documento de identidad'), '9999999999');
      await usuario.click(screen.getByRole('button', { name: 'Buscar cliente' }));

      expect(screen.getByText(/No hay un cliente con ese documento/)).toBeTruthy();
    });

    it('un fallo del servicio al buscar se muestra como alerta', async () => {
      const usuario = userEvent.setup();
      await renderizar();
      buscar.mockReturnValue(throwError(() => new ErrorCotizacionAsistida('customer_unavailable')));

      await usuario.type(screen.getByLabelText('Documento de identidad'), '1032456789');
      await usuario.click(screen.getByRole('button', { name: 'Buscar cliente' }));

      expect(screen.getByRole('alert').textContent).toContain('No pudimos buscar al cliente');
    });

    it('no busca con un documento inválido y marca el campo', async () => {
      const usuario = userEvent.setup();
      await renderizar();

      await usuario.type(screen.getByLabelText('Documento de identidad'), '12');
      await usuario.click(screen.getByRole('button', { name: 'Buscar cliente' }));

      expect(buscar).not.toHaveBeenCalled();
      expect(screen.getByText(/entre 5 y 20 letras o números/)).toBeTruthy();
    });

    it('muestra el error del backend sobre el documento cuando la búsqueda lo rechaza', async () => {
      const usuario = userEvent.setup();
      await renderizar();
      buscar.mockReturnValue(
        throwError(() => new ErrorCotizacionAsistida('validation_failed', [{ campo: 'documento', codigo: 'invalid_format' }])),
      );

      await usuario.type(screen.getByLabelText('Documento de identidad'), '1032456789');
      await usuario.click(screen.getByRole('button', { name: 'Buscar cliente' }));

      expect(screen.getByText(/entre 5 y 20 letras o números/)).toBeTruthy();
    });

    it('con ?documento= (desde una cotización vencida) precarga y busca al cliente', async () => {
      await renderizar('1032456789');

      expect(buscar).toHaveBeenCalledWith('1032456789');
      expect((screen.getByLabelText('Documento de identidad') as HTMLInputElement).value).toBe('1032456789');
      expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('Ana María Pérez');
    });
  });
});

describe('edadEn', () => {
  const hoy = new Date(2026, 9, 16);

  it('cuenta los años cumplidos', () => {
    expect(edadEn('1990-10-16', hoy)).toBe(36);
    expect(edadEn('1990-10-17', hoy)).toBe(35);
    expect(edadEn('1990-11-30', hoy)).toBe(35);
    expect(edadEn('2008-10-16', hoy)).toBe(18);
  });

  it('rechaza lo que no es una fecha real o es futura', () => {
    expect(edadEn('20/05/1990', hoy)).toBeNull();
    expect(edadEn('1990-02-31', hoy)).toBeNull();
    expect(edadEn('2030-01-01', hoy)).toBe(-1);
  });
});
