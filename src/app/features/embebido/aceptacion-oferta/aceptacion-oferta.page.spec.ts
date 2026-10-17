import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Aceptacion, ErrorAceptacion, MotivoRevision } from '@core/api/originacion/aceptacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';
import { AceptacionOfertaPage } from './aceptacion-oferta.page';
import { CLAVE_TRAMITE_ACEPTACION } from './servicios/tramite-aceptacion.service';

type Llamada = ReturnType<typeof vi.fn<(id: string) => Observable<Aceptacion>>>;

const NO_ACEPTADA = () => throwError(() => new ErrorAceptacion('acceptance_not_found'));

function aceptacion(cambios: Partial<Aceptacion> = {}): Aceptacion {
  return {
    aceptacionId: 'b310b02b-9820-4725-bded-586d263dd16e',
    ofertaId: 'demo-active-1',
    clienteId: 'sub-asegurado',
    canal: 'web',
    aceptadaEn: '2026-10-12T01:54:41.0909319Z',
    estado: 'registered',
    suscripcion: null,
    procesamiento: { intentos: 0, ultimaFallaEn: null, proximoIntentoEn: null },
    actualizadaEn: '2026-10-12T01:54:41.0909319Z',
    ...cambios,
  };
}

const EN_REVISION = aceptacion({
  estado: 'in_review',
  suscripcion: { resultado: 'human_review', motivo: 'provisional_offer', decididaEn: '2026-10-12T01:54:42Z' },
});

describe('AceptacionOfertaPage (E3, E6, E7 · HU-W1.3-01)', () => {
  let aceptar: Llamada;
  let consultar: Llamada;
  let consultarDeOferta: Llamada;
  let manejador: { handleError: ReturnType<typeof vi.fn> };

  async function renderizar({
    ofertaId = 'demo-active-1' as string | null,
    deOferta = NO_ACEPTADA() as Observable<Aceptacion>,
  } = {}) {
    aceptar = vi.fn();
    consultar = vi.fn();
    consultarDeOferta = vi.fn().mockReturnValue(deOferta);
    manejador = { handleError: vi.fn() };
    return render(AceptacionOfertaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: ErrorHandler, useValue: manejador },
        {
          provide: OriginacionApiService,
          useValue: {
            aceptarOferta: aceptar,
            consultarAceptacion: consultar,
            consultarAceptacionDeOferta: consultarDeOferta,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(ofertaId ? { ofertaId } : {}) } },
        },
      ],
    });
  }

  function titulo(): string {
    return screen.getByRole('heading', { level: 1 }).textContent?.trim() ?? '';
  }

  function marcarTerminos(): void {
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto las condiciones generales/ }));
  }

  function botonAceptar(): HTMLButtonElement {
    return screen.getByRole('button', { name: /Aceptar oferta y pagar|Registrando tu aceptación/ }) as HTMLButtonElement;
  }

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  describe('oferta sin aceptación (E3)', () => {
    it('retoma por la oferta y, si no tiene aceptación, muestra la oferta con «Aceptar»', async () => {
      await renderizar();

      expect(consultarDeOferta).toHaveBeenCalledWith('demo-active-1');
      expect(titulo()).toBe('Tu oferta personalizada');
      expect(screen.getByText('Oferta N.º demo-active-1')).toBeTruthy();
      expect(screen.getByText(/89\.500 COP/)).toBeTruthy();
      expect(screen.getByText('Fallecimiento por cualquier causa')).toBeTruthy();
      expect(screen.getByText(/30 % del saldo, hasta .*75\.000\.000 COP/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'No me interesa' }).getAttribute('href')).toBe('/inicio');
      expect(botonAceptar().disabled).toBe(false);
    });

    it('marca la oferta como personalizada con el perfil del paso 2', async () => {
      await renderizar();
      TestBed.inject(FlujoEmbebidoService).perfil.set({
        clienteId: 'cli-1',
        modo: 'provisional',
        origen: 'cache',
        puntaje: 600,
        categoria: 'C',
        fechaPerfil: '2026-09-16T19:02:00Z',
        fuenteNoDisponible: 'open_finance',
        aviso: 'last_profile_in_use',
        parcial: false,
        fuentes: [],
      });
      await screen.findByText('Provisional');

      expect(screen.getByText(/Categoría C · calculado el/)).toBeTruthy();
    });

    it('exige aceptar las condiciones antes de enviar', async () => {
      await renderizar();

      fireEvent.click(botonAceptar());

      expect(aceptar).not.toHaveBeenCalled();
      expect(screen.getByText('Debes aceptar las condiciones para continuar.')).toBeTruthy();
      expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('aceptación de la oferta (E3 → registrada)', () => {
    it('envía el POST una sola vez, deshabilita el botón mientras tanto y confirma la aceptación registrada', async () => {
      const respuesta = new Subject<Aceptacion>();
      const { detectChanges } = await renderizar();
      aceptar.mockReturnValue(respuesta);
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();
      expect(aceptar).toHaveBeenCalledWith('demo-active-1');
      expect(botonAceptar().disabled).toBe(true);
      expect(botonAceptar().textContent).toContain('Registrando tu aceptación…');
      fireEvent.click(botonAceptar());
      expect(aceptar).toHaveBeenCalledTimes(1);

      vi.useFakeTimers();
      consultar.mockReturnValue(new Subject<Aceptacion>());
      respuesta.next(aceptacion());
      detectChanges();

      expect(titulo()).toBe('Registramos tu aceptación');
      expect(screen.getByText(/Estamos validando tu solicitud…/)).toBeTruthy();
      expect(screen.getByRole('progressbar', { name: 'Validación de la solicitud en curso' })).toBeTruthy();
      expect(screen.getByText('Validando')).toBeTruthy();
      expect(document.querySelector('[aria-current="step"]')?.textContent).toContain('Pago');
      expect(JSON.parse(sessionStorage.getItem(CLAVE_TRAMITE_ACEPTACION) ?? '{}').ofertaId).toBe('demo-active-1');
    });

    it('con el polling llega a «Suscripción aprobada» cuando la emisión inicia', async () => {
      const { detectChanges } = await renderizar();
      vi.useFakeTimers();
      aceptar.mockReturnValue(of(aceptacion()));
      consultar.mockReturnValue(of(aceptacion({ estado: 'issuance_pending' })));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      await vi.advanceTimersByTimeAsync(1_000);
      detectChanges();

      expect(consultar).toHaveBeenCalledWith('b310b02b-9820-4725-bded-586d263dd16e');
      expect(titulo()).toBe('Suscripción aprobada');
      expect(screen.getByText('Emisión iniciada')).toBeTruthy();
      expect(screen.getByRole('link', { name: /Continuar con mi crédito/ })).toBeTruthy();
    });

    it('con el polling muestra la solicitud en revisión dentro del mismo flujo (E6)', async () => {
      const { detectChanges } = await renderizar();
      vi.useFakeTimers();
      aceptar.mockReturnValue(of(aceptacion()));
      consultar.mockReturnValue(of(EN_REVISION));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      await vi.advanceTimersByTimeAsync(1_000);
      detectChanges();

      expect(titulo()).toBe('Tu solicitud está en revisión');
      expect(screen.getByText('En revisión')).toBeTruthy();
      expect(screen.getByText('Tu oferta se calculó con información provisional')).toBeTruthy();
      expect(screen.getByText(EN_REVISION.aceptacionId)).toBeTruthy();
      expect(screen.getByText(/La oferta demo-active-1 y su prima de .*89\.500 COP/)).toBeTruthy();
    });

    it('si se pierde la respuesta del POST, «Reintentar» reenvía el mismo POST (acceptance_not_registered)', async () => {
      const { detectChanges } = await renderizar();
      aceptar
        .mockReturnValueOnce(throwError(() => new ErrorAceptacion('acceptance_not_registered')))
        .mockReturnValueOnce(of(EN_REVISION));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();
      expect(screen.getByRole('alert').textContent).toContain('No pudimos registrar tu aceptación');

      fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
      detectChanges();
      expect(aceptar).toHaveBeenNthCalledWith(2, 'demo-active-1');
      expect(titulo()).toBe('Tu solicitud está en revisión');
    });

    it('con un 401 o 403 no muestra un error propio: el interceptor lleva a la pantalla de acceso', async () => {
      const { detectChanges } = await renderizar();
      aceptar.mockReturnValue(throwError(() => new ErrorAceptacion('unauthorized')));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(titulo()).toBe('Tu oferta personalizada');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(botonAceptar().disabled).toBe(false);
    });
  });

  describe('oferta vencida (E7)', () => {
    it('informa el vencimiento y ofrece generar una nueva oferta', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'demo-expired-1' });
      aceptar.mockReturnValue(
        throwError(() => new ErrorAceptacion('offer_expired', '2026-10-12T00:54:44.4210077Z')),
      );
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(titulo()).toBe('Esta oferta venció');
      expect(screen.getByText(/La oferta demo-expired-1 venció el .*2026/)).toBeTruthy();
      expect(screen.getByText('Vencida')).toBeTruthy();
      expect(screen.getByRole('link', { name: /Generar una nueva oferta/ }).getAttribute('href')).toBe(
        '/embebido/consentimiento',
      );
      expect(screen.getByRole('link', { name: 'No, gracias' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Aceptar oferta/ })).toBeNull();
    });
  });

  /**
   * Retoma el trámite con la respuesta dada de `GET /v1/offers/{id}/acceptance`. Los temporizadores falsos se
   * instalan después de renderizar (el render usa los reales) y antes de que la respuesta programe el polling.
   */
  async function retomarCon(respuesta: Aceptacion, temporizadores: ('setTimeout' | 'clearTimeout' | 'Date')[]) {
    const deOferta = new Subject<Aceptacion>();
    const resultado = await renderizar({ deOferta });
    vi.useFakeTimers({ toFake: temporizadores });
    deOferta.next(respuesta);
    resultado.detectChanges();
    return resultado;
  }

  describe('aceptación conservada ante falla posterior', () => {
    it('retoma sola la aceptación con intentos fallidos, sin pedir que se repita, hasta la emisión', async () => {
      const conFalla = aceptacion({
        procesamiento: {
          intentos: 1,
          ultimaFallaEn: '2026-10-12T01:54:44.4842859Z',
          proximoIntentoEn: '2026-10-12T01:54:46.4842859Z',
        },
      });
      const { detectChanges } = await retomarCon(conFalla, ['setTimeout', 'clearTimeout']);
      consultar.mockReturnValue(of(aceptacion({ estado: 'issuance_pending' })));

      expect(titulo()).toBe('Tu aceptación está guardada');
      expect(screen.getByText(/no necesitas repetirlo/)).toBeTruthy();
      expect(screen.getByText('Reanudando')).toBeTruthy();
      expect(screen.getByText(/Intentos sin éxito: 1/)).toBeTruthy();
      expect(screen.getByText('Próximo intento automático')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Aceptar oferta/ })).toBeNull();
      expect(aceptar).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      detectChanges();
      expect(titulo()).toBe('Suscripción aprobada');
    });

    it('tras 2 minutos en registered mantiene el mensaje de aceptación conservada', async () => {
      const { detectChanges } = await retomarCon(aceptacion(), ['setTimeout', 'clearTimeout', 'Date']);
      consultar.mockReturnValue(of(aceptacion()));
      expect(titulo()).toBe('Registramos tu aceptación');

      await vi.advanceTimersByTimeAsync(122_000);
      detectChanges();

      expect(titulo()).toBe('Tu aceptación está guardada');
    });

    it('ante acceptance_unavailable en el polling mantiene la última pantalla', async () => {
      const { detectChanges } = await retomarCon(aceptacion(), ['setTimeout', 'clearTimeout']);
      consultar.mockReturnValue(throwError(() => new ErrorAceptacion('acceptance_unavailable')));

      await vi.advanceTimersByTimeAsync(6_000);
      detectChanges();

      expect(consultar.mock.calls.length).toBeGreaterThan(1);
      expect(titulo()).toBe('Registramos tu aceptación');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('si la aceptación se perdió en el backend vuelve a mostrar la oferta', async () => {
      const { detectChanges } = await retomarCon(aceptacion(), ['setTimeout', 'clearTimeout']);
      consultar.mockReturnValue(throwError(() => new ErrorAceptacion('acceptance_not_found')));
      consultarDeOferta.mockReturnValue(NO_ACEPTADA());

      await vi.advanceTimersByTimeAsync(2_000);
      detectChanges();

      expect(titulo()).toBe('Tu oferta personalizada');
    });
  });

  describe('retomar el trámite', () => {
    it('una solicitud ya en revisión se pinta sin reenviar el POST ni consultar más', async () => {
      await retomarCon(EN_REVISION, ['setTimeout', 'clearTimeout']);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(titulo()).toBe('Tu solicitud está en revisión');
      expect(aceptar).not.toHaveBeenCalled();
      expect(consultar).not.toHaveBeenCalled();
    });

    it('«Ver estado de la solicitud» vuelve a consultar por la oferta', async () => {
      await renderizar({ deOferta: of(EN_REVISION) });

      fireEvent.click(screen.getByRole('button', { name: 'Ver estado de la solicitud' }));

      expect(consultarDeOferta).toHaveBeenCalledTimes(2);
    });

    it('sin identificador en la URL usa la oferta guardada en sessionStorage', async () => {
      sessionStorage.setItem(CLAVE_TRAMITE_ACEPTACION, JSON.stringify({ ofertaId: 'demo-review-1', aceptacionId: 'a-9' }));

      await renderizar({ ofertaId: null });

      expect(consultarDeOferta).toHaveBeenCalledWith('demo-review-1');
    });

    it('sin identificador ni trámite guardado invita a volver a cotizar', async () => {
      await renderizar({ ofertaId: null });

      expect(consultarDeOferta).not.toHaveBeenCalled();
      expect(titulo()).toBe('No encontramos una oferta para continuar');
      expect(screen.getByRole('link', { name: 'Volver a cotizar' }).getAttribute('href')).toBe('/embebido/consentimiento');
    });

    it('sin servicio al retomar ofrece reintentar', async () => {
      const { detectChanges } = await renderizar({
        deOferta: throwError(() => new ErrorAceptacion('acceptance_unavailable')),
      });
      expect(titulo()).toBe('No pudimos consultar tu trámite');
      consultarDeOferta.mockReturnValue(NO_ACEPTADA());

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      detectChanges();

      expect(titulo()).toBe('Tu oferta personalizada');
    });
  });

  describe('motivo de la revisión (E6)', () => {
    function enRevisionPor(motivo: MotivoRevision): Aceptacion {
      return aceptacion({
        estado: 'in_review',
        suscripcion: { resultado: 'human_review', motivo, decididaEn: '2026-10-12T01:54:42Z' },
      });
    }

    it('con high_risk_score muestra que el perfil requiere una revisión adicional', async () => {
      await retomarCon(enRevisionPor('high_risk_score'), ['setTimeout', 'clearTimeout']);

      expect(titulo()).toBe('Tu solicitud está en revisión');
      expect(screen.getByText('Tu perfil requiere una revisión adicional')).toBeTruthy();
    });

    it('con un motivo que no conoce muestra el texto genérico, nunca la clave sin traducir', async () => {
      const desconocido = 'motivo_nuevo_del_motor' as string as MotivoRevision;

      await retomarCon(enRevisionPor(desconocido), ['setTimeout', 'clearTimeout']);

      expect(titulo()).toBe('Tu solicitud está en revisión');
      expect(screen.getByText('Validación adicional de suscripción')).toBeTruthy();
      expect(screen.queryByText(/aceptacionOferta\.revision\.motivo/)).toBeNull();
    });
  });

  describe('errores del catálogo', () => {
    it('offer_not_found muestra que la oferta no existe y ofrece volver a cotizar', async () => {
      const { detectChanges } = await renderizar();
      aceptar.mockReturnValue(throwError(() => new ErrorAceptacion('offer_not_found')));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(titulo()).toBe('Esta oferta no existe o ya no está disponible');
      expect(screen.getByRole('link', { name: 'Volver a cotizar' })).toBeTruthy();
    });

    it('invalid_request se registra en el manejador global y muestra el error genérico', async () => {
      const { detectChanges } = await renderizar();
      const error = new ErrorAceptacion('invalid_request');
      aceptar.mockReturnValue(throwError(() => error));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(manejador.handleError).toHaveBeenCalledWith(error);
      expect(titulo()).toBe('No pudimos procesar tu solicitud');
    });
  });
});
