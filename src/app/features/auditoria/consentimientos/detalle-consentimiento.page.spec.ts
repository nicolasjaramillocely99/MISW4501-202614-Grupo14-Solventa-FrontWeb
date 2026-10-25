import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { pulsarEscapeEnDialogo, simularDialogoNativo } from '@testing/dialogo-pruebas';
import {
  CONSENTIMIENTO_ID,
  ESTADO_ACTIVO_DTO,
  ESTADO_EN_CURSO_DTO,
  ESTADO_PARCIAL_DTO,
  ESTADO_REVOCADO_DTO,
  ESTADO_REVOCADO_EN_APP_DTO,
  ESTADO_VENCIDO_DTO,
} from '@testing/revocacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  CodigoErrorRevocacion,
  ErrorRevocacion,
  EstadoRevocacion,
  EstadoRevocacionDto,
  ResultadoReintento,
  SolicitudRevocacion,
  mapearEstadoRevocacion,
} from '@core/api/auditoria/revocacion.modelos';
import { SesionService } from '@core/auth/sesion.service';

import { DetalleConsentimientoPage } from './detalle-consentimiento.page';
import { INTERVALO_SONDEO_MS } from './servicios/seguimiento-revocacion.service';
import { EstadoConsultadoService } from './servicios/estado-consultado.service';

const activo = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);
const enCurso = mapearEstadoRevocacion(ESTADO_EN_CURSO_DTO);
const revocado = mapearEstadoRevocacion(ESTADO_REVOCADO_DTO);
const parcial = mapearEstadoRevocacion(ESTADO_PARCIAL_DTO);
const falla = (codigo: CodigoErrorRevocacion) => throwError(() => new ErrorRevocacion(codigo));

describe('DetalleConsentimientoPage (O15 · HU-W4.2-02)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<EstadoRevocacion>>>;
  let revocar: ReturnType<typeof vi.fn<(id: string, s: SolicitudRevocacion, clave: string) => Observable<EstadoRevocacion>>>;
  let reintentar: ReturnType<typeof vi.fn<(id: string) => Observable<ResultadoReintento>>>;

  beforeAll(() => simularDialogoNativo());
  afterEach(() => vi.useRealTimers());

  async function renderizar(opciones: { lecturas?: Observable<EstadoRevocacion>[]; guardado?: EstadoRevocacion; usuarioId?: string } = {}) {
    consultar = vi.fn();
    for (const lectura of opciones.lecturas ?? []) {
      consultar.mockReturnValueOnce(lectura);
    }
    revocar = vi.fn().mockReturnValue(of(enCurso));
    reintentar = vi.fn().mockReturnValue(of({ entidadesReintentadas: ['aliado-banco-1'], estado: enCurso }));
    const consultado = new EstadoConsultadoService();
    if (opciones.guardado) {
      consultado.guardar(opciones.guardado);
    }
    const usuario = { id: opciones.usuarioId ?? 'sub-operaciones', nombre: 'Andrés Ruiz', correo: 'o@solventa.co', rol: 'operaciones', socioId: null };
    return render(DetalleConsentimientoPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        {
          provide: AuditoriaApiService,
          useValue: { consultarEstadoRevocacion: consultar, revocarConsentimiento: revocar, reintentarRevocacion: reintentar },
        },
        { provide: EstadoConsultadoService, useValue: consultado },
        { provide: SesionService, useValue: { usuario: signal(usuario) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: CONSENTIMIENTO_ID }) } } },
      ],
    });
  }

  const botonRevocar = () => screen.queryByRole('button', { name: 'Revocar consentimiento' });
  const insignia = () => document.querySelector('app-insignia-estado')?.textContent?.trim();

  async function completarModal() {
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'customer_request');
    await userEvent.type(screen.getByLabelText('Referencia (ticket u orden)'), 'TCK-2026-0412');
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo que actúo/ }));
  }

  describe('carga', () => {
    it('consulta el estado si no viene de la búsqueda y muestra «Consultando» mientras tanto', async () => {
      const lectura = new Subject<EstadoRevocacion>();
      await renderizar({ lecturas: [lectura] });

      expect(screen.getByRole('status').textContent).toContain('Cargando el consentimiento');
      lectura.next(activo);

      expect(await screen.findByRole('heading', { name: `Consentimiento ${CONSENTIMIENTO_ID}`, level: 1 })).toBeTruthy();
      expect(consultar).toHaveBeenCalledWith(CONSENTIMIENTO_ID);
    });

    it('no vuelve a consultar si el estado viene de la búsqueda (S10)', async () => {
      await renderizar({ guardado: activo });

      expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
      expect(consultar).not.toHaveBeenCalled();
    });

    it('un consentimiento inexistente muestra «no encontrado» con un enlace a buscar otro', async () => {
      await renderizar({ lecturas: [falla('consent_not_found')] });

      expect(await screen.findByRole('heading', { name: 'No encontramos este consentimiento' })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toContain(CONSENTIMIENTO_ID);
      expect(screen.getByRole('link', { name: 'Buscar otro' }).getAttribute('href')).toBe('/auditoria/consentimientos');
    });

    it('un fallo del servicio muestra el error con «Reintentar» que vuelve a consultar', async () => {
      await renderizar({ lecturas: [falla('service_unavailable'), of(activo)] });
      expect((await screen.findByRole('alert')).textContent).toContain('El servicio de auditoría no respondió');

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
      expect(consultar).toHaveBeenCalledTimes(2);
    });

    it('un 403 no pinta aviso propio: lo resuelve el interceptor', async () => {
      await renderizar({ lecturas: [falla('forbidden')] });

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    });
  });

  describe('estados', () => {
    it('activo: muestra el cliente enmascarado, las acciones y la nota de reglas (CA-1)', async () => {
      await renderizar({ guardado: activo });

      expect(insignia()).toBe('Activo');
      expect(screen.getByText(/Ana María Pérez · \*{6}4050 · otorgado el 20\/10\/2026/)).toBeTruthy();
      expect(botonRevocar()).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
      expect(screen.getByRole('region', { name: 'Revocación desde el portal' }).textContent).toContain('5 minutos');
      expect(screen.queryByRole('region', { name: 'Registro de la operación' })).toBeNull();
      // Alcance con sus categorías traducidas.
      const alcance = screen.getByRole('region', { name: 'Alcance detallado' });
      expect(alcance.textContent).toMatch(/productos de crédito,\s+saldos,\s+comportamiento de pago/);
      // Lo que el contrato no trae no se pinta (F4).
      for (const oculto of ['Descargar evidencia', 'Ver acuse', 'NIT', 'Contacto', 'hash']) {
        expect(screen.queryByText(new RegExp(oculto))).toBeNull();
      }
    });

    it('en curso: «Revocación en curso», la entidad pendiente y el registro de la operación (CA-2, CA-5)', async () => {
      // Dentro de la ventana de la entidad: pasado su plazo el sondeo se detiene y aparece otro aviso.
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date('2026-10-25T16:00:30Z'));
      await renderizar({ guardado: enCurso });

      expect(insignia()).toBe('Revocación en curso');
      expect(botonRevocar()).toBeNull();
      expect(screen.getByRole('status').textContent).toContain('Solventa ya no consulta datos de este cliente');
      expect(within(screen.getByRole('table')).getByText('Pendiente')).toBeTruthy();
      const registro = within(screen.getByRole('region', { name: 'Registro de la operación' }));
      expect(registro.getByText('REV-2026-0089 · Disponible en la app del cliente')).toBeTruthy();
      expect(registro.getByText('Solicitud del cliente')).toBeTruthy();
      expect(registro.getByText('TCK-2026-0412')).toBeTruthy();
      expect(registro.getByText('Portal de cumplimiento')).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Efecto inmediato en Solventa' })).toBeTruthy();
    });

    it('«Solicitada por» muestra el nombre de la sesión solo si el sub coincide (F4)', async () => {
      await renderizar({ guardado: enCurso });
      expect(screen.getByText('Andrés Ruiz · Analista de operaciones')).toBeTruthy();
    });

    it('«Solicitada por» de otro analista no inventa un nombre', async () => {
      await renderizar({ guardado: enCurso, usuarioId: 'sub-otro' });

      const registro = within(screen.getByRole('region', { name: 'Registro de la operación' }));
      expect(registro.getByText('Analista de operaciones')).toBeTruthy();
      expect(screen.queryByText(/Andrés Ruiz/)).toBeNull();
    });

    it('revocado: sin acciones, con la nota de por qué y el historial completo (CA-4, CA-5)', async () => {
      await renderizar({ guardado: revocado });

      expect(insignia()).toBe('Revocado');
      expect(botonRevocar()).toBeNull();
      expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
      expect(screen.getByText(/ya está revocado: no se puede revocar de nuevo/)).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
      expect(within(screen.getByRole('region', { name: 'Historial de estados' })).getAllByRole('listitem')).toHaveLength(4);
    });

    it('revocado desde la app: «El titular desde la app», sin motivo ni referencia', async () => {
      await renderizar({ guardado: mapearEstadoRevocacion(ESTADO_REVOCADO_EN_APP_DTO) });

      const registro = within(screen.getByRole('region', { name: 'Registro de la operación' }));
      expect(registro.getByText('El titular desde la app')).toBeTruthy();
      expect(registro.getByText('App móvil')).toBeTruthy();
      expect(registro.queryByText('Motivo')).toBeNull();
      expect(registro.queryByText('Referencia')).toBeNull();
    });

    it('un canal desconocido se muestra crudo (F5)', async () => {
      const dto: EstadoRevocacionDto = structuredClone(ESTADO_REVOCADO_DTO);
      dto.revocation!.channel = 'canal_nuevo';

      await renderizar({ guardado: mapearEstadoRevocacion(dto) });

      expect(within(screen.getByRole('region', { name: 'Registro de la operación' })).getByText('canal_nuevo')).toBeTruthy();
    });

    it('vencido: «Vencido», sin acción y con la nota de por qué (CA-4)', async () => {
      await renderizar({ guardado: mapearEstadoRevocacion(ESTADO_VENCIDO_DTO) });

      expect(insignia()).toBe('Vencido');
      expect(botonRevocar()).toBeNull();
      expect(screen.getByText(/está vencido: no hay nada que revocar/)).toBeTruthy();
    });

    it('parcial (O15c): alerta con quién no confirmó y la hora, insignia y «Reintentar en …» (CA-3)', async () => {
      await renderizar({ guardado: parcial });

      expect(insignia()).toBe('Revocación parcial');
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('Revocación parcial');
      expect(alerta.textContent).toMatch(/Banco Aliado: sin confirmación, tiempo agotado a las \d{2}:\d{2}/);
      expect(botonRevocar()).toBeNull();
      expect(screen.getByRole('button', { name: 'Reintentar en Banco Aliado' })).toBeTruthy();
      expect(screen.getByText(/solo falta que las entidades sin confirmación respondan/)).toBeTruthy();
    });

    it('parcial con una entidad que confirmó y otra no: la alerta nombra a las dos y el botón es solo de las pendientes', async () => {
      const dto: EstadoRevocacionDto = structuredClone(ESTADO_PARCIAL_DTO);
      dto.revocation!.entities.push({
        code: 'aliado-banco-2',
        name: 'Banco Central',
        status: 'confirmed',
        confirmed_at: '2026-10-25T16:01:10Z',
        deadline_at: '2026-10-25T16:05:00Z',
      });
      await renderizar({ guardado: mapearEstadoRevocacion(dto) });

      const alerta = screen.getByRole('alert').textContent;
      expect(alerta).toMatch(/Banco Aliado: sin confirmación, tiempo agotado/);
      expect(alerta).toMatch(/Banco Central: confirmó a las \d{2}:\d{2}/);
      expect(screen.getByRole('button', { name: 'Reintentar en Banco Aliado' })).toBeTruthy();
    });

    it('con varias entidades sin confirmar el botón dice cuántas', async () => {
      const dto: EstadoRevocacionDto = structuredClone(ESTADO_PARCIAL_DTO);
      dto.revocation!.entities.push({ ...dto.revocation!.entities[0], code: 'aliado-banco-2', name: 'Banco Central' });

      await renderizar({ guardado: mapearEstadoRevocacion(dto) });

      expect(screen.getByRole('button', { name: 'Reintentar en 2 entidades' })).toBeTruthy();
    });
  });

  describe('revocar: activo → confirmando → en curso → revocado', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
    afterEach(() => vi.useRealTimers());

    it('abre el modal, envía con la Idempotency-Key, pinta la confirmación del servidor y sondea hasta «Revocado»', async () => {
      vi.setSystemTime(new Date('2026-10-25T16:00:30Z'));
      await renderizar({ guardado: activo, lecturas: [of(enCurso), of(revocado)] });

      await userEvent.click(botonRevocar()!);
      const dialogo = screen.getByRole('dialog', { name: 'Revocar el consentimiento de Ana María Pérez' });
      expect(within(dialogo).getByText('Ana María Pérez · ******4050')).toBeTruthy();
      await completarModal();
      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));

      expect(revocar).toHaveBeenCalledWith(
        CONSENTIMIENTO_ID,
        { motivo: 'customer_request', referencia: 'TCK-2026-0412', rolConfirmado: true },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(insignia()).toBe('Revocación en curso');
      expect(botonRevocar()).toBeNull();

      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS);
      expect(consultar).toHaveBeenCalledTimes(1);
      expect(insignia()).toBe('Revocación en curso');
      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS);
      expect(insignia()).toBe('Revocado');
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('la confirmación solo se pinta con la respuesta del servidor, nunca de forma optimista', async () => {
      const respuesta = new Subject<EstadoRevocacion>();
      await renderizar({ guardado: activo });
      revocar.mockReturnValue(respuesta);
      await userEvent.click(botonRevocar()!);
      await completarModal();

      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));

      expect(screen.getByRole('button', { name: 'Revocando…' })).toBeTruthy();
      expect(insignia()).toBe('Activo');
      expect(screen.queryByRole('region', { name: 'Registro de la operación' })).toBeNull();
      // Con el envío en curso el modal no se cierra.
      pulsarEscapeEnDialogo(document.querySelector('dialog')!);
      expect(screen.getByRole('dialog')).toBeTruthy();

      respuesta.next(enCurso);
      respuesta.complete();
      expect(await screen.findByRole('region', { name: 'Registro de la operación' })).toBeTruthy();
      expect(insignia()).toBe('Revocación en curso');
    });

    it('un 503 deja el modal con lo diligenciado y reenvía la misma Idempotency-Key', async () => {
      await renderizar({ guardado: activo });
      revocar.mockReturnValueOnce(falla('service_unavailable'));
      await userEvent.click(botonRevocar()!);
      await completarModal();

      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));

      expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain('no se cambió nada');
      expect((screen.getByLabelText('Referencia (ticket u orden)') as HTMLInputElement).value).toBe('TCK-2026-0412');
      expect(insignia()).toBe('Activo');
      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));
      expect(revocar).toHaveBeenCalledTimes(2);
      expect(revocar.mock.calls[1][2]).toBe(revocar.mock.calls[0][2]);
      expect(insignia()).toBe('Revocación en curso');
    });

    it('cerrar y volver a abrir el modal usa otra Idempotency-Key', async () => {
      await renderizar({ guardado: activo });
      revocar.mockReturnValueOnce(falla('service_unavailable'));
      await userEvent.click(botonRevocar()!);
      await completarModal();
      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(document.activeElement).toBe(botonRevocar());

      await userEvent.click(botonRevocar()!);
      await completarModal();
      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));

      expect(revocar.mock.calls[1][2]).not.toBe(revocar.mock.calls[0][2]);
    });

    it('un 400 validation_failed marca los campos en el modal y no cierra', async () => {
      await renderizar({ guardado: activo });
      revocar.mockReturnValueOnce(
        throwError(() => new ErrorRevocacion('validation_failed', [{ campo: 'referencia', codigo: 'invalid_format' }])),
      );
      await userEvent.click(botonRevocar()!);
      await completarModal();

      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));

      expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain('La referencia solo admite letras sin tilde');
    });

    it.each([
      ['consent_already_revoked', /ya fue revocado mientras confirmabas/],
      ['consent_not_active', /venció mientras confirmabas/],
    ] as const)('un 409 %s cierra el modal, recarga el estado y avisa el motivo (CA-4)', async (codigo, texto) => {
      await renderizar({ guardado: activo, lecturas: [of(mapearEstadoRevocacion(ESTADO_REVOCADO_EN_APP_DTO))] });
      revocar.mockReturnValueOnce(falla(codigo));
      await userEvent.click(botonRevocar()!);
      await completarModal();

      await userEvent.click(screen.getByRole('button', { name: 'Revocar ahora' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(consultar).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status').textContent).toMatch(texto);
      expect(insignia()).toBe('Revocado');
      expect(botonRevocar()).toBeNull();
    });
  });

  describe('parcial → reintentar → en curso', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
    afterEach(() => vi.useRealTimers());

    it('«Reintentar» envía el reintento, vuelve a «Pendiente» y sondea hasta «Revocado» (CA-3)', async () => {
      vi.setSystemTime(new Date('2026-10-25T16:05:30Z'));
      await renderizar({ guardado: parcial, lecturas: [of(revocado)] });

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar en Banco Aliado' }));

      expect(reintentar).toHaveBeenCalledWith(CONSENTIMIENTO_ID);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(insignia()).toBe('Revocación en curso');
      expect(within(screen.getByRole('table')).getByText('Pendiente')).toBeTruthy();
      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS);
      expect(insignia()).toBe('Revocado');
    });

    it('un fallo del reintento avisa sin perder el estado', async () => {
      await renderizar({ guardado: parcial });
      reintentar.mockReturnValueOnce(falla('service_unavailable'));

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar en Banco Aliado' }));

      expect(screen.getAllByRole('alert').map((a) => a.textContent).join()).toContain('No pudimos reintentar el aviso');
      expect(insignia()).toBe('Revocación parcial');
      expect(screen.getByRole('button', { name: 'Reintentar en Banco Aliado' }).hasAttribute('disabled')).toBe(false);
    });

    it.each(['nothing_to_retry', 'consent_not_revoked'] as const)('un 409 %s recarga el estado sin aviso de error', async (codigo) => {
      await renderizar({ guardado: parcial, lecturas: [of(revocado)] });
      reintentar.mockReturnValueOnce(falla(codigo));

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar en Banco Aliado' }));

      expect(consultar).toHaveBeenCalledTimes(1);
      expect(insignia()).toBe('Revocado');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('sondeo detenido (S4)', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
    afterEach(() => vi.useRealTimers());

    it('tras 3 fallos seguidos avisa «No pudimos actualizar el estado» y «Actualizar» lo reanuda', async () => {
      vi.setSystemTime(new Date('2026-10-25T16:00:30Z'));
      await renderizar({
        guardado: enCurso,
        lecturas: [falla('service_unavailable'), falla('service_unavailable'), falla('service_unavailable'), of(enCurso)],
      });

      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS * 3 + 10);

      expect(screen.getByText('No pudimos actualizar el estado')).toBeTruthy();
      expect(insignia()).toBe('Revocación en curso');
      await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
      expect(screen.queryByText('No pudimos actualizar el estado')).toBeNull();
      expect(consultar).toHaveBeenCalledTimes(4);
    });

    it('deja de sondear al salir de la página', async () => {
      vi.setSystemTime(new Date('2026-10-25T16:00:30Z'));
      const vista = await renderizar({ guardado: enCurso, lecturas: [of(enCurso)] });

      vista.fixture.destroy();
      await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS * 3);

      expect(consultar).not.toHaveBeenCalled();
    });
  });
});
