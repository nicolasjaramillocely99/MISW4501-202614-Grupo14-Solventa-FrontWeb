import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import {
  OFERTA_CON_CACHE_DTO,
  OFERTA_NORMAL_DTO,
  OFERTA_PERFIL_BASE_DTO,
  OFERTA_REDUCIDA_DTO,
  OFERTA_REEMPLAZADA_DTO,
  OFERTA_VENCIDA_DTO,
} from '@testing/oferta-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { Aceptacion, ErrorAceptacion, MotivoRevision } from '@core/api/originacion/aceptacion.modelos';
import { ErrorOferta, Oferta, OfertaDto, mapearOferta } from '@core/api/originacion/oferta.modelos';
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
    revision: null,
    procesamiento: { intentos: 0, ultimaFallaEn: null, proximoIntentoEn: null },
    actualizadaEn: '2026-10-12T01:54:41.0909319Z',
    ...cambios,
  };
}

/** La oferta que devuelve `GET /v1/offers/{id}`, con el identificador pedido. */
function oferta(dto: OfertaDto = OFERTA_NORMAL_DTO, cambios: Partial<Oferta> = {}): Oferta {
  return { ...mapearOferta(dto), ...cambios };
}

const EN_REVISION = aceptacion({
  estado: 'in_review',
  suscripcion: { resultado: 'human_review', motivo: 'provisional_offer', decididaEn: '2026-10-12T01:54:42Z' },
});

describe('AceptacionOfertaPage (E3, E6, E7 · HU-W1.3-01)', () => {
  let aceptar: Llamada;
  let consultar: Llamada;
  let consultarDeOferta: Llamada;
  let consultarOferta: ReturnType<typeof vi.fn<(id: string) => Observable<Oferta>>>;
  let renovarOferta: ReturnType<typeof vi.fn<(id: string) => Observable<Oferta>>>;
  let navegar: ReturnType<typeof vi.spyOn>;
  let manejador: { handleError: ReturnType<typeof vi.fn> };
  /** Parámetros de la ruta: la página los sigue porque Angular la reutiliza al cambiar de oferta (E6b). */
  let parametros: BehaviorSubject<ParamMap>;

  async function renderizar({
    ofertaId = 'demo-active-1' as string | null,
    deOferta = NO_ACEPTADA() as Observable<Aceptacion>,
    detalle = (id: string): Observable<Oferta> => of(oferta(OFERTA_NORMAL_DTO, { id })),
  } = {}) {
    aceptar = vi.fn();
    consultar = vi.fn();
    consultarDeOferta = vi.fn().mockReturnValue(deOferta);
    consultarOferta = vi.fn(detalle);
    renovarOferta = vi.fn();
    manejador = { handleError: vi.fn() };
    parametros = new BehaviorSubject(convertToParamMap(ofertaId ? { ofertaId } : {}));
    const resultado = await render(AceptacionOfertaPage, {
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
            consultarOferta,
            renovarOferta,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(ofertaId ? { ofertaId } : {}) }, paramMap: parametros },
        },
      ],
    });
    return resultado;
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
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  describe('oferta sin aceptación (E3)', () => {
    it('retoma por la oferta y, si no tiene aceptación, muestra la oferta con «Aceptar»', async () => {
      await renderizar();

      expect(consultarOferta).toHaveBeenCalledWith('demo-active-1');
      expect(consultarDeOferta).toHaveBeenCalledWith('demo-active-1');
      expect(titulo()).toBe('Tu oferta personalizada');
      expect(screen.getByText(/Oferta N\.º demo-active-1 · Vigente hasta .*2026/)).toBeTruthy();
      expect(screen.getByText('Personalizada')).toBeTruthy();
      expect(screen.getByText(/132\.000 COP/)).toBeTruthy();
      expect(screen.getByText('Fallecimiento por cualquier causa')).toBeTruthy();
      expect(screen.getByText('Incapacidad total y permanente')).toBeTruthy();
      expect(screen.getAllByText(/Hasta .*250\.000\.000 COP/)).toHaveLength(2);
      expect(screen.getByText('20 años · igual al plazo del crédito')).toBeTruthy();
      expect(screen.getByText('La oferta está vigente por 24 horas desde que se genera.')).toBeTruthy();
      expect(screen.getByText('La edad máxima asegurable es de 70 años.')).toBeTruthy();
      expect(screen.getByText(/Tu precio se calcula con tu perfil individual/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'No me interesa' }).getAttribute('href')).toBe('/inicio');
      expect(botonAceptar().disabled).toBe(false);
    });

    it('muestra el banco de la solicitud como beneficiario oneroso', async () => {
      await renderizar();
      TestBed.inject(FlujoEmbebidoService).solicitud.set({
        numero: '48213',
        aliado: 'Banco Aliado',
        banco: 'Banco del Valle',
        montoAprobado: 250000000,
        plazoAnios: 20,
        cuotaEstimada: 2180000,
        moneda: 'COP',
      });
      await screen.findByText(/Banco del Valle \(saldo insoluto\)/);
    });

    it('E3b: con perfil en caché marca la oferta como provisional, con la fecha del perfil y la recotización', async () => {
      await renderizar({ detalle: (id) => of(oferta(OFERTA_CON_CACHE_DTO, { id })) });

      expect(titulo()).toBe('Tu oferta (provisional)');
      expect(screen.getByText('Provisional')).toBeTruthy();
      expect(screen.getByText('Calculamos tu oferta con tu último perfil')).toBeTruthy();
      expect(screen.getByText(/No pudimos consultar Open Finance en este momento, así que usamos tu último perfil, del .*2026/)).toBeTruthy();
      expect(screen.getByText('Prima mensual estimada')).toBeTruthy();
      expect(screen.getByText(/En caché · .*2026/)).toBeTruthy();
      expect(screen.getByText('Fuente no disponible')).toBeTruthy();
      expect(screen.getAllByText(/recalcularemos tu oferta y te avisaremos/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Tu precio se calcula con tu perfil individual/)).toBeNull();
      expect(botonAceptar().disabled).toBe(false);
    });

    it('E3c: con el perfil base lo dice y no inventa una fecha de perfil', async () => {
      await renderizar({ detalle: (id) => of(oferta(OFERTA_PERFIL_BASE_DTO, { id })) });

      expect(titulo()).toBe('Tu oferta (provisional)');
      expect(screen.getByText('Calculamos tu oferta con un perfil general')).toBeTruthy();
      expect(screen.getByText('Base actuarial · cliente sin perfil previo')).toBeTruthy();
      expect(screen.getByText(/Con perfil base · sujeta a recotización/)).toBeTruthy();
    });

    it('con una oferta ajustada o de demostración pinta solo la prima y la vigencia', async () => {
      await renderizar({ detalle: (id) => of(oferta(OFERTA_REDUCIDA_DTO, { id })) });

      expect(titulo()).toBe('Tu oferta personalizada');
      expect(screen.getByText(/89\.500 COP/)).toBeTruthy();
      expect(screen.getByText(/Vigente hasta/)).toBeTruthy();
      expect(screen.queryByText('Coberturas incluidas')).toBeNull();
      expect(screen.queryByText('Condiciones')).toBeNull();
      expect(screen.queryByText('Valor asegurado')).toBeNull();
      expect(screen.queryByText('Perfil aplicado')).toBeNull();
      expect(botonAceptar().disabled).toBe(false);
    });

    it('omite una cobertura o condición que no conoce en lugar de mostrar su código', async () => {
      const desconocida = oferta(OFERTA_NORMAL_DTO, {
        coberturas: [{ codigo: 'otra_cobertura', valorAsegurado: 1 }],
        condiciones: ['condicion_nueva'],
      });
      await renderizar({ detalle: () => of(desconocida) });

      expect(screen.queryByText(/otra_cobertura|condicion_nueva/)).toBeNull();
      expect(screen.queryByText('Coberturas incluidas')).toBeNull();
    });

    it('expresa el plazo en meses cuando no es un número exacto de años', async () => {
      await renderizar({ detalle: () => of(oferta(OFERTA_NORMAL_DTO, { plazoMeses: 18 })) });

      expect(screen.getByText('18 meses · igual al plazo del crédito')).toBeTruthy();
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
      expect(screen.getByRole('link', { name: 'Ver el estado de tu pago' }).getAttribute('href')).toBe(
        '/embebido/pago/b310b02b-9820-4725-bded-586d263dd16e',
      );
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
      expect(screen.getByText(/La oferta demo-active-1 y su prima de .*132\.000 COP/)).toBeTruthy();
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

  describe('oferta vencida: generar una nueva (E7 · HU-W1.2-03)', () => {
    const VENCIDA = (id = 'off-seedr1792338656') => of(oferta(OFERTA_VENCIDA_DTO, { id }));

    it('al abrir una vencida muestra E7 con la oferta anterior y su vencimiento, sin ofrecer aceptarla', async () => {
      await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });

      expect(titulo()).toBe('Esta oferta venció');
      expect(screen.getByText(/La oferta off-seedr1792338656 venció el .*2026/)).toBeTruthy();
      expect(screen.getByText(/132\.000 COP \/ mes/)).toBeTruthy();
      expect(screen.getByText('Vencida')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Aceptar oferta/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Generar una nueva oferta' })).toBeTruthy();
    });

    it('«Generar una nueva oferta» renueva la oferta y abre la nueva en esta misma página', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });
      navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const respuesta = new Subject<Oferta>();
      renovarOferta.mockReturnValue(respuesta);

      fireEvent.click(screen.getByRole('button', { name: 'Generar una nueva oferta' }));
      detectChanges();
      expect(renovarOferta).toHaveBeenCalledWith('off-seedr1792338656');
      expect((screen.getByRole('button', { name: /Generando tu nueva oferta/ }) as HTMLButtonElement).disabled).toBe(true);

      respuesta.next(oferta(OFERTA_NORMAL_DTO, { id: 'off-nueva' }));
      expect(navegar).toHaveBeenCalledWith(['/embebido/oferta', 'off-nueva'], { replaceUrl: true });
    });

    it('si la oferta ya se renovó ofrece ir a la renovada, sin volver a renovar', async () => {
      await renderizar({
        ofertaId: 'off-seedr1792338656',
        detalle: () => of(oferta(OFERTA_VENCIDA_DTO, { puedeRenovar: false, renovadaPor: 'off-renovada' })),
      });

      expect(screen.queryByRole('button', { name: 'Generar una nueva oferta' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Ver mi oferta renovada' }).getAttribute('href')).toBe(
        '/embebido/oferta/off-renovada',
      );
    });

    it('al retomar desde la sesión del navegador sigue sola la renovación', async () => {
      sessionStorage.setItem(CLAVE_TRAMITE_ACEPTACION, JSON.stringify({ ofertaId: 'off-vieja', aceptacionId: 'a-1' }));
      navegar = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);

      await renderizar({
        ofertaId: null,
        detalle: () => of(oferta(OFERTA_VENCIDA_DTO, { renovadaPor: 'off-renovada' })),
      });

      expect(navegar).toHaveBeenCalledWith(['/embebido/oferta', 'off-renovada'], { replaceUrl: true });
    });

    it('offer_still_valid vuelve a leer la oferta', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });
      renovarOferta.mockReturnValue(throwError(() => new ErrorOferta('offer_still_valid')));
      consultarOferta.mockReturnValue(of(oferta(OFERTA_NORMAL_DTO, { id: 'off-seedr1792338656' })));

      fireEvent.click(screen.getByRole('button', { name: 'Generar una nueva oferta' }));
      detectChanges();

      expect(consultarOferta).toHaveBeenCalledTimes(2);
      expect(titulo()).toBe('Tu oferta personalizada');
    });

    it('offer_superseded abre la oferta que la reemplazó', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });
      navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      renovarOferta.mockReturnValue(throwError(() => new ErrorOferta('offer_superseded', 'off-nueva')));

      fireEvent.click(screen.getByRole('button', { name: 'Generar una nueva oferta' }));
      detectChanges();

      expect(navegar).toHaveBeenCalledWith(['/embebido/oferta', 'off-nueva'], { replaceUrl: true });
    });

    it('consent_required lleva al paso de consentimiento', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });
      const irA = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      renovarOferta.mockReturnValue(throwError(() => new ErrorOferta('consent_required')));

      fireEvent.click(screen.getByRole('button', { name: 'Generar una nueva oferta' }));
      detectChanges();

      expect(irA).toHaveBeenCalledWith('/embebido/consentimiento');
    });

    it('validation_failed dice que ya no se puede renovar y retira la acción', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });
      renovarOferta.mockReturnValue(throwError(() => new ErrorOferta('validation_failed')));

      fireEvent.click(screen.getByRole('button', { name: 'Generar una nueva oferta' }));
      detectChanges();

      expect(screen.getByText('Ya no puedes renovar esta oferta')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Generar una nueva oferta' })).toBeNull();
    });

    it.each([
      ['consent_unverifiable', 'No pudimos generar tu nueva oferta', 'Intenta de nuevo en unos minutos'],
      ['offer_unavailable', 'No pudimos generar tu nueva oferta', 'Intenta de nuevo en unos minutos'],
    ] as const)('%s permite reintentar', async (codigo, titulo, texto) => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656', detalle: () => VENCIDA() });
      renovarOferta.mockReturnValue(throwError(() => new ErrorOferta(codigo)));

      fireEvent.click(screen.getByRole('button', { name: 'Generar una nueva oferta' }));
      detectChanges();

      expect(screen.getByText(titulo)).toBeTruthy();
      expect(screen.getByText(new RegExp(texto))).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Generar una nueva oferta' })).toBeTruthy();
    });
  });

  describe('oferta reemplazada (CA-4 · HU-W1.2-03)', () => {
    const NUEVA = oferta(OFERTA_NORMAL_DTO, { id: 'off-7618b94e3329fa1b05c7d6b5f4ab2297', primaMensual: 135_400 });

    function detalleReemplazo(id: string): Observable<Oferta> {
      return of(id === OFERTA_REEMPLAZADA_DTO.offer_id ? oferta(OFERTA_REEMPLAZADA_DTO) : NUEVA);
    }

    it('al cargar una reemplazada avisa que se actualizó, con la prima anterior y la nueva', async () => {
      await renderizar({ ofertaId: OFERTA_REEMPLAZADA_DTO.offer_id, detalle: detalleReemplazo });

      expect(titulo()).toBe('Tu oferta se actualizó con tu perfil real');
      expect(screen.getByText('Reemplazada')).toBeTruthy();
      expect(screen.getByText(/135\.400 COP · antes .*147\.400 COP/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Ver mi oferta actualizada' }).getAttribute('href')).toBe(
        '/embebido/oferta/off-7618b94e3329fa1b05c7d6b5f4ab2297',
      );
      expect(consultarDeOferta).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /Aceptar oferta/ })).toBeNull();
    });

    it('mantiene el aviso y el enlace aunque no se pueda leer la oferta nueva', async () => {
      await renderizar({
        ofertaId: OFERTA_REEMPLAZADA_DTO.offer_id,
        detalle: (id) =>
          id === OFERTA_REEMPLAZADA_DTO.offer_id
            ? of(oferta(OFERTA_REEMPLAZADA_DTO))
            : throwError(() => new ErrorOferta('offer_unavailable')),
      });

      expect(titulo()).toBe('Tu oferta se actualizó con tu perfil real');
      expect(screen.queryByText('Nueva prima mensual')).toBeNull();
      expect(screen.getByRole('link', { name: 'Ver mi oferta actualizada' })).toBeTruthy();
    });

    it('al aceptar una reemplazada (422 offer_expired) consulta la oferta y muestra el aviso', async () => {
      const { detectChanges } = await renderizar({
        ofertaId: OFERTA_REEMPLAZADA_DTO.offer_id,
        detalle: (id) => of(oferta(OFERTA_NORMAL_DTO, { id })),
      });
      aceptar.mockReturnValue(throwError(() => new ErrorAceptacion('offer_expired', '2026-10-18T15:53:02.442028Z')));
      consultarOferta.mockImplementation(detalleReemplazo);
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(consultarOferta).toHaveBeenLastCalledWith(NUEVA.id);
      expect(titulo()).toBe('Tu oferta se actualizó con tu perfil real');
      expect(screen.getByRole('link', { name: 'Ver mi oferta actualizada' })).toBeTruthy();
    });

    it('al aceptar una vencida (422 offer_expired) que no fue reemplazada muestra E7', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'off-seedr1792338656' });
      aceptar.mockReturnValue(throwError(() => new ErrorAceptacion('offer_expired', '2026-10-17T15:53:06Z')));
      consultarOferta.mockReturnValue(of(oferta(OFERTA_VENCIDA_DTO)));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(titulo()).toBe('Esta oferta venció');
      expect(screen.getByRole('button', { name: 'Generar una nueva oferta' })).toBeTruthy();
    });

    it('si no puede leer la oferta tras offer_expired informa que venció', async () => {
      const { detectChanges } = await renderizar();
      aceptar.mockReturnValue(throwError(() => new ErrorAceptacion('offer_expired')));
      consultarOferta.mockReturnValue(throwError(() => new ErrorOferta('offer_unavailable')));
      marcarTerminos();

      fireEvent.click(botonAceptar());
      detectChanges();

      expect(titulo()).toBe('Esta oferta venció');
    });

    it('al retomar desde la sesión del navegador sigue sola el enlace del reemplazo', async () => {
      sessionStorage.setItem(
        CLAVE_TRAMITE_ACEPTACION,
        JSON.stringify({ ofertaId: OFERTA_REEMPLAZADA_DTO.offer_id, aceptacionId: 'a-1' }),
      );
      navegar = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);

      await renderizar({ ofertaId: null, detalle: detalleReemplazo });

      expect(navegar).toHaveBeenCalledWith(['/embebido/oferta', NUEVA.id], { replaceUrl: true });
    });
  });

  describe('lectura de la oferta (HU-W1.2-03)', () => {
    it.each([
      ['offer_not_found', 'Esta oferta no existe o ya no está disponible'],
      ['invalid_request', 'Esta oferta no existe o ya no está disponible'],
      ['offer_unavailable', 'No pudimos consultar tu trámite'],
    ] as const)('%s muestra su estado de error', async (codigo, esperado) => {
      await renderizar({ detalle: () => throwError(() => new ErrorOferta(codigo)) });

      expect(titulo()).toBe(esperado);
      expect(consultarDeOferta).not.toHaveBeenCalled();
    });

    it('con un 401 o 403 no muestra un error propio: el interceptor lleva a la pantalla de acceso', async () => {
      await renderizar({ detalle: () => throwError(() => new ErrorOferta('forbidden')) });

      expect(titulo()).toBe('Estamos consultando tu oferta');
    });

    it('un error inesperado se registra en el manejador global y muestra el error genérico', async () => {
      const error = new ErrorOferta('validation_failed');
      await renderizar({ detalle: () => throwError(() => error) });

      expect(manejador.handleError).toHaveBeenCalledWith(error);
      expect(titulo()).toBe('No pudimos procesar tu solicitud');
    });

    it('«Reintentar» vuelve a leer la oferta', async () => {
      const { detectChanges } = await renderizar({ detalle: () => throwError(() => new ErrorOferta('offer_unavailable')) });
      consultarOferta.mockReturnValue(of(oferta()));

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      detectChanges();

      expect(titulo()).toBe('Tu oferta personalizada');
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

  describe('decisión del asesor (E6b, E6c · HU-W1.1-02)', () => {
    const DECIDIDA_EN = '2026-10-17T04:42:20.022742Z';
    const AJUSTADA = aceptacion({
      ofertaId: 'demo-review-1',
      estado: 'adjusted',
      suscripcion: { resultado: 'human_review', motivo: 'provisional_offer', decididaEn: '2026-10-12T01:54:42Z' },
      revision: {
        resultado: 'adjust',
        decididaEn: DECIDIDA_EN,
        ofertaAjustada: {
          ofertaId: 'adj-b310b02b-9820-4725-bded-586d263dd16e',
          prima: 98_450,
          moneda: 'COP',
          venceEn: '2026-10-18T04:42:20.022742Z',
        },
      },
    });
    const RECHAZADA = aceptacion({
      ofertaId: 'demo-highrisk-1',
      estado: 'rejected',
      suscripcion: { resultado: 'human_review', motivo: 'high_risk_score', decididaEn: '2026-10-12T01:54:42Z' },
      revision: { resultado: 'reject', decididaEn: DECIDIDA_EN, ofertaAjustada: null },
    });

    function pasoActual(): string {
      return document.querySelector('[aria-current="step"]')?.textContent?.trim() ?? '';
    }

    it('E6b: muestra la nueva prima, la vigencia de 24 h, que no hay cobro y «Ver la nueva oferta»', async () => {
      await renderizar({ ofertaId: 'demo-review-1', deOferta: of(AJUSTADA) });

      expect(titulo()).toBe('Un asesor ajustó las condiciones de tu oferta');
      expect(screen.getByText(/revisó tu solicitud el .* y ajustó la prima\. Tu aceptación anterior no se cobra/)).toBeTruthy();
      expect(screen.getByText(/También te lo enviamos a tu correo\./)).toBeTruthy();
      expect(screen.getByText('Ajustada')).toBeTruthy();
      expect(screen.getByText(AJUSTADA.aceptacionId)).toBeTruthy();
      expect(screen.getByText(/98\.450 COP · antes .*132\.000 COP/)).toBeTruthy();
      expect(screen.getByText(/^Hasta el .* \(24 horas\)$/)).toBeTruthy();
      expect(screen.getByText('Aún no se ha hecho ningún cobro')).toBeTruthy();
      expect(screen.getByText('La nueva oferta reemplaza a demo-review-1. Solo se cobrará la prima cuando aceptes la nueva oferta.')).toBeTruthy();
      expect(screen.queryByText('Aceptación')).toBeNull();
      expect(screen.getByRole('link', { name: 'Continuar con mi crédito' }).getAttribute('href')).toBe('/inicio');
      expect(screen.getByRole('link', { name: 'Ver la nueva oferta' }).getAttribute('href')).toBe(
        '/embebido/oferta/adj-b310b02b-9820-4725-bded-586d263dd16e',
      );
      expect(pasoActual()).toContain('Oferta');
    });

    it('E6c: informa que el riesgo no fue aceptado, sin cobro, y cierra la solicitud', async () => {
      await renderizar({ ofertaId: 'demo-highrisk-1', deOferta: of(RECHAZADA) });

      expect(titulo()).toBe('No pudimos aceptar tu solicitud de seguro');
      expect(screen.getByText(/revisó tu solicitud el .* y el riesgo no fue aceptado\. No se realizó ningún cobro/)).toBeTruthy();
      expect(screen.getByText(/También te lo enviamos a tu correo\./)).toBeTruthy();
      expect(screen.getByText('Rechazada')).toBeTruthy();
      expect(screen.getByText('Riesgo no aceptado por el asesor')).toBeTruthy();
      expect(screen.getByText('Fecha de la decisión')).toBeTruthy();
      expect(screen.getByText('No se realizó ningún cobro')).toBeTruthy();
      expect(screen.getByText(`Tu solicitud ${RECHAZADA.aceptacionId} quedó cerrada. Si tienes preguntas, comunícate con tu banco o con Solventa.`)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Continuar con mi crédito' }).getAttribute('href')).toBe('/inicio');
      expect(screen.queryByRole('link', { name: 'Ver la nueva oferta' })).toBeNull();
      expect(pasoActual()).toContain('Pago');
    });

    it('«Ver estado de la solicitud» desde la revisión muestra la decisión del asesor', async () => {
      await renderizar({ ofertaId: 'demo-review-1', deOferta: of(EN_REVISION) });
      consultarDeOferta.mockReturnValue(of(AJUSTADA));

      fireEvent.click(screen.getByRole('button', { name: 'Ver estado de la solicitud' }));

      expect(titulo()).toBe('Un asesor ajustó las condiciones de tu oferta');
    });

    it('al abrir la nueva oferta, la misma página la muestra con «Aceptar» y los términos sin marcar', async () => {
      const { detectChanges } = await renderizar({ ofertaId: 'demo-review-1', deOferta: of(AJUSTADA) });
      consultarDeOferta.mockReturnValue(NO_ACEPTADA());

      parametros.next(convertToParamMap({ ofertaId: 'adj-b310b02b-9820-4725-bded-586d263dd16e' }));
      detectChanges();

      expect(consultarDeOferta).toHaveBeenLastCalledWith('adj-b310b02b-9820-4725-bded-586d263dd16e');
      expect(titulo()).toBe('Tu oferta personalizada');
      expect(consultarOferta).toHaveBeenLastCalledWith('adj-b310b02b-9820-4725-bded-586d263dd16e');
      expect(screen.getByText(/Oferta N\.º adj-b310b02b-9820-4725-bded-586d263dd16e/)).toBeTruthy();
      expect((screen.getByRole('checkbox', { name: /Acepto las condiciones generales/ }) as HTMLInputElement).checked).toBe(false);
      expect(botonAceptar().disabled).toBe(false);
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
