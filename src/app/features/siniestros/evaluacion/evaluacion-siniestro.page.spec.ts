import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  APROBACION_EN_CURSO_DTO,
  APROBACION_EN_EXCEPCION_DTO,
  APROBACION_PAGADA_DTO,
  EVALUACION_DTO,
  ID_EVALUADO,
  RECHAZO_DTO,
  evaluacionCon,
} from '@testing/evaluacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  Decision,
  ErrorEvaluacion,
  Evaluacion,
  EvaluacionDto,
  mapearDecision,
  mapearEvaluacion,
} from '@core/api/siniestros/evaluacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { EvaluacionSiniestroPage, INTERVALO_SEGUIMIENTO_MS } from './evaluacion-siniestro.page';

describe('EvaluacionSiniestroPage (O6 y O6b · HU-W2.2-03)', () => {
  let api: {
    consultarEvaluacion: ReturnType<typeof vi.fn<(id: string) => Observable<Evaluacion>>>;
    aprobar: ReturnType<typeof vi.fn<(id: string, bruto: number) => Observable<Decision>>>;
    rechazar: ReturnType<typeof vi.fn<(id: string, motivo: string) => Observable<Decision>>>;
    reintentarPago: ReturnType<typeof vi.fn>;
  };

  async function renderizar(detalle: EvaluacionDto | Observable<Evaluacion> = EVALUACION_DTO) {
    api = {
      consultarEvaluacion: vi.fn().mockReturnValue('subscribe' in detalle ? detalle : of(mapearEvaluacion(detalle))),
      aprobar: vi.fn().mockReturnValue(of(mapearDecision(APROBACION_EN_CURSO_DTO))),
      rechazar: vi.fn().mockReturnValue(of(mapearDecision(RECHAZO_DTO))),
      reintentarPago: vi.fn().mockReturnValue(of(mapearDecision(APROBACION_EN_CURSO_DTO))),
    };
    const resultado = await render(EvaluacionSiniestroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: ID_EVALUADO }) } } },
      ],
    });
    return { usuario: userEvent.setup(), resultado };
  }

  const leerCon = (dto: EvaluacionDto) => api.consultarEvaluacion.mockReturnValue(of(mapearEvaluacion(dto)));

  afterEach(() => vi.useRealTimers());

  it('muestra el caso, la cobertura, los soportes y el asegurado con la cuenta enmascarada (CA-1)', async () => {
    await renderizar();

    expect(api.consultarEvaluacion).toHaveBeenCalledWith(ID_EVALUADO);
    expect(screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01655' })).toBeTruthy();
    expect(screen.getAllByText('Triage 2').length).toBeGreaterThan(0);
    expect(screen.getByText('Daño por agua · deducible 5 %')).toBeTruthy();
    expect(screen.getByText(/Carolina Pérez Ruiz · \+57/)).toBeTruthy();
    expect(screen.getByText(/•••• 4512/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'techo.jpg' }).getAttribute('href')).toBe('https://firmada/sup-1');
    expect(screen.getByText('Ubicación no confiable')).toBeTruthy();
    expect(screen.getAllByText(/320\.000\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Triage 2 asignado · automático/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Prioridad' })).toBeTruthy();
  });

  it('precarga el costo con el monto estimado y muestra el desglose: el asegurado asume el deducible (CA-2)', async () => {
    const { usuario } = await renderizar();

    const bruto = screen.getByLabelText('Costo de reparación aprobado (antes del deducible)') as HTMLInputElement;
    expect(bruto.value).toBe('4350000');
    const desglose = within(screen.getByText('Monto aprobado (neto a pagar por la aseguradora)').closest('dl')!);
    expect(desglose.getByText(/217\.500/)).toBeTruthy();
    expect(desglose.getByText(/4\.132\.500/)).toBeTruthy();
    expect(screen.getByText(/Incluye aplicación de deducible del 5 %/)).toBeTruthy();

    leerCon(evaluacionCon(APROBACION_PAGADA_DTO));
    await usuario.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));

    expect(api.aprobar).toHaveBeenCalledWith(ID_EVALUADO, 4_350_000);
    expect(screen.getByText(/Indemnización pagada:/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aprobar y pagar' })).toBeNull();
  });

  it('no deja aprobar más que el valor asegurado ni un costo vacío', async () => {
    const { usuario } = await renderizar();
    const bruto = screen.getByLabelText('Costo de reparación aprobado (antes del deducible)');

    await usuario.clear(bruto);
    await usuario.type(bruto, '320000001');
    await usuario.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));
    expect(screen.getByText(/Supera el valor asegurado/)).toBeTruthy();

    await usuario.clear(bruto);
    await usuario.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));
    expect(screen.getByText('Escribe un costo mayor que cero.')).toBeTruthy();
    expect(api.aprobar).not.toHaveBeenCalled();
  });

  it('muestra en el campo el rechazo del servidor y lo limpia al editar', async () => {
    const { usuario } = await renderizar();
    api.aprobar.mockReturnValue(throwError(() => new ErrorEvaluacion('nothing_to_pay')));

    await usuario.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));
    expect(screen.getByText('Después del deducible no queda nada por pagar.')).toBeTruthy();

    await usuario.type(screen.getByLabelText('Costo de reparación aprobado (antes del deducible)'), '1');
    expect(screen.queryByText('Después del deducible no queda nada por pagar.')).toBeNull();
  });

  it('rechaza con motivo obligatorio y muestra el rechazo notificado (CA-3 y CA-5)', async () => {
    const { usuario } = await renderizar();

    await usuario.click(screen.getByRole('radio', { name: /Rechazar/ }));
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.getByText('El motivo es obligatorio.')).toBeTruthy();
    expect(api.rechazar).not.toHaveBeenCalled();

    leerCon(evaluacionCon(RECHAZO_DTO));
    await usuario.type(screen.getByLabelText('Motivo del rechazo'), '  La póliza excluye los daños.  ');
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(api.rechazar).toHaveBeenCalledWith(ID_EVALUADO, 'La póliza excluye los daños.');
    expect(screen.getByRole('heading', { name: 'Rechazo' })).toBeTruthy();
    expect(screen.getByText('La póliza excluye los daños por falta de mantenimiento.')).toBeTruthy();
    expect(screen.getByText('Rechazado por analista@solventa.example')).toBeTruthy();
    expect(screen.getByText('Rechazo notificado al asegurado')).toBeTruthy();
  });

  it('sin núcleo de pólizas el caso se ve pero no se puede decidir', async () => {
    await renderizar({ ...EVALUACION_DTO, policy: null, coverage: null, holder: null, policy_unavailable: true });

    expect(screen.getByText(/núcleo de pólizas no respondió: puedes revisar el caso/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Aprobar y pagar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('un caso que la póliza no cubre no se puede aprobar', async () => {
    await renderizar({ ...EVALUACION_DTO, coverage: null });

    expect(screen.getByText(/no se puede aprobar el pago/)).toBeTruthy();
    expect(screen.getByText('La póliza no cubre este incidente')).toBeTruthy();
  });

  it('sigue el pago en curso hasta que queda pagado (CA-2)', async () => {
    vi.useFakeTimers();
    await renderizar(evaluacionCon(APROBACION_EN_CURSO_DTO));
    expect(screen.getByText(/El pago de la indemnización está en curso/)).toBeTruthy();

    leerCon(evaluacionCon(APROBACION_PAGADA_DTO));
    await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS);
    await vi.advanceTimersByTimeAsync(100);

    expect(api.consultarEvaluacion).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Indemnización pagada:/)).toBeTruthy();
    expect(screen.getByText('Indemnización pagada', { selector: '.historial__titulo' })).toBeTruthy();
    await vi.advanceTimersByTimeAsync(INTERVALO_SEGUIMIENTO_MS * 3);
    expect(api.consultarEvaluacion).toHaveBeenCalledTimes(2);
  });

  it('O6b: muestra la excepción y reintenta con la cuenta corregida (CA-4)', async () => {
    const { usuario } = await renderizar(evaluacionCon(APROBACION_EN_EXCEPCION_DTO));

    expect(screen.getByText('El pago de la indemnización falló')).toBeTruthy();
    expect(screen.getByText(/cuenta destino inválida\. La aprobación por \$\s?4\.132\.500/)).toBeTruthy();
    expect(screen.getByText(`indemnizacion-${ID_EVALUADO} (idempotente)`)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contactar al asegurado' }).getAttribute('href')).toBe('mailto:carolina@correo.example');
    expect((screen.getByLabelText('Código del banco') as HTMLInputElement).value).toBe('1007');

    await usuario.type(screen.getByLabelText('Cuenta destino'), '12');
    await usuario.click(screen.getByRole('button', { name: 'Reintentar pago' }));
    expect(screen.getByText('La cuenta tiene de 6 a 24 dígitos y guiones.')).toBeTruthy();
    expect(api.reintentarPago).not.toHaveBeenCalled();

    await usuario.clear(screen.getByLabelText('Cuenta destino'));
    await usuario.type(screen.getByLabelText('Cuenta destino'), '0123-4567-12');
    await usuario.click(screen.getByRole('button', { name: 'Reintentar pago' }));

    expect(api.reintentarPago).toHaveBeenCalledWith(ID_EVALUADO, {
      codigoBanco: '1007',
      nombreBanco: 'Banco Aliado',
      tipoCuenta: 'savings',
      numeroCuenta: '0123-4567-12',
    });
  });

  it('O6b: sin cuenta nueva reintenta al mismo destino; sin respuesta lo dice', async () => {
    const sinRespuesta = {
      ...APROBACION_EN_EXCEPCION_DTO,
      payout: { ...APROBACION_EN_EXCEPCION_DTO.payout!, failure: 'retries_exhausted' as const, gateway_code: null, automatic_attempts: 3 },
    };
    const { usuario } = await renderizar(evaluacionCon(sinRespuesta));

    expect(screen.getByText(/los 3 intentos automáticos se agotaron/)).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar pago' }));

    expect(api.reintentarPago).toHaveBeenCalledWith(ID_EVALUADO, undefined);
  });

  it('si otro analista se adelantó, recarga y lo avisa', async () => {
    const { usuario } = await renderizar();
    api.aprobar.mockReturnValue(throwError(() => new ErrorEvaluacion('claim_not_decidable')));
    leerCon(evaluacionCon(RECHAZO_DTO));

    await usuario.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));

    expect(screen.getByText('Otro analista ya decidió este siniestro. Esta es su decisión.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rechazo' })).toBeTruthy();
  });

  it('un fallo al decidir deja reintentar', async () => {
    const { usuario } = await renderizar();
    api.aprobar.mockReturnValue(throwError(() => new ErrorEvaluacion('policy_unavailable')));

    await usuario.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));

    expect(screen.getByText('El núcleo de pólizas no respondió. Intenta de nuevo en unos segundos.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aprobar y pagar' })).toBeTruthy();
  });

  it('un caso inexistente y un error al cargar se muestran', async () => {
    await renderizar(throwError(() => new ErrorEvaluacion('claim_not_found')));
    expect(screen.getByRole('heading', { name: 'No encontramos el siniestro' })).toBeTruthy();
  });

  it('un error al cargar deja reintentar', async () => {
    const { usuario } = await renderizar(throwError(() => new ErrorEvaluacion('claims_unavailable')));
    expect(screen.getByRole('heading', { name: 'No pudimos cargar el siniestro' })).toBeTruthy();

    leerCon(EVALUACION_DTO);
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01655' })).toBeTruthy();
  });
});
