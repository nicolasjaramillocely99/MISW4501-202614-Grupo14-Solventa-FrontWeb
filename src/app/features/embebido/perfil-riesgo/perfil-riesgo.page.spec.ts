import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  PerfilRiesgo,
  SolicitudPerfilRiesgo,
} from '@core/api/originacion/perfil-riesgo.modelos';

import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';
import { PerfilRiesgoPage } from './perfil-riesgo.page';

const PERFIL_COMPLETO: PerfilRiesgo = {
  clienteId: 'cli-1',
  modo: 'normal',
  origen: 'external_sources',
  puntaje: 700,
  categoria: 'B',
  fechaPerfil: '2026-10-11T12:00:00Z',
  fuenteNoDisponible: null,
  aviso: null,
  parcial: false,
  fuentes: [
    { nombre: 'open_finance', estado: 'ok', latenciaMs: 180 },
    { nombre: 'open_data', estado: 'ok', latenciaMs: 95 },
    { nombre: 'kyc', estado: 'ok', latenciaMs: 60 },
  ],
};

describe('PerfilRiesgoPage (E2 / E2b · HU-W1.2-02)', () => {
  let resolver: ReturnType<typeof vi.fn<(s: SolicitudPerfilRiesgo) => Observable<PerfilRiesgo>>>;

  async function renderizar(
    respuesta: Observable<PerfilRiesgo>,
    { consentimiento = 'true', solicitud = false } = {},
  ) {
    resolver = vi.fn().mockReturnValue(respuesta);
    const resultado = await render(PerfilRiesgoPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: { resolverPerfilRiesgo: resolver } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: { clienteId: 'cli-1' },
              queryParamMap: { get: (k: string) => (k === 'consentimiento' ? consentimiento : null) },
            },
          },
        },
      ],
      configureTestBed: (bed) => {
        if (solicitud) {
          bed.inject(FlujoEmbebidoService).solicitud.set({
            numero: '48213',
            aliado: 'Banco Aliado',
            banco: 'Banco Aliado',
            montoAprobado: 250000000,
            plazoAnios: 20,
            cuotaEstimada: 2180000,
            moneda: 'COP',
          });
        }
      },
    });
    return resultado;
  }

  describe('mientras calcula (E2)', () => {
    it('pide el perfil con el cliente de la ruta y el consentimiento afirmado', async () => {
      await renderizar(new Subject<PerfilRiesgo>());

      expect(resolver).toHaveBeenCalledWith({ clienteId: 'cli-1', consentimientoActivo: true });
    });

    it('sin consentimiento en la URL lo envía como inactivo', async () => {
      await renderizar(new Subject<PerfilRiesgo>(), { consentimiento: 'false' });

      expect(resolver).toHaveBeenCalledWith({ clienteId: 'cli-1', consentimientoActivo: false });
    });

    it('muestra el título, las fuentes en curso, el aviso informativo y el botón deshabilitado', async () => {
      await renderizar(new Subject<PerfilRiesgo>());

      expect(screen.getByRole('heading', { level: 1, name: 'Estamos calculando tu perfil de riesgo' })).toBeTruthy();
      expect(screen.getByText('Open Finance')).toBeTruthy();
      expect(screen.getByText('Open Data')).toBeTruthy();
      expect(screen.getByText('Validación de identidad (KYC)')).toBeTruthy();
      expect(screen.getAllByText('En curso')).toHaveLength(4);
      expect(screen.getByText('Si una fuente no responde')).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Calculando…' }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
    });

    it('marca el paso 2 como actual y el 1 como completado', async () => {
      const { container } = await renderizar(new Subject<PerfilRiesgo>());

      expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Perfil de riesgo');
      expect(screen.getByRole('list', { name: 'Pasos de la solicitud' }).textContent).toContain(
        'Consentimiento · completado',
      );
    });
  });

  describe('con el perfil resuelto (E2b)', () => {
    it('muestra el estado y la latencia de cada fuente, el aviso de éxito y «Ver mi oferta»', async () => {
      await renderizar(of(PERFIL_COMPLETO));

      expect(screen.getByRole('heading', { level: 1, name: 'Tu oferta está lista' })).toBeTruthy();
      expect(screen.getByText('Consultado · 180 ms')).toBeTruthy();
      expect(screen.getByText('Consultado · 95 ms')).toBeTruthy();
      expect(screen.getByText('Consultado · 60 ms')).toBeTruthy();
      expect(screen.getByText('Reglas aplicadas')).toBeTruthy();
      expect(screen.getByText(/Nada se envía ni se cobra/)).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Ver mi oferta' }).getAttribute('href')).toBe('/embebido/oferta');
      expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/embebido/consentimiento');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    });

    it('publica el perfil para que la oferta lo consuma', async () => {
      await renderizar(of(PERFIL_COMPLETO));

      expect(TestBed.inject(FlujoEmbebidoService).perfil()).toEqual(PERFIL_COMPLETO);
    });

    it('identifica la fuente que no respondió sin abortar el flujo (parcial)', async () => {
      await renderizar(
        of({
          ...PERFIL_COMPLETO,
          parcial: true,
          fuentes: [
            { nombre: 'open_finance', estado: 'ok', latenciaMs: 90 },
            { nombre: 'open_data', estado: 'timeout', latenciaMs: 120 },
            { nombre: 'kyc', estado: 'circuit_open', latenciaMs: 0 },
          ],
        }),
      );

      expect(screen.getByText('No respondió a tiempo · 120 ms')).toBeTruthy();
      expect(screen.getByText('Sin respuesta')).toBeTruthy();
      expect(screen.getByText('Aislada temporalmente; no se consultó')).toBeTruthy();
      expect(screen.getByText('No disponible')).toBeTruthy();
      expect(screen.getByText('Calculamos tu perfil con las fuentes que respondieron')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Ver mi oferta' })).toBeTruthy();
    });

    it('muestra la fuente con falla', async () => {
      await renderizar(
        of({
          ...PERFIL_COMPLETO,
          parcial: true,
          fuentes: [{ nombre: 'open_data', estado: 'error', latenciaMs: 40 }],
        }),
      );

      expect(screen.getByText('Con falla')).toBeTruthy();
      expect(screen.getByText('No pudimos consultarla · 40 ms')).toBeTruthy();
    });

    it('continúa con el último perfil en caché indicando la fuente afectada y la fecha', async () => {
      await renderizar(
        of({
          ...PERFIL_COMPLETO,
          modo: 'provisional',
          origen: 'cache',
          fuenteNoDisponible: 'open_finance',
          aviso: 'last_profile_in_use',
          fuentes: [{ nombre: 'open_finance', estado: 'timeout', latenciaMs: 120 }],
        }),
      );

      expect(screen.getByText('Continuamos con tu último perfil')).toBeTruthy();
      expect(screen.getByText(/No pudimos consultar Open Finance en este momento/)).toBeTruthy();
      expect(screen.getByText(/calculado el 11 de octubre de 2026/)).toBeTruthy();
    });

    it('avisa del perfil base para un cliente sin perfil previo', async () => {
      await renderizar(
        of({
          ...PERFIL_COMPLETO,
          modo: 'provisional',
          origen: 'base_actuarial',
          fechaPerfil: null,
          fuenteNoDisponible: 'open_finance',
          aviso: 'personalization_unavailable',
          fuentes: [],
        }),
      );

      expect(screen.getByText('Usamos el perfil base')).toBeTruthy();
      expect(screen.getByText('Perfil actuarial base')).toBeTruthy();
      expect(screen.getByText('Provisional')).toBeTruthy();
    });

    it('explica que un perfil vigente se reutilizó sin consultar fuentes externas', async () => {
      await renderizar(
        of({ ...PERFIL_COMPLETO, origen: 'cache', fuentes: [] }),
      );

      expect(screen.getByText('Perfil de riesgo vigente')).toBeTruthy();
      expect(screen.getByText(/no se consultaron fuentes externas/)).toBeTruthy();
    });
  });

  describe('con error', () => {
    it('sin consentimiento (422) lleva de vuelta al consentimiento y no ofrece reintentar', async () => {
      await renderizar(
        throwError(() => new HttpErrorResponse({ status: 422 })),
        { consentimiento: 'false' },
      );

      expect(screen.getByRole('alert').textContent).toContain('Necesitamos tu consentimiento');
      expect(screen.getByRole('link', { name: 'Volver al consentimiento' }).getAttribute('href')).toBe(
        '/embebido/consentimiento',
      );
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('ante otro error muestra el estado de error y permite reintentar', async () => {
      await renderizar(throwError(() => new HttpErrorResponse({ status: 503 })));

      expect(screen.getByRole('alert').textContent).toContain('No pudimos calcular tu perfil');
      expect(TestBed.inject(FlujoEmbebidoService).perfil()).toBeNull();

      resolver.mockReturnValue(of(PERFIL_COMPLETO));
      await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(resolver).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { level: 1, name: 'Tu oferta está lista' })).toBeTruthy();
    });
  });

  describe('tarjeta «Tu crédito»', () => {
    it('se muestra con los datos del flujo, con moneda y plazo formateados', async () => {
      await renderizar(of(PERFIL_COMPLETO), { solicitud: true });

      expect(screen.getByText('Crédito de vivienda · Solicitud N.º 48213 · Seguro de vida hipotecario')).toBeTruthy();
      const tarjeta = screen.getByRole('region', { name: 'Tu crédito' });
      expect(within(tarjeta).getByText('20 años')).toBeTruthy();
      expect(within(tarjeta).getByText(/250\.000\.000\s*COP/)).toBeTruthy();
      expect(within(tarjeta).getByText(/2\.180\.000\s*COP\s*\/ mes/)).toBeTruthy();
    });

    it('publica el aliado de la solicitud para la barra del shell', async () => {
      await renderizar(of(PERFIL_COMPLETO), { solicitud: true });

      expect(TestBed.inject(ContextoAliadoService).nombre()).toBe('Banco Aliado');
    });

    it('se oculta mientras el flujo no entregue la solicitud', async () => {
      await renderizar(of(PERFIL_COMPLETO));

      expect(screen.queryByRole('region', { name: 'Tu crédito' })).toBeNull();
      expect(screen.getByText('Crédito de vivienda · Seguro de vida hipotecario')).toBeTruthy();
    });
  });
});
