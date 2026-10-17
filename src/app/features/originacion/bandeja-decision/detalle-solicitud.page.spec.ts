import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SOLICITUD_AJUSTADA_DTO, SOLICITUD_PENDIENTE_DTO, SOLICITUD_RECHAZADA_DTO } from '@testing/revision-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CodigoErrorRevision,
  ErrorRevision,
  RegistroDecision,
  SolicitudRevision,
  mapearSolicitudRevision,
} from '@core/api/originacion/revision.modelos';

import { DetalleSolicitudPage } from './detalle-solicitud.page';
import { AvisoDecisionService } from './servicios/aviso-decision.service';

const PENDIENTE = mapearSolicitudRevision(SOLICITUD_PENDIENTE_DTO);
const AJUSTADA = mapearSolicitudRevision(SOLICITUD_AJUSTADA_DTO);
const RECHAZADA = mapearSolicitudRevision(SOLICITUD_RECHAZADA_DTO);

const falla = (codigo: CodigoErrorRevision) => throwError(() => new ErrorRevision(codigo));

describe('DetalleSolicitudPage (S5 · HU-W1.1-02)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<SolicitudRevision>>>;
  let registrarDecision: ReturnType<typeof vi.fn<(id: string, r: RegistroDecision) => Observable<SolicitudRevision>>>;
  let avisos: AvisoDecisionService;

  async function renderizar(
    consultas: Observable<SolicitudRevision>[],
    registros: Observable<SolicitudRevision>[] = [],
  ) {
    consultar = vi.fn();
    for (const c of consultas) {
      consultar.mockReturnValueOnce(c);
    }
    registrarDecision = vi.fn();
    for (const r of registros) {
      registrarDecision.mockReturnValueOnce(r);
    }
    avisos = new AvisoDecisionService();
    const vista = await render(DetalleSolicitudPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: { consultarSolicitudRevision: consultar, registrarDecision } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['aceptacionId', PENDIENTE.aceptacionId]]) } } },
        { provide: AvisoDecisionService, useValue: avisos },
      ],
    });
    const navegar = vi.spyOn(vista.fixture.debugElement.injector.get(Router), 'navigate').mockResolvedValue(true);
    return { ...vista, navegar };
  }

  async function rechazar(observaciones = 'Riesgo fuera de política') {
    await userEvent.click(screen.getByRole('radio', { name: /Rechazar/ }));
    await userEvent.type(screen.getByLabelText('Observaciones'), observaciones);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));
  }

  it('consulta la solicitud de la ruta y mientras tanto informa que carga', async () => {
    await renderizar([new Subject<SolicitudRevision>()]);

    expect(consultar).toHaveBeenCalledWith(PENDIENTE.aceptacionId);
    expect(screen.getByRole('status').textContent).toContain('Cargando la solicitud');
    expect(screen.getByRole('link', { name: 'Bandeja de decisión' }).getAttribute('href')).toBe('/originacion/bandeja-decision');
  });

  it('muestra el caso pendiente: número, estado, solicitante, oferta, motivo y el bloque de decisión (CA-1)', async () => {
    await renderizar([of(PENDIENTE)]);

    expect(screen.getByRole('heading', { level: 1, name: `Solicitud ${PENDIENTE.aceptacionId}` })).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText(/Carolina Pérez Ruiz · CC 1020345678 · llegó el .* · Oferta demo-review-1792212135/)).toBeTruthy();
    expect(screen.getByText('Motivo del enrutamiento: Perfil provisional (fuente caída)')).toBeTruthy();
    expect(screen.getByText(/La oferta se calculó en modo provisional/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Solicitante' })).toBeTruthy();
    expect(screen.getByText('carolina@example.com')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Oferta implicada' })).toBeTruthy();
    expect(screen.getByText(/89\.500 COP/)).toBeTruthy();
    expect(screen.getByText('Provisional (fuente externa caída)')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Decisión' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Al registrar la decisión' })).toBeTruthy();
  });

  it('un motivo desconocido muestra el texto genérico', async () => {
    await renderizar([of({ ...PENDIENTE, motivo: 'motivo_nuevo', oferta: { ...PENDIENTE.oferta, modo: null, venceEn: null } })]);

    expect(screen.getByText('Motivo del enrutamiento: Validación adicional de suscripción')).toBeTruthy();
    expect(screen.queryByText('Vigencia de la oferta')).toBeNull();
  });

  it('al registrar vuelve a la bandeja con el aviso «Decisión registrada» (CA-3, S4b)', async () => {
    const { navegar } = await renderizar([of(PENDIENTE)], [of(RECHAZADA)]);

    await rechazar();

    expect(registrarDecision).toHaveBeenCalledWith(PENDIENTE.aceptacionId, {
      tipo: 'reject',
      observaciones: 'Riesgo fuera de política',
    });
    expect(navegar).toHaveBeenCalledWith(['/originacion/bandeja-decision']);
    expect(avisos.consumir()).toEqual({ aceptacionId: RECHAZADA.aceptacionId, solicitante: 'Carolina Pérez Ruiz', tipo: 'reject' });
  });

  it('un caso decidido se ve en solo lectura con el registro completo (CA-4)', async () => {
    await renderizar([of(AJUSTADA)]);

    expect(screen.getByText('Decidida')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Decisión' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Al registrar la decisión' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Decisión registrada' })).toBeTruthy();
    expect(screen.getByText('Ajustada')).toBeTruthy();
    expect(screen.getByText('asesor@example.com')).toBeTruthy();
    expect(screen.getByText('10 %')).toBeTruthy();
    expect(screen.getByText('adj-6af8ce61-2424-4ed2-8375-57eaf9f9ee67')).toBeTruthy();
    expect(screen.getByText(/98\.450 COP/)).toBeTruthy();
    expect(screen.getByText('Ingreso declarado sin verificar')).toBeTruthy();
  });

  it('una aceptación sin observaciones lo dice', async () => {
    await renderizar([of({ ...RECHAZADA, decision: { ...RECHAZADA.decision!, tipo: 'accept', observaciones: '' } })]);

    expect(screen.getByText('Aceptada')).toBeTruthy();
    expect(screen.getByText('Sin observaciones')).toBeTruthy();
  });

  it('409: otro asesor se adelantó, recarga y muestra lo decidido', async () => {
    await renderizar([of(PENDIENTE), of(RECHAZADA)], [falla('review_request_already_decided')]);

    await rechazar();

    expect(consultar).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Otro asesor ya registró la decisión/)).toBeTruthy();
    expect(screen.getByText('Rechazada')).toBeTruthy();
  });

  it('400 por campo: marca las observaciones o el porcentaje', async () => {
    await renderizar([of(PENDIENTE)], [falla('observations_required')]);

    await rechazar();

    expect(screen.getByText('Escribe las observaciones: son obligatorias al ajustar o rechazar.')).toBeTruthy();
  });

  it('400 del porcentaje lo marca en «Ajuste de prima (%)»', async () => {
    await renderizar([of(PENDIENTE)], [falla('premium_adjustment_invalid')]);

    await userEvent.click(screen.getByRole('radio', { name: /Ajustar/ }));
    await userEvent.type(screen.getByLabelText('Ajuste de prima (%)'), '10');
    await userEvent.type(screen.getByLabelText('Observaciones'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));

    expect(screen.getByText('El recargo debe ser mayor que 0 y hasta 100, con máximo dos decimales.')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Ajuste de prima (%)'));
    await userEvent.type(screen.getByLabelText('Ajuste de prima (%)'), '5');
    expect(screen.queryByText('El recargo debe ser mayor que 0 y hasta 100, con máximo dos decimales.')).toBeNull();
  });

  it.each(['decision_not_registered', 'decision_continuation_pending', 'review_unavailable'] as const)(
    '503 %s: muestra el error y reintenta el mismo registro',
    async (codigo) => {
      const { navegar } = await renderizar([of(PENDIENTE)], [falla(codigo), of(RECHAZADA)]);

      await rechazar();
      expect(screen.getByRole('alert').textContent).toContain('No pudimos registrar la decisión');

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(registrarDecision).toHaveBeenCalledTimes(2);
      expect(registrarDecision.mock.calls[1]).toEqual(registrarDecision.mock.calls[0]);
      expect(navegar).toHaveBeenCalledWith(['/originacion/bandeja-decision']);
    },
  );

  it('un error inesperado al registrar se muestra sin reintento', async () => {
    await renderizar([of(PENDIENTE)], [falla('invalid_request')]);

    await rechazar();

    expect(screen.getByRole('alert').textContent).toContain('Ocurrió un error inesperado');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('401 o 403 al registrar no muestran nada (los resuelve el interceptor)', async () => {
    await renderizar([of(PENDIENTE)], [falla('forbidden')]);

    await rechazar();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('404 al registrar muestra que la solicitud no existe', async () => {
    await renderizar([of(PENDIENTE)], [falla('review_request_not_found')]);

    await rechazar();

    expect(screen.getByRole('heading', { level: 1, name: 'La solicitud no existe' })).toBeTruthy();
  });

  it('404 al consultar muestra que la solicitud no existe', async () => {
    await renderizar([falla('review_request_not_found')]);

    expect(screen.getByRole('heading', { level: 1, name: 'La solicitud no existe' })).toBeTruthy();
  });

  it('503 al consultar muestra el error y reintenta', async () => {
    await renderizar([falla('review_unavailable'), of(PENDIENTE)]);

    expect(screen.getByRole('alert').textContent).toContain('Intenta de nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('heading', { level: 1, name: `Solicitud ${PENDIENTE.aceptacionId}` })).toBeTruthy();
  });

  it('401 al consultar no muestra error (lo resuelve el interceptor)', async () => {
    await renderizar([falla('unauthorized')]);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Cargando la solicitud');
  });
});
