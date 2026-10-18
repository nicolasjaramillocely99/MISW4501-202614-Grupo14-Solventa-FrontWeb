import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RECIBO_CONSENTIMIENTO_DTO, TERMINOS_DTO } from '@testing/consentimiento-pruebas';
import { CONTEXTO_LANZAMIENTO, codificarContexto } from '@testing/contexto-lanzamiento-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  Consentimiento,
  ErrorConsentimiento,
  SolicitudConsentimiento,
  TerminosConsentimiento,
  mapearConsentimiento,
  mapearTerminosConsentimiento,
} from '@core/api/auditoria/consentimiento.modelos';

import { ContextoLanzamientoService } from '../servicios/contexto-lanzamiento.service';
import { ConsentimientoPage } from './consentimiento.page';

const TERMINOS = mapearTerminosConsentimiento(TERMINOS_DTO);
const RECIBO = mapearConsentimiento(RECIBO_CONSENTIMIENTO_DTO);

describe('ConsentimientoPage (E1 · HU-W1.2-01)', () => {
  let consultarTerminos: ReturnType<typeof vi.fn<() => Observable<TerminosConsentimiento>>>;
  let registrar: ReturnType<typeof vi.fn<(s: SolicitudConsentimiento) => Observable<Consentimiento>>>;

  async function renderizar(
    {
      contexto = codificarContexto(CONTEXTO_LANZAMIENTO) as string | null,
      terminos = of(TERMINOS) as Observable<TerminosConsentimiento>,
      registro = of(RECIBO) as Observable<Consentimiento>,
    } = {},
  ) {
    const navegar = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    consultarTerminos = vi.fn().mockReturnValue(terminos);
    registrar = vi.fn().mockReturnValue(registro);
    const resultado = await render(ConsentimientoPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        {
          provide: AuditoriaApiService,
          useValue: { consultarTerminosVigentes: consultarTerminos, registrarConsentimiento: registrar },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'contexto' ? contexto : null) } } },
        },
      ],
    });
    return { ...resultado, navegar };
  }

  afterEach(() => vi.restoreAllMocks());

  const autorizar = () => screen.getByRole('button', { name: 'Autorizar y continuar' });
  const casillaFuentes = () => screen.getByRole('checkbox', { name: /Autorizo a Solventa a consultar mis datos/ });
  const casillaPolitica = () => screen.getByRole('checkbox', { name: /política de tratamiento de datos personales/ });

  describe('formulario (CA-1)', () => {
    it('pinta las fuentes, sus datos y vigencia desde los términos del backend', async () => {
      await renderizar();

      expect(screen.getByRole('heading', { level: 1, name: 'Autoriza la consulta de tus datos' })).toBeTruthy();
      const filas = screen.getAllByRole('listitem').filter((fila) => fila.classList.contains('fuente'));
      expect(filas).toHaveLength(3);
      expect(filas[0].textContent).toContain('Open Finance');
      expect(filas[0].textContent).toContain('Productos de crédito, saldos y comportamiento de pago en tus entidades financieras.');
      expect(filas[0].textContent).toContain('12 meses');
      expect(filas[1].textContent).toContain('Registros públicos: RUNT, Registraduría y listas de control.');
      expect(filas[2].textContent).toContain('Identidad (KYC)');
      expect(filas[2].textContent).toContain('Verificación de identidad ya realizada por el banco aliado.');
      expect(filas[2].textContent).toContain('Única vez');
    });

    it('muestra la finalidad, el responsable y el aviso de registro', async () => {
      await renderizar();

      expect(screen.getByText('Cálculo del perfil de riesgo individualizado y de la oferta de seguro de vida hipotecario')).toBeTruthy();
      expect(screen.getByText(/Solventa S\.A\. ·/).textContent).toContain('Política de tratamiento de datos (Ley 1581 de 2012)');
      expect(screen.getByText('Tu autorización queda registrada')).toBeTruthy();
    });

    it('muestra la tarjeta del crédito, el contexto y la barra con el aliado que entregó el contexto', async () => {
      await renderizar();

      expect(screen.getByText('Crédito de vivienda · Solicitud N.º 48213 · Seguro de vida hipotecario')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Tu crédito' })).toBeTruthy();
      expect(screen.getByText('20 años')).toBeTruthy();
      expect(screen.getByRole('list', { name: 'Pasos de la solicitud' })).toBeTruthy();
    });

    it('deja «Autorizar y continuar» deshabilitado hasta marcar ambas casillas', async () => {
      const usuario = userEvent.setup();
      await renderizar();

      expect((autorizar() as HTMLButtonElement).disabled).toBe(true);
      await usuario.click(casillaFuentes());
      expect((autorizar() as HTMLButtonElement).disabled).toBe(true);
      await usuario.click(casillaPolitica());
      expect((autorizar() as HTMLButtonElement).disabled).toBe(false);
      await usuario.click(casillaFuentes());
      expect((autorizar() as HTMLButtonElement).disabled).toBe(true);
    });

    it('pide los términos una sola vez al entrar', async () => {
      await renderizar();

      expect(consultarTerminos).toHaveBeenCalledTimes(1);
      expect(registrar).not.toHaveBeenCalled();
    });
  });

  describe('cargando', () => {
    it('muestra el progreso mientras consulta los términos y no deja autorizar', async () => {
      await renderizar({ terminos: new Subject<TerminosConsentimiento>() });

      expect(screen.getByRole('heading', { level: 1, name: 'Estamos preparando tu autorización' })).toBeTruthy();
      expect(screen.getByRole('progressbar', { name: 'Consultando los términos' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Autorizar y continuar' })).toBeNull();
    });
  });

  describe('autorizar (CA-2)', () => {
    async function autorizarCompleto() {
      const usuario = userEvent.setup();
      const vista = await renderizar();
      await usuario.click(casillaFuentes());
      await usuario.click(casillaPolitica());
      await usuario.click(autorizar());
      return vista;
    }

    it('registra titular, todas las fuentes, versión, aliado, solicitud y política', async () => {
      await autorizarCompleto();

      expect(registrar).toHaveBeenCalledTimes(1);
      expect(registrar).toHaveBeenCalledWith({
        clienteId: 'cliente-0001',
        documento: '1020304050',
        nombreCompleto: 'Ana María Pérez',
        versionTerminos: 'v1',
        fuentesAceptadas: ['open_finance', 'open_data', 'kyc'],
        aceptaPoliticaDatos: true,
        aliadoId: 'aliado-banco-1',
        solicitudId: '48213',
      });
    });

    it('guarda el comprobante y continúa al paso 2 con ?consentimiento=true', async () => {
      const { navegar } = await autorizarCompleto();

      expect(TestBed.inject(ContextoLanzamientoService).consentimiento()).toEqual({
        id: 'cns-7c3e85c71dddd603c8e90def9f4ce9cd',
        fecha: '2026-10-18T02:48:14.062927Z',
      });
      expect(navegar).toHaveBeenCalledWith(['/embebido/perfil-riesgo', 'cliente-0001'], {
        queryParams: { consentimiento: 'true' },
      });
    });

    it('deshabilita el botón y las casillas mientras registra', async () => {
      const usuario = userEvent.setup();
      await renderizar({ registro: new Subject<Consentimiento>() });
      await usuario.click(casillaFuentes());
      await usuario.click(casillaPolitica());
      await usuario.click(autorizar());

      const enCurso = screen.getByRole('button', { name: 'Registrando…' }) as HTMLButtonElement;
      expect(enCurso.disabled).toBe(true);
      expect((casillaFuentes() as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Ahora no' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('«Ahora no» (CA-3)', () => {
    it('muestra el estado rechazado sin llamar a ningún servicio de registro', async () => {
      const usuario = userEvent.setup();
      const { navegar } = await renderizar();

      await usuario.click(screen.getByRole('button', { name: 'Ahora no' }));

      expect(screen.getByRole('heading', { level: 1, name: 'No consultaremos tus datos' })).toBeTruthy();
      expect(screen.getByText('Sin tu autorización no calculamos tu oferta')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Continuar con mi crédito' })).toBeTruthy();
      expect(registrar).not.toHaveBeenCalled();
      // La única navegación es la que quita ?contexto= de la URL: no se pasa al paso 2.
      const destinos = navegar.mock.calls.map(([comandos]) => comandos);
      expect(destinos.flat().join('/')).not.toContain('perfil-riesgo');
    });

    it('«Volver a autorizar» regresa al formulario sin volver a pedir los términos', async () => {
      const usuario = userEvent.setup();
      await renderizar();
      await usuario.click(screen.getByRole('button', { name: 'Ahora no' }));

      await usuario.click(screen.getByRole('button', { name: 'Volver a autorizar' }));

      expect(screen.getByRole('heading', { level: 1, name: 'Autoriza la consulta de tus datos' })).toBeTruthy();
      expect(consultarTerminos).toHaveBeenCalledTimes(1);
    });
  });

  describe('sin contexto', () => {
    it.each([
      ['no llegó', null],
      ['es inválido', '###'],
    ])('si el contexto %s avisa y no llama a ningún servicio', async (_caso, contexto) => {
      await renderizar({ contexto });

      expect(screen.getByRole('heading', { level: 1, name: 'No recibimos los datos de tu crédito' })).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('Vuelve al sitio de tu banco');
      expect(consultarTerminos).not.toHaveBeenCalled();
      expect(registrar).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Autorizar y continuar' })).toBeNull();
    });
  });

  describe('errores', () => {
    it('si fallan los términos muestra el error y «Reintentar» los vuelve a pedir', async () => {
      const usuario = userEvent.setup();
      await renderizar({ terminos: throwError(() => new ErrorConsentimiento('service_unavailable')) });

      expect(screen.getByRole('alert').textContent).toContain('No pudimos consultar los términos');
      consultarTerminos.mockReturnValue(of(TERMINOS));
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(consultarTerminos).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { level: 1, name: 'Autoriza la consulta de tus datos' })).toBeTruthy();
    });

    it('si el registro falla muestra el error y «Reintentar» repite el registro con las casillas marcadas', async () => {
      const usuario = userEvent.setup();
      await renderizar({ registro: throwError(() => new ErrorConsentimiento('service_unavailable')) });
      await usuario.click(casillaFuentes());
      await usuario.click(casillaPolitica());
      await usuario.click(autorizar());

      expect(screen.getByRole('alert').textContent).toContain('No pudimos registrar tu autorización');
      registrar.mockReturnValue(of(RECIBO));
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(registrar).toHaveBeenCalledTimes(2);
    });

    it('ante validation_failed explica que los datos no son válidos y no ofrece reintentar', async () => {
      const usuario = userEvent.setup();
      await renderizar({
        registro: throwError(() => new ErrorConsentimiento('validation_failed', [{ campo: 'documento', codigo: 'invalid_format' }])),
      });
      await usuario.click(casillaFuentes());
      await usuario.click(casillaPolitica());
      await usuario.click(autorizar());

      expect(screen.getByRole('alert').textContent).toContain('Los datos de tu solicitud no son válidos');
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('ante terms_outdated vuelve a pedir los términos, limpia las casillas y avisa', async () => {
      const usuario = userEvent.setup();
      await renderizar({ registro: throwError(() => new ErrorConsentimiento('terms_outdated')) });
      await usuario.click(casillaFuentes());
      await usuario.click(casillaPolitica());
      await usuario.click(autorizar());

      expect(consultarTerminos).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Actualizamos los términos')).toBeTruthy();
      expect((casillaFuentes() as HTMLInputElement).checked).toBe(false);
      expect((casillaPolitica() as HTMLInputElement).checked).toBe(false);
      expect((autorizar() as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
