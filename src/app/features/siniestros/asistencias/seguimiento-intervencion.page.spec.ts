import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { simularDialogoNativo } from '@testing/dialogo-pruebas';
import { ID_EVALUADO } from '@testing/evaluacion-pruebas';
import {
  INTERVENCION_ASIGNADA_DTO,
  INTERVENCION_CERRADA_DTO,
  INTERVENCION_EN_CURSO_DTO,
  INTERVENCION_SIN_PRESTADOR_DTO,
  INTERVENCION_TERMINADA_DTO,
} from '@testing/intervencion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { NEVER, Observable, of, throwError } from 'rxjs';

import {
  CodigoErrorIntervencion,
  ErrorIntervencion,
  Intervencion,
  IntervencionDto,
  PasoIntervencion,
  mapearIntervencion,
} from '@core/api/siniestros/intervencion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { SeguimientoIntervencionPage } from './seguimiento-intervencion.page';

const de = (dto: IntervencionDto) => of(mapearIntervencion(dto));
const falla = (
  codigo: CodigoErrorIntervencion,
  campos: { campo: string; codigo: string }[] = [],
  faltantes: PasoIntervencion[] = [],
) => throwError(() => new ErrorIntervencion(codigo, campos, faltantes));

describe('SeguimientoIntervencionPage (O8 · HU-W2.3-02)', () => {
  let api: {
    consultarIntervencion: ReturnType<typeof vi.fn<(id: string) => Observable<Intervencion>>>;
    registrarAvance: ReturnType<typeof vi.fn>;
    cerrarCaso: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => simularDialogoNativo());

  async function renderizar(lectura: Observable<Intervencion> = de(INTERVENCION_EN_CURSO_DTO)) {
    api = {
      consultarIntervencion: vi.fn().mockReturnValue(lectura),
      registrarAvance: vi.fn().mockReturnValue(de(INTERVENCION_TERMINADA_DTO)),
      cerrarCaso: vi.fn().mockReturnValue(de(INTERVENCION_CERRADA_DTO)),
    };
    const vista = await render(SeguimientoIntervencionPage, {
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
    await vista.fixture.whenStable();
    return { usuario: userEvent.setup(), vista };
  }

  const fila = (paso: string) => document.querySelector(`[data-paso="${paso}"]`) as HTMLElement;
  const boton = (nombre: string | RegExp) =>
    screen.getByRole('button', { name: nombre }) as HTMLButtonElement;

  it('O8: encabezado, línea de tiempo, informe y tarjetas laterales (CA-2)', async () => {
    await renderizar();

    expect(api.consultarIntervencion).toHaveBeenCalledWith(ID_EVALUADO);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Intervención del prestador · SIN-2026-01655',
      }),
    ).toBeTruthy();
    expect(screen.getByText('En curso')).toBeTruthy();
    expect(
      screen.getByText(/^Servicios Hogar Norte · asignado el 06\/09\/2026 · .* · el caso refleja/),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Contactar al prestador/ }).getAttribute('href')).toBe(
      'tel:+576015550102',
    );
    expect(
      screen.getByRole('link', { name: 'Siniestro SIN-2026-01655' }).getAttribute('href'),
    ).toBe(`/siniestros/${ID_EVALUADO}/evaluar`);

    expect(within(fila('assigned')).getByText('Asignado')).toBeTruthy();
    expect(within(fila('assigned')).getByText(/Andrés Ruiz · distancia 2,3 km/)).toBeTruthy();
    expect(
      within(fila('accepted')).getByText('visita programada 15/09/2026 8:00 a 12:00'),
    ).toBeTruthy();
    expect(within(fila('accepted')).getByText(/registrado por Andrés Ruiz/)).toBeTruthy();
    expect(
      within(fila('visit_done')).getByText(
        /Causa: Filtración por tubería del piso superior · costo estimado/,
      ),
    ).toBeTruthy();
    expect(fila('repair_authorized').getAttribute('aria-current')).toBe('step');
    expect(
      within(fila('repair_authorized')).getByRole('button', { name: 'Registrar avance' }),
    ).toBeTruthy();
    expect(within(fila('repair_executed')).getByText('Pendiente')).toBeTruthy();
    expect(within(fila('repair_executed')).queryByRole('button')).toBeNull();

    const informe = screen.getByRole('region', { name: 'Informe del prestador' });
    expect(within(informe).getByText('Techo y muro de cocina · 6 m²')).toBeTruthy();
    expect(within(informe).getByText(/4\.350\.000/)).toBeTruthy();
    expect(within(informe).getByText('2 días hábiles')).toBeTruthy();
    expect(within(informe).getAllByRole('listitem')).toHaveLength(4);
    expect(within(informe).getByText('8 fotografías recibidas por el prestador')).toBeTruthy();

    const prestador = screen.getByRole('region', { name: 'Prestador' });
    expect(
      within(prestador).getByRole('link', { name: 'despachos@hogarnorte.example.com' }),
    ).toBeTruthy();
    expect(within(prestador).getByText('2,3 km')).toBeTruthy();
    const siniestro = screen.getByRole('region', { name: 'Siniestro' });
    expect(within(siniestro).getByText('HG-2025-880231')).toBeTruthy();
    expect(within(siniestro).getByText('En evaluación')).toBeTruthy();
  });

  it('registra el avance siguiente y la línea se actualiza al instante (CA-1)', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_ASIGNADA_DTO));
    api.registrarAvance.mockReturnValue(de(INTERVENCION_EN_CURSO_DTO));

    await usuario.click(within(fila('accepted')).getByRole('button', { name: 'Registrar avance' }));
    const dialogo = screen.getByRole('dialog', {
      name: 'Registrar avance: Aceptado por el prestador',
    });
    await usuario.type(within(dialogo).getByLabelText('Observación'), 'visita programada');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar avance' }));

    expect(api.registrarAvance).toHaveBeenCalledWith(
      ID_EVALUADO,
      expect.objectContaining({
        paso: 'accepted',
        observacion: 'visita programada',
        ocurridoEn: expect.any(String),
      }),
    );
    expect(api.registrarAvance.mock.calls[0][1].informe).toBeUndefined();
    expect(fila('repair_authorized').getAttribute('aria-current')).toBe('step');
    expect(dialogo.hasAttribute('open')).toBe(false);
  });

  it('la visita pide el informe y valida antes de enviar', async () => {
    const enCamino = {
      ...INTERVENCION_EN_CURSO_DTO,
      next_step: 'visit_done' as const,
      steps: INTERVENCION_EN_CURSO_DTO.steps.slice(0, 2),
      report: null,
    };
    const { usuario } = await renderizar(de(enCamino));

    expect(screen.getByText('El informe llega con la visita del prestador.')).toBeTruthy();
    await usuario.click(
      within(fila('visit_done')).getByRole('button', { name: 'Registrar avance' }),
    );
    const dialogo = screen.getByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar avance' }));

    expect(api.registrarAvance).not.toHaveBeenCalled();
    expect(within(dialogo).getAllByText('Este dato es obligatorio.')).toHaveLength(4);

    await usuario.type(within(dialogo).getByLabelText('Causa verificada'), 'Filtración');
    await usuario.type(within(dialogo).getByLabelText('Daño'), 'Techo');
    await usuario.type(within(dialogo).getByLabelText('Costo de reparación (COP)'), '4350000');
    await usuario.type(within(dialogo).getByLabelText('Tiempo de ejecución (días hábiles)'), '2.5');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar avance' }));
    expect(within(dialogo).getByText('El valor no es válido.')).toBeTruthy();

    await usuario.clear(within(dialogo).getByLabelText('Tiempo de ejecución (días hábiles)'));
    await usuario.type(within(dialogo).getByLabelText('Tiempo de ejecución (días hábiles)'), '2');
    await usuario.type(within(dialogo).getByLabelText('Fotografías recibidas'), '8');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar avance' }));

    expect(api.registrarAvance.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        paso: 'visit_done',
        informe: {
          causa: 'Filtración',
          dano: 'Techo',
          costoReparacionCentavos: 435_000_000,
          diasReparacion: 2,
          fotos: 8,
        },
      }),
    );
  });

  it('muestra en su campo el 422 del servidor hasta que se edita', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_ASIGNADA_DTO));
    api.registrarAvance.mockReturnValue(
      falla('validation_failed', [{ campo: 'occurred_at', codigo: 'out_of_range' }]),
    );

    await usuario.click(boton('Registrar avance'));
    const dialogo = screen.getByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar avance' }));

    const fecha = within(dialogo).getByLabelText('Fecha y hora del avance');
    expect(
      within(dialogo).getByText(
        'La fecha no puede ser anterior al avance previo ni estar en el futuro.',
      ),
    ).toBeTruthy();
    expect(fecha.getAttribute('aria-invalid')).toBe('true');
    expect(dialogo.hasAttribute('open')).toBe(true);

    await usuario.type(within(dialogo).getByLabelText('Observación'), 'x');
    expect(fecha.getAttribute('aria-invalid')).toBe('true'); // editar otro campo no borra el error de la fecha
  });

  it('otro analista registró primero: avisa y vuelve a leer', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_ASIGNADA_DTO));
    api.registrarAvance.mockReturnValue(falla('step_out_of_order'));
    api.consultarIntervencion.mockReturnValue(de(INTERVENCION_EN_CURSO_DTO));

    await usuario.click(boton('Registrar avance'));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar avance' }),
    );

    expect(screen.getByRole('alert').textContent).toContain('Otro analista ya registró ese avance');
    expect(api.consultarIntervencion).toHaveBeenCalledTimes(2);
    expect(fila('repair_authorized').getAttribute('aria-current')).toBe('step');
  });

  it('no deja cerrar mientras la intervención no termina y dice qué falta (CA-4)', async () => {
    const { usuario } = await renderizar();

    await usuario.click(boton('Cerrar caso'));
    const dialogo = screen.getByRole('dialog', { name: 'Cerrar caso SIN-2026-01655' });

    expect(within(dialogo).getByRole('alert').textContent).toContain(
      'falta registrar reparación autorizada y reparación ejecutada y cierre',
    );
    expect(
      (within(dialogo).getByRole('button', { name: 'Cerrar caso' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(within(dialogo).queryByLabelText('Resultado del cierre')).toBeNull();
  });

  it('cierra el caso con resultado obligatorio y confirmación (CA-3 y CA-5)', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_TERMINADA_DTO));
    expect(screen.getByText('Listo para cerrar')).toBeTruthy();

    await usuario.click(boton('Cerrar caso'));
    const dialogo = screen.getByRole('dialog');
    const enviar = within(dialogo).getByRole('button', { name: 'Cerrar caso' });
    await usuario.click(enviar);

    expect(api.cerrarCaso).not.toHaveBeenCalled();
    expect(within(dialogo).getByText('Este dato es obligatorio.')).toBeTruthy();
    expect(within(dialogo).getByText('Marca la confirmación para cerrar el caso.')).toBeTruthy();

    await usuario.selectOptions(within(dialogo).getByLabelText('Resultado del cierre'), 'repaired');
    await usuario.type(within(dialogo).getByLabelText('Observaciones'), 'Asegurada conforme');
    await usuario.click(within(dialogo).getByRole('checkbox'));
    await usuario.click(enviar);

    expect(api.cerrarCaso).toHaveBeenCalledWith(
      ID_EVALUADO,
      expect.objectContaining({
        resultado: 'repaired',
        observaciones: 'Asegurada conforme',
        cerradoEn: expect.any(String),
      }),
    );
    const cierre = screen.getByRole('region', { name: 'Caso cerrado' });
    expect(within(cierre).getByText(/por Andrés Ruiz/)).toBeTruthy();
    expect(
      within(cierre).getByText(/Reparación completada · Observaciones: Asegurada conforme/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cerrar caso' })).toBeNull();
    expect(screen.getByText('Cerrado')).toBeTruthy();
  });

  it('un 409 al cerrar deja el diálogo abierto con lo que falta', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_TERMINADA_DTO));
    api.cerrarCaso.mockReturnValue(falla('intervention_not_finished', [], ['repair_executed']));
    api.consultarIntervencion.mockReturnValue(NEVER);

    await usuario.click(boton('Cerrar caso'));
    const dialogo = screen.getByRole('dialog');
    await usuario.selectOptions(
      within(dialogo).getByLabelText('Resultado del cierre'),
      'not_repairable',
    );
    await usuario.click(within(dialogo).getByRole('checkbox'));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar caso' }));

    expect(dialogo.hasAttribute('open')).toBe(true);
    expect(within(dialogo).getByRole('alert').textContent).toContain(
      'reparación ejecutada y cierre',
    );
  });

  it('un error del servicio al cerrar se avisa sin perder la pantalla', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_TERMINADA_DTO));
    api.cerrarCaso.mockReturnValue(falla('claims_unavailable'));

    await usuario.click(boton('Cerrar caso'));
    const dialogo = screen.getByRole('dialog');
    await usuario.selectOptions(within(dialogo).getByLabelText('Resultado del cierre'), 'repaired');
    await usuario.click(within(dialogo).getByRole('checkbox'));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar caso' }));

    expect(screen.getByRole('alert').textContent).toContain('No pudimos guardar el cambio');
    expect(api.consultarIntervencion).toHaveBeenCalledTimes(1);
  });

  it('un caso sin prestador lleva a asignarlo', async () => {
    await renderizar(de(INTERVENCION_SIN_PRESTADOR_DTO));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Este caso aún no tiene prestador' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Asignar prestador' }).getAttribute('href')).toBe(
      `/siniestros/${ID_EVALUADO}/asignar-prestador`,
    );
  });

  it('un caso cerrado no ofrece acciones', async () => {
    await renderizar(de(INTERVENCION_CERRADA_DTO));
    expect(screen.queryByRole('button', { name: 'Cerrar caso' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar avance' })).toBeNull();
  });

  it('sin teléfono, «Contactar al prestador» abre el correo', async () => {
    const sinTelefono = structuredClone(INTERVENCION_EN_CURSO_DTO);
    sinTelefono.assignment!.provider.contact_phone = null;
    await renderizar(de(sinTelefono));
    expect(screen.getByRole('link', { name: /Contactar al prestador/ }).getAttribute('href')).toBe(
      'mailto:despachos@hogarnorte.example.com',
    );
  });

  it('un caso que no existe muestra su estado', async () => {
    await renderizar(falla('claim_not_found'));
    expect(screen.getByRole('heading', { name: 'No encontramos este siniestro' })).toBeTruthy();
  });

  it('error al cargar: «Reintentar» vuelve a leer', async () => {
    const { usuario } = await renderizar(falla('claims_unavailable'));
    expect(screen.getByRole('heading', { name: 'No pudimos cargar la intervención' })).toBeTruthy();
    api.consultarIntervencion.mockReturnValue(de(INTERVENCION_EN_CURSO_DTO));
    await usuario.click(boton('Reintentar'));
    expect(
      screen.getByRole('heading', { level: 1, name: /Intervención del prestador/ }),
    ).toBeTruthy();
  });

  it('Escape no cierra el diálogo mientras se envía', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_ASIGNADA_DTO));
    api.registrarAvance.mockReturnValue(NEVER);
    await usuario.click(boton('Registrar avance'));
    const dialogo = screen.getByRole('dialog') as HTMLDialogElement;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar avance' }));
    expect(within(dialogo).getByRole('button', { name: 'Registrando…' })).toBeTruthy();
    within(dialogo).getByRole('button', { name: 'Cerrar' }).click();
    expect(dialogo.hasAttribute('open')).toBe(true);
  });

  it('un «close» viejo no vacía el diálogo que se volvió a abrir', async () => {
    const { usuario } = await renderizar(de(INTERVENCION_ASIGNADA_DTO));
    await usuario.click(boton('Registrar avance'));
    const dialogo = screen.getByRole('dialog') as HTMLDialogElement;

    dialogo.dispatchEvent(new Event('close'));

    expect(within(dialogo).getByLabelText('Fecha y hora del avance')).toBeTruthy();
  });
});
