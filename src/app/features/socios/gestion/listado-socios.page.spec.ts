import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { simularDialogoNativo } from '@testing/dialogo-pruebas';
import { LISTADO_SOCIOS_DTO, LISTADO_VACIO_DTO, SOCIO_PENDIENTE_DTO } from '@testing/socios-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { SociosApiService } from '@core/api/socios/socios-api.service';
import {
  CodigoErrorSocios,
  DetalleSocio,
  ErrorSocios,
  ListadoSocios,
  SolicitudRegistroSocio,
  mapearDetalleSocio,
  mapearListadoSocios,
} from '@core/api/socios/socios.modelos';

import { ListadoSociosPage } from './listado-socios.page';

describe('ListadoSociosPage (O10 · HU-W3.1-01)', () => {
  let listar: ReturnType<typeof vi.fn<() => Observable<ListadoSocios>>>;
  let registrar: ReturnType<typeof vi.fn<(s: SolicitudRegistroSocio) => Observable<DetalleSocio>>>;

  beforeAll(() => simularDialogoNativo());

  async function renderizar(lecturas: Observable<ListadoSocios>[], registro?: Observable<DetalleSocio>) {
    listar = vi.fn();
    for (const lectura of lecturas) {
      listar.mockReturnValueOnce(lectura);
    }
    registrar = vi.fn().mockReturnValue(registro ?? of(mapearDetalleSocio(SOCIO_PENDIENTE_DTO)));
    const resultado = await render(ListadoSociosPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), { provide: SociosApiService, useValue: { listar, registrar } }],
    });
    return { ...resultado, router: resultado.fixture.debugElement.injector.get(Router) };
  }

  const falla = (codigo: CodigoErrorSocios, campos: ErrorSocios['campos'] = []) => throwError(() => new ErrorSocios(codigo, campos));

  it('muestra los indicadores y una fila por socio con cuota, consumo de hoy y estado', async () => {
    await renderizar([of(mapearListadoSocios(LISTADO_SOCIOS_DTO))]);

    expect(await screen.findByRole('heading', { name: 'Socios comerciales', level: 1 })).toBeTruthy();
    const indicadores = screen.getByRole('region', { name: 'Indicadores de socios' });
    expect(within(indicadores).getByText('Aerolínea Aliada cerca del límite')).toBeTruthy();

    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(4);
    const banco = filas[0];
    expect(within(banco).getByText('Banco Aliado')).toBeTruthy();
    expect(within(banco).getByText(/3\.120 \/ 5\.000 por día/)).toBeTruthy();
    expect(within(banco).getByText('Activo')).toBeTruthy();
    expect(within(filas[1]).getByText('Cerca del límite')).toBeTruthy();
    expect(within(filas[1]).getByText('Rotación en curso')).toBeTruthy();
    expect(within(filas[2]).getByText(/Sin dato \/ 1\.000 por día/)).toBeTruthy();
    expect(within(filas[3]).getByText('Pendiente de aprobación')).toBeTruthy();
    expect(within(filas[3]).getByText('Sin cuota asignada')).toBeTruthy();
    expect(within(filas[3]).getByRole('link', { name: 'Ver Fintech Pagos' }).getAttribute('href')).toContain('/socios/ptn-');
  });

  it('sin socios muestra el estado vacío', async () => {
    await renderizar([of(mapearListadoSocios(LISTADO_VACIO_DTO))]);

    expect(await screen.findByText('Aún no hay socios')).toBeTruthy();
    expect(screen.getByText('Ningún socio cerca del límite')).toBeTruthy();
  });

  it('un error del servicio permite reintentar', async () => {
    await renderizar([falla('service_unavailable'), of(mapearListadoSocios(LISTADO_SOCIOS_DTO))]);

    expect(await screen.findByText('No pudimos cargar los socios')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Banco Aliado')).toBeTruthy();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('401 y 403 los resuelve el interceptor: no hay aviso propio', async () => {
    await renderizar([falla('forbidden')]);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('registrar socio', () => {
    async function diligenciar() {
      await userEvent.click(screen.getByRole('button', { name: 'Registrar socio' }));
      await userEvent.type(screen.getByLabelText('Nombre del socio'), 'Fintech Pagos');
      await userEvent.type(screen.getByLabelText('Código del tenant'), 'ten_fintech');
      await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'fintech');
      await userEvent.type(screen.getByLabelText('Correo del contacto técnico'), 'api@fintechpagos.co');
      await userEvent.type(screen.getByLabelText('Productos'), 'viajes, hogar');
    }

    it('valida antes de enviar y marca los campos que faltan', async () => {
      await renderizar([of(mapearListadoSocios(LISTADO_VACIO_DTO))]);
      await userEvent.click(await screen.findByRole('button', { name: 'Registrar socio' }));
      const dialogo = screen.getByRole('dialog');

      await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar socio' }));

      expect(registrar).not.toHaveBeenCalled();
      expect(within(dialogo).getByText('Escriba el nombre del socio.')).toBeTruthy();
      expect(within(dialogo).getByLabelText('Nombre del socio').getAttribute('aria-invalid')).toBe('true');
    });

    it('registra el socio pendiente y abre su detalle', async () => {
      const { router } = await renderizar([of(mapearListadoSocios(LISTADO_VACIO_DTO))]);
      const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      await diligenciar();

      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar socio' }));

      expect(registrar).toHaveBeenCalledWith({
        nombre: 'Fintech Pagos',
        codigo: 'ten_fintech',
        tipo: 'fintech',
        productos: ['viajes', 'hogar'],
        correoContactoTecnico: 'api@fintechpagos.co',
        cuota: { limiteDiario: 5000, limiteRafaga: 100, rafagaMaxima: 200 },
      });
      expect(navegar).toHaveBeenCalledWith(['/socios', SOCIO_PENDIENTE_DTO.partner_id]);
    });

    it('un código ya usado se marca en su campo', async () => {
      await renderizar([of(mapearListadoSocios(LISTADO_VACIO_DTO))], falla('partner_code_taken'));
      await diligenciar();

      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar socio' }));

      expect(await screen.findByText('Otro socio ya usa este código.')).toBeTruthy();
    });

    it('los campos que rechaza el servidor se marcan y un error general se avisa', async () => {
      await renderizar(
        [of(mapearListadoSocios(LISTADO_VACIO_DTO))],
        falla('validation_failed', [{ campo: 'correoContactoTecnico', codigo: 'invalid_format' }]),
      );
      await diligenciar();
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar socio' }));
      expect(await screen.findByText('Escriba un correo válido.')).toBeTruthy();

      registrar.mockReturnValue(falla('service_unavailable'));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar socio' }));
      expect(await screen.findByText('No fue posible registrar el socio. Intente de nuevo.')).toBeTruthy();

      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
