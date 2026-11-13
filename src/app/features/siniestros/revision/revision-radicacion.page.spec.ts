import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';
import {
  RADICACION_DEVUELTA_DTO,
  RADICACION_EN_REVISION_DTO,
  RESULTADO_APROBACION_DTO,
  RESULTADO_DEVOLUCION_DTO,
} from '@testing/revision-radicacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  ErrorRevision,
  RadicacionEnRevision,
  RadicacionEnRevisionDto,
  mapearRadicacionEnRevision,
  mapearResultadoRevision,
} from '@core/api/siniestros/revision.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { RevisionRadicacionPage, veredictosIniciales } from './revision-radicacion.page';

describe('RevisionRadicacionPage (S8 · HU-W2.1-03)', () => {
  let api: {
    consultarRevision: ReturnType<typeof vi.fn>;
    aprobarRadicacion: ReturnType<typeof vi.fn>;
    devolverRadicacion: ReturnType<typeof vi.fn>;
  };

  async function renderizar(
    detalle:
      RadicacionEnRevisionDto | Observable<RadicacionEnRevision> = RADICACION_EN_REVISION_DTO,
  ) {
    api = {
      consultarRevision: vi
        .fn()
        .mockReturnValue(
          'subscribe' in detalle ? detalle : of(mapearRadicacionEnRevision(detalle)),
        ),
      aprobarRadicacion: vi
        .fn()
        .mockReturnValue(of(mapearResultadoRevision(RESULTADO_APROBACION_DTO))),
      devolverRadicacion: vi
        .fn()
        .mockReturnValue(of(mapearResultadoRevision(RESULTADO_DEVOLUCION_DTO))),
    };
    await render(RevisionRadicacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID_EVALUADO }) } },
        },
      ],
    });
    return userEvent.setup();
  }

  const fila = (codigo: string) =>
    document.querySelector<HTMLElement>(`[data-codigo="${codigo}"]`)!;
  const aprobar = () =>
    screen.getByRole('button', { name: 'Aprobar y enviar a evaluación' }) as HTMLButtonElement;

  it('muestra los datos reportados, el veredicto de cada soporte y la póliza con los siniestros previos (CA-1)', async () => {
    await renderizar();

    expect(api.consultarRevision).toHaveBeenCalledWith(ID_EVALUADO);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Radicación SIN-2026-01877' }),
    ).toBeTruthy();
    expect(screen.getByText('Pendiente de revisión')).toBeTruthy();
    expect(
      screen.getByText(/Radicado por Carolina Pérez Ruiz el .* desde el portal web/),
    ).toBeTruthy();
    expect(screen.getByText('Calle 80 con carrera 30, Bogotá')).toBeTruthy();

    expect(
      within(fila('vehicle_photos')).getByText('Válido', {
        selector: 'app-insignia-estado *, app-insignia-estado',
      }),
    ).toBeTruthy();
    expect(within(fila('plate_photo')).getByText('No adjunto · opcional')).toBeTruthy();
    expect(within(fila('plate_photo')).getByText('Opcional')).toBeTruthy();
    expect(
      within(fila('vehicle_photos'))
        .getByRole('link', { name: 'Ver un archivo de Fotos del vehículo' })
        .getAttribute('href'),
    ).toBe('https://firmada/sup-1');
    expect(within(fila('traffic_report')).getByText('croquis.jpg')).toBeTruthy();

    expect(screen.getByText('Colisión')).toBeTruthy();
    expect(screen.getByText('10 %')).toBeTruthy();
    expect(screen.getByText(/SIN-2026-01500 · rechazado \(cristales, 08\/2026\)/)).toBeTruthy();
  });

  it('aprueba cuando todo lo adjunto es válido y muestra el resultado (CA-2)', async () => {
    const usuario = await renderizar();
    api.consultarRevision.mockReturnValue(
      of(
        mapearRadicacionEnRevision({
          ...RADICACION_EN_REVISION_DTO,
          claim: { ...RADICACION_EN_REVISION_DTO.claim, status: 'in_evaluation' },
        }),
      ),
    );

    expect(aprobar().disabled).toBe(false);
    await usuario.click(aprobar());

    expect(api.aprobarRadicacion).toHaveBeenCalledWith(ID_EVALUADO);
    expect(screen.getByText(/pasó a «En evaluación» y entró a la cola de triage/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aprobar y enviar a evaluación' })).toBeNull();
  });

  it('un soporte ilegible o uno opcional pedido impide aprobar', async () => {
    const usuario = await renderizar();

    await usuario.click(within(fila('traffic_report')).getByRole('radio', { name: 'Ilegible' }));
    expect(aprobar().disabled).toBe(true);
    expect(screen.getByText(/Para aprobar, todos los soportes deben estar válidos/)).toBeTruthy();

    await usuario.click(within(fila('traffic_report')).getByRole('radio', { name: 'Válido' }));
    expect(aprobar().disabled).toBe(false);

    await usuario.click(
      within(fila('plate_photo')).getByRole('checkbox', { name: 'Solicitar al cliente' }),
    );
    expect(aprobar().disabled).toBe(true);
    expect(within(fila('plate_photo')).getByText('Falta')).toBeTruthy();
  });

  it('devuelve con el motivo, el mensaje, la nota del soporte ilegible y el opcional pedido (CA-3)', async () => {
    const usuario = await renderizar();

    await usuario.click(within(fila('traffic_report')).getByRole('radio', { name: 'Ilegible' }));
    await usuario.type(within(fila('traffic_report')).getByRole('textbox'), 'borroso');
    await usuario.click(
      within(fila('plate_photo')).getByRole('checkbox', { name: 'Solicitar al cliente' }),
    );
    await usuario.selectOptions(
      screen.getByLabelText('Motivo'),
      'illegible_or_incomplete_supports',
    );
    await usuario.click(screen.getByRole('checkbox', { name: 'Lugar' }));
    await usuario.type(screen.getByLabelText('Mensaje para el cliente'), 'No se lee.');
    expect(screen.getByText('Se pedirán 2 soporte(s) y 1 dato(s) a corregir.')).toBeTruthy();

    await usuario.click(screen.getByRole('button', { name: 'Devolver radicación' }));

    expect(api.devolverRadicacion).toHaveBeenCalledWith(ID_EVALUADO, {
      motivo: 'illegible_or_incomplete_supports',
      mensaje: 'No se lee.',
      soportes: [
        { codigoRequisito: 'traffic_report', veredicto: 'illegible', nota: 'borroso' },
        { codigoRequisito: 'plate_photo', veredicto: 'missing' },
      ],
      datosACorregir: ['place'],
    });
    expect(screen.getByText(/quedó «Devuelto al cliente»/)).toBeTruthy();
  }, 20_000);

  it('no envía una devolución sin motivo, sin mensaje o sin nada que pedir', async () => {
    const usuario = await renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Devolver radicación' }));

    expect(api.devolverRadicacion).not.toHaveBeenCalled();
    expect(screen.getByText('Elige el motivo de la devolución.')).toBeTruthy();
    expect(screen.getByText('Escribe el mensaje para el cliente.')).toBeTruthy();
    expect(screen.getByText(/Para devolver, marca al menos un soporte/)).toBeTruthy();

    await usuario.selectOptions(screen.getByLabelText('Motivo'), 'other');
    expect(screen.queryByText('Elige el motivo de la devolución.')).toBeNull();
  });

  it('«Devolver al cliente» lleva al formulario', async () => {
    const usuario = await renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Devolver al cliente' }));

    expect(document.activeElement).toBe(screen.getByLabelText('Motivo'));
  });

  it('una radicación ya devuelta se ve en solo lectura con el veredicto registrado', async () => {
    await renderizar(RADICACION_DEVUELTA_DTO);

    expect(screen.getByText('Devuelto al cliente')).toBeTruthy();
    expect(screen.getByText(/fue devuelta al cliente por Juan Ríos/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aprobar y enviar a evaluación' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(within(fila('traffic_report')).getByText('Ilegible')).toBeTruthy();
    expect(within(fila('traffic_report')).getByText(/borroso/)).toBeTruthy();
    expect(screen.getByText('Devuelta por Juan Ríos')).toBeTruthy();
  });

  it.each([
    ['claim_not_reviewable', 'Otro asesor ya revisó esta radicación'],
    ['supports_incomplete', 'Falta un soporte requerido'],
    ['claims_unavailable', 'No pudimos registrar la revisión. Intenta de nuevo'],
  ] as const)('si aprobar falla con %s, lo dice', async (codigo, texto) => {
    const usuario = await renderizar();
    api.aprobarRadicacion.mockReturnValue(throwError(() => new ErrorRevision(codigo)));

    await usuario.click(aprobar());

    expect(screen.getByRole('alert').textContent).toContain(texto);
  });

  it.each([
    ['message_required', 'Escribe el mensaje para el cliente.'],
    ['nothing_requested', 'Para devolver, marca al menos un soporte'],
  ] as const)('si devolver falla con %s, lo muestra en el formulario', async (codigo, texto) => {
    const usuario = await renderizar();
    api.devolverRadicacion.mockReturnValue(throwError(() => new ErrorRevision(codigo)));
    await usuario.click(within(fila('traffic_report')).getByRole('radio', { name: 'Ilegible' }));
    await usuario.selectOptions(screen.getByLabelText('Motivo'), 'other');
    await usuario.type(screen.getByLabelText('Mensaje para el cliente'), 'x');

    await usuario.click(screen.getByRole('button', { name: 'Devolver radicación' }));

    expect(screen.getByText(new RegExp(texto))).toBeTruthy();
  });

  it('si la radicación no existe o no carga, lo dice', async () => {
    await renderizar(throwError(() => new ErrorRevision('claim_not_found')));
    expect(screen.getByRole('heading', { name: 'No encontramos la radicación' })).toBeTruthy();
  });

  it('si no carga, deja reintentar', async () => {
    const usuario = await renderizar(throwError(() => new ErrorRevision('claims_unavailable')));
    api.consultarRevision.mockReturnValue(
      of(mapearRadicacionEnRevision(RADICACION_EN_REVISION_DTO)),
    );

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Radicación SIN-2026-01877' }),
    ).toBeTruthy();
  });

  it('los veredictos con que abre: lo adjunto válido, el requerido sin adjuntar falta y el opcional sin veredicto', () => {
    const r = mapearRadicacionEnRevision({
      ...RADICACION_EN_REVISION_DTO,
      checklist: [
        { requirement_code: 'vehicle_photos', label: 'Fotos', required: true, files: 4 },
        { requirement_code: 'traffic_report', label: 'Informe', required: true, files: 0 },
        { requirement_code: 'plate_photo', label: 'Placa', required: false, files: 0 },
      ],
    });

    expect(veredictosIniciales(r)).toEqual({
      vehicle_photos: { veredicto: 'valid', nota: '' },
      traffic_report: { veredicto: 'missing', nota: '' },
    });
  });
});
