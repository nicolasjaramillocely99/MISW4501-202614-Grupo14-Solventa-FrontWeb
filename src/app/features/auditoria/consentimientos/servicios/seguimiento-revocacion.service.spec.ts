import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  CodigoErrorRevocacion,
  ErrorRevocacion,
  EstadoRevocacion,
  SolicitudRevocacion,
  mapearEstadoRevocacion,
} from '@core/api/auditoria/revocacion.modelos';
import {
  CONSENTIMIENTO_ID,
  ESTADO_ACTIVO_DTO,
  ESTADO_EN_CURSO_DTO,
  ESTADO_PARCIAL_DTO,
  ESTADO_REVOCADO_DTO,
} from '@testing/revocacion-pruebas';

import { FALLOS_MAXIMOS, INTERVALO_SONDEO_MS, SeguimientoRevocacionService } from './seguimiento-revocacion.service';

const ACTIVO = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);
const EN_CURSO = mapearEstadoRevocacion(ESTADO_EN_CURSO_DTO);
const REVOCADO = mapearEstadoRevocacion(ESTADO_REVOCADO_DTO);
const PARCIAL = mapearEstadoRevocacion(ESTADO_PARCIAL_DTO);
const SOLICITUD: SolicitudRevocacion = { motivo: 'customer_request', referencia: 'TCK-2026-0412', rolConfirmado: true };
const falla = (codigo: CodigoErrorRevocacion) => throwError(() => new ErrorRevocacion(codigo));

describe('SeguimientoRevocacionService (HU-W4.2-02)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<EstadoRevocacion>>>;
  let revocar: ReturnType<typeof vi.fn<(id: string, s: SolicitudRevocacion, clave: string) => Observable<EstadoRevocacion>>>;
  let reintentar: ReturnType<typeof vi.fn<(id: string) => Observable<unknown>>>;
  let servicio: SeguimientoRevocacionService;

  beforeEach(() => {
    vi.useFakeTimers();
    // Dentro de la ventana de las entidades del contrato (plazo 16:05).
    vi.setSystemTime(new Date('2026-10-25T16:00:30Z'));
    consultar = vi.fn().mockReturnValue(of(REVOCADO));
    revocar = vi.fn().mockReturnValue(of(EN_CURSO));
    reintentar = vi.fn().mockReturnValue(of({ entidadesReintentadas: ['aliado-banco-1'], estado: EN_CURSO }));
    TestBed.configureTestingModule({
      providers: [
        SeguimientoRevocacionService,
        { provide: AuditoriaApiService, useValue: { consultarEstadoRevocacion: consultar, revocarConsentimiento: revocar, reintentarRevocacion: reintentar } },
      ],
    });
    servicio = TestBed.inject(SeguimientoRevocacionService);
  });

  afterEach(() => vi.useRealTimers());

  it('con un estado sin avisos pendientes no sondea', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 5);

    expect(servicio.estado()).toBe(ACTIVO);
    expect(servicio.actualizacion()).toBe('al-dia');
    expect(consultar).not.toHaveBeenCalled();
  });

  it('con el aviso en curso consulta cada 5 s y se detiene cuando todas confirman', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);
    expect(servicio.actualizacion()).toBe('sondeando');
    consultar.mockReturnValueOnce(of(EN_CURSO)).mockReturnValueOnce(of(REVOCADO));

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS - 1);
    expect(consultar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(servicio.estado()).toBe(EN_CURSO);
    expect(servicio.actualizacion()).toBe('sondeando');

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS);
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(consultar).toHaveBeenCalledWith(CONSENTIMIENTO_ID);
    expect(servicio.estado()).toBe(REVOCADO);
    expect(servicio.actualizacion()).toBe('al-dia');

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 5);
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('la ventana de un reintento (parcial con la entidad pendiente) también se sondea', () => {
    const enReintento: EstadoRevocacion = {
      ...PARCIAL,
      revocacion: { ...PARCIAL.revocacion!, entidades: [{ ...PARCIAL.revocacion!.entidades[0], estado: 'pending' }] },
    };
    servicio.iniciar(CONSENTIMIENTO_ID, enReintento);

    expect(servicio.actualizacion()).toBe('sondeando');
  });

  it('se detiene al destruirse el servicio', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 3);

    expect(consultar).not.toHaveBeenCalled();
  });

  it('un fallo suelto no corta el sondeo y un acierto reinicia la cuenta', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);
    consultar
      .mockReturnValueOnce(falla('service_unavailable'))
      .mockReturnValueOnce(falla('service_unavailable'))
      .mockReturnValueOnce(of(EN_CURSO))
      .mockReturnValueOnce(falla('service_unavailable'))
      .mockReturnValueOnce(falla('service_unavailable'))
      .mockReturnValueOnce(of(REVOCADO));

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 6);

    expect(consultar).toHaveBeenCalledTimes(6);
    expect(servicio.estado()).toBe(REVOCADO);
    expect(servicio.actualizacion()).toBe('al-dia');
  });

  it('tras 3 fallos seguidos se detiene y deja el último estado', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);
    consultar.mockReturnValue(falla('service_unavailable'));

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * FALLOS_MAXIMOS);

    expect(consultar).toHaveBeenCalledTimes(FALLOS_MAXIMOS);
    expect(servicio.actualizacion()).toBe('detenido');
    expect(servicio.estado()).toBe(EN_CURSO);

    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 5);
    expect(consultar).toHaveBeenCalledTimes(FALLOS_MAXIMOS);
  });

  it('«Actualizar» (recargar) reanuda el seguimiento tras detenerse', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);
    consultar.mockReturnValue(falla('service_unavailable'));
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * FALLOS_MAXIMOS);
    consultar.mockReturnValue(of(EN_CURSO));

    servicio.recargar().subscribe();

    expect(servicio.actualizacion()).toBe('sondeando');
  });

  it('una recarga que falla conserva el estado y deja el seguimiento detenido', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);
    consultar.mockReturnValue(falla('service_unavailable'));
    let error: unknown;

    servicio.recargar().subscribe({ error: (e: unknown) => (error = e) });

    expect(error).toBeInstanceOf(ErrorRevocacion);
    expect(servicio.estado()).toBe(EN_CURSO);
    expect(servicio.actualizacion()).toBe('detenido');
  });

  it('si pasan 30 s después del mayor plazo sin cambio, deja de consultar', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);
    consultar.mockReturnValue(of(EN_CURSO));
    // Plazo de la entidad 16:05:00.123 + 30 s: se agota entre 16:05:30 y 16:05:35.
    vi.setSystemTime(new Date('2026-10-25T16:05:30.123Z'));
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS);
    expect(servicio.actualizacion()).toBe('detenido');

    const llamadas = consultar.mock.calls.length;
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 4);

    expect(consultar).toHaveBeenCalledTimes(llamadas);
    expect(servicio.estado()).toBe(EN_CURSO);
  });

  it('un estado cuyo límite ya pasó al cargar no empieza a sondear', () => {
    vi.setSystemTime(new Date('2026-10-25T17:00:00Z'));

    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);

    expect(servicio.actualizacion()).toBe('detenido');
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 3);
    expect(consultar).not.toHaveBeenCalled();
  });

  describe('revocar y la Idempotency-Key (S1)', () => {
    it('solo con la respuesta del servidor guarda el estado y empieza a sondear', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();
      const respuesta = new Observable<EstadoRevocacion>(() => undefined);
      revocar.mockReturnValueOnce(respuesta);

      servicio.revocar(SOLICITUD).subscribe();

      expect(servicio.estado()).toBe(ACTIVO);
      expect(servicio.actualizacion()).toBe('al-dia');
    });

    it('con el 201 pasa a «en curso» y sondea hasta «revocado»', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar).toHaveBeenCalledWith(CONSENTIMIENTO_ID, SOLICITUD, expect.stringMatching(/^[0-9a-f-]{36}$/));
      expect(servicio.estado()).toBe(EN_CURSO);
      expect(servicio.actualizacion()).toBe('sondeando');

      vi.advanceTimersByTime(INTERVALO_SONDEO_MS);
      expect(servicio.estado()).toBe(REVOCADO);
      expect(servicio.actualizacion()).toBe('al-dia');
    });

    it('un 503 conserva la clave: el reintento del mismo modal envía la misma', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();
      revocar.mockReturnValueOnce(falla('service_unavailable'));
      servicio.revocar(SOLICITUD).subscribe({ error: () => undefined });

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar).toHaveBeenCalledTimes(2);
      expect(revocar.mock.calls[1][2]).toBe(revocar.mock.calls[0][2]);
    });

    it('un 400 validation_failed también conserva la clave: no se registró nada', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();
      revocar.mockReturnValueOnce(falla('validation_failed'));
      servicio.revocar(SOLICITUD).subscribe({ error: () => undefined });

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar.mock.calls[1][2]).toBe(revocar.mock.calls[0][2]);
    });

    it('al volver a abrir el modal genera otra clave', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();
      revocar.mockReturnValueOnce(falla('service_unavailable'));
      servicio.revocar(SOLICITUD).subscribe({ error: () => undefined });
      servicio.abrirConfirmacion();

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar.mock.calls[1][2]).not.toBe(revocar.mock.calls[0][2]);
    });

    it('idempotency_key_reused descarta la clave: el siguiente intento usa una nueva', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();
      revocar.mockReturnValueOnce(falla('idempotency_key_reused'));
      servicio.revocar(SOLICITUD).subscribe({ error: () => undefined });

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar.mock.calls[1][2]).not.toBe(revocar.mock.calls[0][2]);
    });

    it('sin abrir el modal igual genera una clave', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar.mock.calls[0][2]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('una vez revocado, la siguiente revocación no reutiliza la clave', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, ACTIVO);
      servicio.abrirConfirmacion();
      servicio.revocar(SOLICITUD).subscribe();

      servicio.revocar(SOLICITUD).subscribe();

      expect(revocar.mock.calls[1][2]).not.toBe(revocar.mock.calls[0][2]);
    });
  });

  describe('reintentar', () => {
    it('con el 202 pinta el estado y vuelve a sondear', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, PARCIAL);
      expect(servicio.actualizacion()).toBe('al-dia');

      servicio.reintentar().subscribe();

      expect(reintentar).toHaveBeenCalledWith(CONSENTIMIENTO_ID);
      expect(servicio.estado()).toBe(EN_CURSO);
      expect(servicio.actualizacion()).toBe('sondeando');
    });

    it('si falla deja el estado como estaba', () => {
      servicio.iniciar(CONSENTIMIENTO_ID, PARCIAL);
      reintentar.mockReturnValueOnce(falla('nothing_to_retry'));
      let error: unknown;

      servicio.reintentar().subscribe({ error: (e: unknown) => (error = e) });

      expect((error as ErrorRevocacion).codigo).toBe('nothing_to_retry');
      expect(servicio.estado()).toBe(PARCIAL);
    });
  });

  it('iniciar otro consentimiento descarta el estado y el sondeo anteriores', () => {
    servicio.iniciar(CONSENTIMIENTO_ID, EN_CURSO);

    servicio.iniciar('cns-otro');
    vi.advanceTimersByTime(INTERVALO_SONDEO_MS * 3);

    expect(servicio.estado()).toBeNull();
    expect(servicio.actualizacion()).toBe('al-dia');
    expect(consultar).not.toHaveBeenCalled();
  });
});
