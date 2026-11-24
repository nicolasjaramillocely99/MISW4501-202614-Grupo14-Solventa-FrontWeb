import { Location } from '@angular/common';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMISION_COMPLETADA_DTO } from '@testing/emision-contractual-pruebas';
import {
  CODIGO_ENVIADO_DTO,
  RECOTIZACION_BASE_DTO,
  RECOTIZACION_CACHE_DTO,
  RECOTIZACION_DTO,
  RENOVACION_DEL_ASEGURADO_DTO,
  RENOVACION_FORMALIZADA_DTO,
  RENOVACION_NO_DISPONIBLE_DTO,
  RENOVACION_NO_RENOVADA_DTO,
  RENOVACION_ORIGEN_ASISTIDO_DTO,
  RENOVACION_PAGO_FALLIDO_DTO,
  RENOVACION_RECOTIZADA_DTO,
  RENOVACION_RENOVADA_DTO,
  RENOVACION_SIN_MEDIO_DTO,
  RENOVACION_SIN_NOMBRE_DTO,
  RENOVACION_SIN_RECOTIZAR_DTO,
} from '@testing/renovacion-asistida-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { EmisionContractual, mapearEmisionContractual } from '@core/api/originacion/emision-contractual.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CodigoErrorRenovacionAsistida,
  ErrorDeCampoRenovacion,
  ErrorRenovacionAsistida,
  RecotizacionRenovacion,
  RenovacionAsistida,
  RenovacionAsistidaDto,
  mapearRecotizacion,
  mapearRenovacionAsistida,
} from '@core/api/originacion/renovacion-asistida.modelos';

import { INTERVALO_SEGUIMIENTO_MS, RenovacionAsistidaPage } from './renovacion-asistida.page';

const POLIZA = 'pol-acc-118204';
const vista = (dto: RenovacionAsistidaDto) => mapearRenovacionAsistida(dto);
const falla = (codigo: CodigoErrorRenovacionAsistida, campos: ErrorDeCampoRenovacion[] = []) =>
  throwError(() => new ErrorRenovacionAsistida(codigo, campos));
const CASILLA_ACEPTACION =
  'El cliente aceptó las condiciones recotizadas y autorizó el cobro con su medio de pago registrado (Visa •••• 1111).';
const CASILLA_CONSENTIMIENTO = /El cliente autorizó consultar sus datos financieros/;

describe('RenovacionAsistidaPage (S7 / S7b · HU-W1.5-03)', () => {
  const api = {
    consultarRenovacionAsistida: vi.fn<(id: string) => Observable<RenovacionAsistida>>(),
    recotizarRenovacion: vi.fn<(id: string, afirmado: boolean) => Observable<RecotizacionRenovacion>>(),
    enviarCodigoRenovacion: vi.fn(),
    formalizarRenovacion: vi.fn(),
    consultarEmisionContractual: vi.fn<(id: string) => Observable<EmisionContractual>>(),
    descargarDocumentoContractual: vi.fn(),
  };
  async function renderizar(dto?: RenovacionAsistidaDto) {
    if (dto) {
      api.consultarRenovacionAsistida.mockReturnValue(of(vista(dto)));
    }
    return render(RenovacionAsistidaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: POLIZA } } } },
      ],
    });
  }

  const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre }) as HTMLButtonElement;
  const titulo = () => screen.getByRole('heading', { level: 1 }).textContent?.trim();

  async function diligenciarAceptacion() {
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Referencia'), 'GRAB-2026-88931');
    await usuario.click(screen.getByRole('checkbox', { name: CASILLA_ACEPTACION }));
    return usuario;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.consultarRenovacionAsistida.mockReturnValue(of(vista(RENOVACION_SIN_RECOTIZAR_DTO)));
    api.recotizarRenovacion.mockReturnValue(of(mapearRecotizacion(RECOTIZACION_DTO)));
    api.consultarEmisionContractual.mockReturnValue(of(mapearEmisionContractual(EMISION_COMPLETADA_DTO)));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('carga', () => {
    it('mientras consulta la póliza informa que carga', async () => {
      api.consultarRenovacionAsistida.mockReturnValue(new Subject<RenovacionAsistida>());

      await renderizar();

      expect(screen.getByRole('status').textContent).toContain('Cargando la renovación');
      expect(api.consultarRenovacionAsistida).toHaveBeenCalledWith(POLIZA);
    });

    it('una póliza que no existe muestra «No encontramos la póliza»', async () => {
      api.consultarRenovacionAsistida.mockReturnValue(falla('policy_not_found'));

      await renderizar();

      expect(titulo()).toBe('No encontramos la póliza');
    });

    it('si la consulta falla deja reintentar', async () => {
      api.consultarRenovacionAsistida.mockReturnValueOnce(falla('renewal_unavailable'));
      await renderizar();
      expect(titulo()).toBe('No pudimos cargar la renovación');

      await userEvent.click(boton('Reintentar'));

      expect(titulo()).toBe('Renovación asistida · pol-acc-118204');
      expect(api.consultarRenovacionAsistida).toHaveBeenCalledTimes(2);
    });
  });

  describe('S7 antes de recotizar', () => {
    it('muestra la póliza, «Vence el …» y las condiciones vigentes, sin poder formalizar', async () => {
      await renderizar();

      expect(titulo()).toBe('Renovación asistida · pol-acc-118204');
      expect(screen.getByText('Vence el 02/10/2026')).toBeTruthy();
      expect(screen.getByText(/Carolina Pérez Ruiz · 1\.020\.345\.678 · Vida hipotecario · sin recotizar/)).toBeTruthy();
      expect(boton('Recotizar').disabled).toBe(false);
      expect(boton('Formalizar renovación').disabled).toBe(true);
      expect(screen.getByText('Sin recotización vigente para este periodo')).toBeTruthy();
      expect(screen.getAllByText('Se consulta al recotizar').length).toBeGreaterThan(0);
      expect(screen.queryByRole('checkbox', { name: CASILLA_CONSENTIMIENTO })).toBeNull();
    });

    it('«Recotizar» se desactiva mientras recotiza y no envía dos veces (CA-1)', async () => {
      const respuesta = new Subject<RecotizacionRenovacion>();
      api.recotizarRenovacion.mockReturnValue(respuesta);
      await renderizar();
      api.consultarRenovacionAsistida.mockReturnValue(of(vista(RENOVACION_RECOTIZADA_DTO)));

      await userEvent.click(boton('Recotizar'));
      const enCurso = boton(/Recotizando/);
      expect(enCurso.disabled).toBe(true);
      expect(enCurso.getAttribute('aria-busy')).toBe('true');
      await userEvent.click(enCurso);
      expect(api.recotizarRenovacion).toHaveBeenCalledTimes(1);
      expect(api.recotizarRenovacion).toHaveBeenCalledWith(POLIZA, false);

      respuesta.next(mapearRecotizacion(RECOTIZACION_DTO));
      respuesta.complete();

      expect(await screen.findByText(/Recotizada el .* con el motor de rating/)).toBeTruthy();
      expect(screen.getAllByText(/149\.800/).length).toBeGreaterThan(0);
      expect(boton('Recotizar').disabled).toBe(false);
      expect(api.consultarRenovacionAsistida).toHaveBeenCalledTimes(2);
    });

    it('sin consentimiento activo no recotiza y lo dice (422 consent_required)', async () => {
      api.recotizarRenovacion.mockReturnValue(falla('consent_required'));
      await renderizar();

      await userEvent.click(boton('Recotizar'));

      expect(screen.getByRole('alert').textContent).toContain('El cliente revocó su autorización de Open Finance');
      expect(screen.getAllByText('Sin autorización').length).toBeGreaterThan(0);
      expect(boton('Formalizar renovación').disabled).toBe(true);
      expect(boton('Recotizar').disabled).toBe(true);
    });

    it('si no se puede verificar el consentimiento ofrece «Reintentar» (503 consent_unverifiable)', async () => {
      api.recotizarRenovacion.mockReturnValueOnce(falla('consent_unverifiable'));
      await renderizar();

      await userEvent.click(boton('Recotizar'));

      expect(screen.getByRole('alert').textContent).toContain('No pudimos verificar la autorización del cliente');
      expect(screen.getAllByText('Sin verificar').length).toBeGreaterThan(0);
      api.consultarRenovacionAsistida.mockReturnValue(of(vista(RENOVACION_RECOTIZADA_DTO)));
      await userEvent.click(boton('Reintentar'));

      expect(api.recotizarRenovacion).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('No pudimos verificar la autorización del cliente')).toBeNull();
    });

    it('un error general de la recotización se muestra sin cambiar de fase', async () => {
      api.recotizarRenovacion.mockReturnValue(falla('renewal_unavailable'));
      await renderizar();

      await userEvent.click(boton('Recotizar'));

      expect(screen.getByRole('alert').textContent).toContain('No pudimos completar la acción');
      expect(titulo()).toBe('Renovación asistida · pol-acc-118204');
    });

    it('si la sesión o el rol fallan, el interceptor responde y la pantalla no muestra aviso', async () => {
      api.recotizarRenovacion.mockReturnValue(falla('forbidden'));
      await renderizar();

      await userEvent.click(boton('Recotizar'));

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('póliza vendida por un asesor (D-13 c)', () => {
    it('«Recotizar» espera la casilla y la envía como consent_affirmed', async () => {
      await renderizar(RENOVACION_ORIGEN_ASISTIDO_DTO);

      expect(screen.getByText(/vendida por un asesor · sin recotizar/)).toBeTruthy();
      expect(screen.getAllByText('Pendiente de la autorización').length).toBeGreaterThan(0);
      expect(boton('Recotizar').disabled).toBe(true);

      await userEvent.click(screen.getByRole('checkbox', { name: CASILLA_CONSENTIMIENTO }));
      expect(boton('Recotizar').disabled).toBe(false);
      await userEvent.click(boton('Recotizar'));

      expect(api.recotizarRenovacion).toHaveBeenCalledWith(POLIZA, true);
    });

    it('si el servicio pide la casilla (422) la muestra con su error', async () => {
      api.recotizarRenovacion.mockReturnValueOnce(falla('validation_failed', [{ campo: 'consentimiento', codigo: 'required' }]));
      await renderizar();

      await userEvent.click(boton('Recotizar'));

      const casilla = screen.getByRole('checkbox', { name: CASILLA_CONSENTIMIENTO });
      expect(screen.getByRole('alert').textContent).toContain('sin la autorización del cliente no se consulta ningún dato');
      expect(boton('Recotizar').disabled).toBe(true);
      await userEvent.click(casilla);
      expect(screen.queryByRole('alert')).toBeNull();
      await userEvent.click(boton('Recotizar'));
      expect(api.recotizarRenovacion).toHaveBeenLastCalledWith(POLIZA, true);
    });
  });

  describe('S7 recotizada', () => {
    it('«Formalizar renovación» se habilita solo con la aceptación completa y formaliza (CA-2)', async () => {
      api.formalizarRenovacion.mockReturnValue(of({ renovacion: vista(RENOVACION_FORMALIZADA_DTO), creada: true }));
      await renderizar(RENOVACION_RECOTIZADA_DTO);

      expect(screen.getByText(/Recotizada el .* con el motor de rating/)).toBeTruthy();
      expect(boton('Formalizar renovación').disabled).toBe(true);
      const usuario = await diligenciarAceptacion();
      expect(boton('Formalizar renovación').disabled).toBe(false);

      await usuario.click(boton('Formalizar renovación'));

      expect(api.formalizarRenovacion).toHaveBeenCalledWith(
        POLIZA,
        expect.objectContaining({ recotizacionId: RECOTIZACION_DTO.requote_id, metodo: 'recorded_call', referencia: 'GRAB-2026-88931' }),
      );
      expect(titulo()).toBe('Renovación formalizada · pol-acc-118204');
      expect(screen.getByText(/renovada el .* por Laura Gómez/)).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Aceptación registrada' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Emisión de la renovación' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Trazabilidad de la recotización' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Recotizar' })).toBeNull();
    });

    it('«Ver emisión en curso» lleva el foco al panel del cobro', async () => {
      api.formalizarRenovacion.mockReturnValue(of({ renovacion: vista(RENOVACION_FORMALIZADA_DTO), creada: true }));
      await renderizar(RENOVACION_RECOTIZADA_DTO);
      const usuario = await diligenciarAceptacion();
      await usuario.click(boton('Formalizar renovación'));

      await usuario.click(boton('Ver emisión en curso'));

      expect(document.activeElement?.classList.contains('panel-emision')).toBe(true);
    });

    it('con el perfil en caché muestra «Modo degradado» y la fecha del perfil (D-7)', async () => {
      await renderizar({ ...RENOVACION_RECOTIZADA_DTO, requote: RECOTIZACION_CACHE_DTO });

      expect(screen.getByText('Modo degradado')).toBeTruthy();
      expect(screen.getByText(/Recotizada el .* en modo degradado/)).toBeTruthy();
      expect(screen.getByText(/usó el último perfil del cliente en caché, del 27\/08\/2026/)).toBeTruthy();
    });

    it('con el perfil actuarial base dice que no hay un perfil reciente en caché (D-7)', async () => {
      await renderizar({ ...RENOVACION_RECOTIZADA_DTO, requote: RECOTIZACION_BASE_DTO });

      expect(screen.getByText('Modo degradado')).toBeTruthy();
      expect(screen.getByText(/no hay un perfil reciente en caché: la recotización usó el perfil actuarial base/)).toBeTruthy();
    });

    it('sin medio de pago registrado no deja formalizar (D-10)', async () => {
      await renderizar(RENOVACION_SIN_MEDIO_DTO);

      expect(screen.getByText('La póliza no tiene un medio de pago registrado')).toBeTruthy();
      expect(boton('Formalizar renovación').disabled).toBe(true);
      expect(screen.getByLabelText('Referencia').matches(':disabled')).toBe(true);
    });

    it('una recotización vencida pide recotizar de nuevo', async () => {
      await renderizar({ ...RENOVACION_RECOTIZADA_DTO, requote: { ...RECOTIZACION_DTO, status: 'expired' } });

      expect(screen.getByText('La recotización venció')).toBeTruthy();
      expect(boton('Formalizar renovación').disabled).toBe(true);
    });

    it('si al formalizar la recotización ya no es la última, lo avisa', async () => {
      api.formalizarRenovacion.mockReturnValue(falla('requote_superseded'));
      await renderizar(RENOVACION_RECOTIZADA_DTO);
      const usuario = await diligenciarAceptacion();

      await usuario.click(boton('Formalizar renovación'));

      expect(screen.getByText('Hay una recotización más reciente')).toBeTruthy();
      expect(boton('Formalizar renovación').disabled).toBe(true);
    });

    it('marca los campos que el servicio rechazó', async () => {
      api.formalizarRenovacion.mockReturnValue(falla('validation_failed', [{ campo: 'fecha', codigo: 'out_of_range' }]));
      await renderizar(RENOVACION_RECOTIZADA_DTO);
      const usuario = await diligenciarAceptacion();

      await usuario.click(boton('Formalizar renovación'));

      expect(screen.getByLabelText('Fecha y hora').getAttribute('aria-invalid')).toBe('true');
    });

    it('si otro asesor formalizó primero lo dice y muestra su renovación', async () => {
      api.formalizarRenovacion.mockReturnValue(falla('already_formalized'));
      await renderizar(RENOVACION_RECOTIZADA_DTO);
      const usuario = await diligenciarAceptacion();
      api.consultarRenovacionAsistida.mockReturnValue(of(vista(RENOVACION_FORMALIZADA_DTO)));

      await usuario.click(boton('Formalizar renovación'));

      expect(screen.getByText('Otro asesor ya formalizó esta renovación.')).toBeTruthy();
      expect(titulo()).toBe('Renovación en curso · pol-acc-118204');
    });

    it('con el código de confirmación lo envía al titular y muestra los errores del código (D-9)', async () => {
      api.enviarCodigoRenovacion.mockReturnValueOnce(of({ recotizacionId: RECOTIZACION_DTO.requote_id, enviadoA: CODIGO_ENVIADO_DTO.sent_to, venceEn: CODIGO_ENVIADO_DTO.expires_at }));
      api.enviarCodigoRenovacion.mockReturnValueOnce(falla('too_many_codes'));
      api.formalizarRenovacion.mockReturnValue(falla('invalid_confirmation_code'));
      await renderizar(RENOVACION_RECOTIZADA_DTO);
      const usuario = userEvent.setup();

      await usuario.selectOptions(screen.getByLabelText('Medio por el que aceptó'), 'confirmation_code');
      await usuario.click(boton('Enviar código'));

      expect(api.enviarCodigoRenovacion).toHaveBeenCalledWith(POLIZA, RECOTIZACION_DTO.requote_id);
      expect(screen.getByRole('status').textContent).toContain('ca***@example.com');
      await usuario.click(boton('Reenviar código'));
      expect(screen.getByText('Ya se enviaron los 3 códigos de esta recotización.')).toBeTruthy();

      await usuario.type(screen.getByLabelText('Código de 6 dígitos'), '482913');
      await usuario.click(screen.getByRole('checkbox', { name: CASILLA_ACEPTACION }));
      await usuario.click(boton('Formalizar renovación'));

      expect(api.formalizarRenovacion).toHaveBeenCalledWith(POLIZA, expect.objectContaining({ metodo: 'confirmation_code', codigo: '482913' }));
      expect(screen.getByText('El código no es el que recibió el cliente.')).toBeTruthy();
    });
  });

  describe('S7b y «Ver»', () => {
    it('sigue el cobro cada 2 s hasta que la póliza queda renovada, con el certificado (CA-3)', async () => {
      vi.useFakeTimers();
      const { fixture } = await renderizar(RENOVACION_FORMALIZADA_DTO);
      expect(titulo()).toBe('Renovación en curso · pol-acc-118204');
      expect(screen.getByText('Renovación en curso')).toBeTruthy();
      api.consultarRenovacionAsistida.mockReturnValue(of(vista(RENOVACION_RENOVADA_DTO)));

      await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS);
      // La emisión de la póliza nueva se consulta enseguida.
      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();

      expect(titulo()).toBe('Renovación formalizada · pol-acc-118204');
      expect(screen.getByText('Renovada')).toBeTruthy();
      expect(api.consultarEmisionContractual).toHaveBeenCalledWith('pol-ren-118204');
      expect(screen.getByRole('button', { name: 'Ver certificado' })).toBeTruthy();
      const llamadas = api.consultarRenovacionAsistida.mock.calls.length;
      await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS * 3);
      expect(api.consultarRenovacionAsistida).toHaveBeenCalledTimes(llamadas);
    });

    it('sin el nombre del asesor muestra su correo (CA-4)', async () => {
      await renderizar(RENOVACION_SIN_NOMBRE_DTO);

      expect(screen.getByText(/renovada el .* por asesor@example\.com/)).toBeTruthy();
    });

    it('con el pago fallido muestra la fecha y hasta cuándo puede reintentar el cliente, sin seguir consultando', async () => {
      vi.useFakeTimers();
      await renderizar(RENOVACION_PAGO_FALLIDO_DTO);

      const aviso = screen.getByRole('alert');
      expect(aviso.textContent).toContain('El pago de la renovación falló');
      expect(aviso.textContent).toMatch(/puede reintentar con otro medio de pago desde su portal hasta/);
      await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS * 2);
      expect(api.consultarRenovacionAsistida).toHaveBeenCalledTimes(1);
    });

    it('«Ver certificado» descarga el PDF de la póliza nueva', async () => {
      const crear = vi.fn().mockReturnValue('blob:pdf');
      vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: vi.fn() });
      const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      api.descargarDocumentoContractual.mockReturnValue(of(new Blob(['%PDF'])));
      await renderizar(RENOVACION_RENOVADA_DTO);

      await userEvent.click(boton('Ver certificado'));

      expect(api.descargarDocumentoContractual).toHaveBeenCalledWith('pol-ren-118204');
      expect(crear).toHaveBeenCalled();
      expect(clic).toHaveBeenCalled();
      clic.mockRestore();
    });

    it('si el certificado no se descarga lo dice', async () => {
      api.descargarDocumentoContractual.mockReturnValue(throwError(() => new Error('sin red')));
      await renderizar(RENOVACION_RENOVADA_DTO);

      await userEvent.click(boton('Ver certificado'));

      expect(screen.getByRole('alert').textContent).toContain('No pudimos descargar el certificado');
    });

    it('la renovación del asegurado se muestra en solo lectura con su cobro (01·D-3 a+)', async () => {
      await renderizar(RENOVACION_DEL_ASEGURADO_DTO);

      expect(screen.getByText('El cliente renovó desde su portal')).toBeTruthy();
      expect(screen.getByText(/aceptada por el cliente en su portal el/)).toBeTruthy();
      expect(screen.getAllByText(/149\.800/).length).toBe(2);
      expect(screen.queryByText('Sin recotización vigente para este periodo')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Recotización' })).toBeNull();
      expect(screen.getByRole('heading', { name: 'Emisión de la renovación' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Recotizar' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Formalizar renovación' })).toBeNull();
    });

    it('en S7b dice quién afirmó el consentimiento, aunque haya formalizado otro asesor', async () => {
      await renderizar({
        ...RENOVACION_FORMALIZADA_DTO,
        requote: {
          ...RECOTIZACION_DTO,
          consent_basis: 'advisor_affirmed',
          consent_affirmed_at: '2026-09-16T21:02:00Z',
          consent_affirmed_by_email: 'andres@example.com',
          consent_affirmed_by_name: 'Andrés Rojas',
        },
      });

      expect(screen.getByText(/Consentimiento afirmado por Andrés Rojas el/)).toBeTruthy();
      expect(screen.getByText(/renovada el .* por Laura Gómez/)).toBeTruthy();
    });
  });

  describe('no disponible', () => {
    it('antes de la ventana dice desde cuándo se puede renovar', async () => {
      await renderizar({
        ...RENOVACION_NO_DISPONIBLE_DTO,
        renewal_window: { opens_at: '2099-09-02T23:59:00Z', closes_at: '2099-10-02T23:59:00Z', open: false },
      });

      const aviso = screen.getByRole('status');
      expect(aviso.textContent).toContain('Esta póliza todavía no se puede renovar');
      expect(aviso.textContent).toContain('02/09/2099');
      expect(screen.queryByRole('button', { name: 'Recotizar' })).toBeNull();
    });

    it('con la ventana cerrada dice que terminó sin renovación', async () => {
      await renderizar({
        ...RENOVACION_NO_DISPONIBLE_DTO,
        renewal_window: { opens_at: '2020-09-02T23:59:00Z', closes_at: '2020-10-02T23:59:00Z', open: false },
      });

      expect(screen.getByText('La ventana de renovación de esta póliza ya cerró')).toBeTruthy();
    });

    it('una póliza no renovada dice por qué', async () => {
      await renderizar(RENOVACION_NO_RENOVADA_DTO);

      expect(screen.getByText('Esta póliza no se renovó')).toBeTruthy();
      expect(screen.getByText(/el pago no se logró antes del/)).toBeTruthy();
      expect(screen.getByText('No renovada')).toBeTruthy();
    });
  });

  describe('regreso al listado', () => {
    it('vuelve atrás si se llegó desde el listado, para conservar su filtro', async () => {
      const { fixture } = await renderizar();
      const location = fixture.debugElement.injector.get(Location);
      vi.spyOn(location, 'getState').mockReturnValue({ navigationId: 3 });
      const atras = vi.spyOn(location, 'back').mockImplementation(() => undefined);

      await userEvent.click(boton('Renovaciones'));

      expect(atras).toHaveBeenCalled();
    });

    it('si se entró directo por la URL abre el listado', async () => {
      const { fixture } = await renderizar(RENOVACION_DEL_ASEGURADO_DTO);
      const location = fixture.debugElement.injector.get(Location);
      vi.spyOn(location, 'getState').mockReturnValue({ navigationId: 1 });
      const atras = vi.spyOn(location, 'back');
      const navegar = vi.spyOn(fixture.debugElement.injector.get(Router), 'navigateByUrl').mockResolvedValue(true);

      fireEvent.click(boton('Volver a renovaciones'));

      expect(atras).not.toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith('/originacion/renovaciones');
    });
  });
});
